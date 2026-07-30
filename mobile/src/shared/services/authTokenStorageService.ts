import {
  KeychainAccess,
  SecureStorage,
} from '@aparajita/capacitor-secure-storage';
import { debugSafely, warnSafely } from '@/shared/services/safeLogService';

const AUTH_TOKEN_STORAGE_PREFIX = 'ourweek:auth:';
const SESSION_KEY = 'session';
const ACCESS_TOKEN_KEY = 'access-token';
const REFRESH_TOKEN_KEY = 'refresh-token';
const EXPIRES_AT_KEY = 'expires-at';
const SECURE_STORAGE_OPERATION_TIMEOUT_MS = 4_000;

type AuthTokenStorageErrorCode =
  | 'secure_storage_timeout'
  | 'secure_storage_verification_failed'
  | 'secure_storage_native_error';

type SecureStorageOperation =
  | 'read_session'
  | 'write_session'
  | 'verify_session'
  | 'read_legacy_access_token'
  | 'read_legacy_refresh_token'
  | 'read_legacy_expiry'
  | 'remove_session'
  | 'remove_legacy_access_token'
  | 'remove_legacy_refresh_token'
  | 'remove_legacy_expiry';

export interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
}

class AuthTokenStorageError extends Error {
  readonly code: AuthTokenStorageErrorCode;
  readonly operation: SecureStorageOperation;

  constructor(
    code: AuthTokenStorageErrorCode,
    operation: SecureStorageOperation
  ) {
    super('Secure auth token storage is unavailable.');
    this.name = 'AuthTokenStorageError';
    this.code = code;
    this.operation = operation;
  }
}

let initializationPromise: Promise<void> | null = null;

async function initializeSecureTokenStorage() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await SecureStorage.setKeyPrefix(AUTH_TOKEN_STORAGE_PREFIX);
      await SecureStorage.setSynchronize(false);
      await SecureStorage.setDefaultKeychainAccess(
        KeychainAccess.whenUnlockedThisDeviceOnly
      );
    })();
  }

  return initializationPromise;
}

function getSafeErrorCategory(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }

  return error instanceof Error ? error.name : typeof error;
}

async function runSecureStorageOperation<T>(
  operation: SecureStorageOperation,
  nativeOperation: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  debugSafely('Secure auth storage operation started.', { operation });

  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new AuthTokenStorageError('secure_storage_timeout', operation));
    }, SECURE_STORAGE_OPERATION_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([nativeOperation(), timeout]);

    debugSafely('Secure auth storage operation finished.', {
      durationMs: Date.now() - startedAt,
      operation,
      outcome: 'success',
    });

    return result;
  } catch (error) {
    if (error instanceof AuthTokenStorageError) {
      warnSafely('Secure auth storage operation timed out.', {
        durationMs: Date.now() - startedAt,
        errorCategory: error.code,
        operation,
      });
      throw error;
    }

    const storageError = new AuthTokenStorageError(
      'secure_storage_native_error',
      operation
    );
    warnSafely('Secure auth storage operation failed.', {
      durationMs: Date.now() - startedAt,
      errorCategory: getSafeErrorCategory(error),
      operation,
    });
    throw storageError;
  } finally {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

async function readToken(key: string, operation: SecureStorageOperation) {
  const value = await runSecureStorageOperation(operation, () =>
    SecureStorage.get(key, false)
  );
  return typeof value === 'string' && value ? value : null;
}

function normalizeStoredTokens(value: unknown): AuthTokens | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<AuthTokens>;

  if (
    typeof candidate.accessToken !== 'string' ||
    !candidate.accessToken ||
    (candidate.refreshToken !== null &&
      typeof candidate.refreshToken !== 'string') ||
    (candidate.expiresAt !== null && typeof candidate.expiresAt !== 'string')
  ) {
    return null;
  }

  return {
    accessToken: candidate.accessToken,
    refreshToken: candidate.refreshToken ?? null,
    expiresAt: candidate.expiresAt ?? null,
  };
}

function storedTokensMatch(
  storedTokens: AuthTokens | null,
  expectedTokens: AuthTokens
) {
  return (
    storedTokens?.accessToken === expectedTokens.accessToken &&
    storedTokens.refreshToken === expectedTokens.refreshToken &&
    storedTokens.expiresAt === expectedTokens.expiresAt
  );
}

async function removeTokenBestEffort(
  key: string,
  operation: SecureStorageOperation
) {
  try {
    await runSecureStorageOperation(operation, () => SecureStorage.remove(key));
  } catch (error) {
    warnSafely('Unable to clear secure auth token storage.', {
      errorCategory:
        error instanceof AuthTokenStorageError
          ? error.code
          : getSafeErrorCategory(error),
      operation,
    });
  }
}

async function removeLegacyTokenKeys() {
  await removeTokenBestEffort(ACCESS_TOKEN_KEY, 'remove_legacy_access_token');
  await removeTokenBestEffort(REFRESH_TOKEN_KEY, 'remove_legacy_refresh_token');
  await removeTokenBestEffort(EXPIRES_AT_KEY, 'remove_legacy_expiry');
}

export async function readAuthTokens(): Promise<AuthTokens> {
  await initializeSecureTokenStorage();

  const storedTokens = normalizeStoredTokens(
    await runSecureStorageOperation('read_session', () =>
      SecureStorage.get(SESSION_KEY, false)
    )
  );

  if (storedTokens) {
    return storedTokens;
  }

  const accessToken = await readToken(
    ACCESS_TOKEN_KEY,
    'read_legacy_access_token'
  );
  const refreshToken = await readToken(
    REFRESH_TOKEN_KEY,
    'read_legacy_refresh_token'
  );
  const expiresAt = await readToken(EXPIRES_AT_KEY, 'read_legacy_expiry');

  if (accessToken) {
    const legacyTokens = { accessToken, refreshToken, expiresAt };

    try {
      await writeAuthTokens(legacyTokens);
      await removeLegacyTokenKeys();
    } catch (error) {
      warnSafely('Unable to migrate legacy secure auth tokens.', {
        errorCategory:
          error instanceof AuthTokenStorageError
            ? error.code
            : getSafeErrorCategory(error),
      });
    }

    return legacyTokens;
  }

  return { accessToken: null, refreshToken: null, expiresAt: null };
}

export async function writeAuthTokens(tokens: AuthTokens) {
  await initializeSecureTokenStorage();

  try {
    await runSecureStorageOperation('write_session', () =>
      SecureStorage.set(SESSION_KEY, tokens, false)
    );
    return;
  } catch (error) {
    if (
      !(error instanceof AuthTokenStorageError) ||
      error.code !== 'secure_storage_timeout'
    ) {
      throw error;
    }
  }

  debugSafely('Secure auth storage write verification started.', {
    operation: 'verify_session',
  });

  const storedTokens = normalizeStoredTokens(
    await runSecureStorageOperation('verify_session', () =>
      SecureStorage.get(SESSION_KEY, false)
    )
  );

  if (!storedTokensMatch(storedTokens, tokens)) {
    warnSafely('Secure auth storage write verification failed.', {
      errorCategory: 'secure_storage_verification_failed',
      operation: 'verify_session',
    });
    throw new AuthTokenStorageError(
      'secure_storage_verification_failed',
      'verify_session'
    );
  }

  debugSafely('Secure auth storage write recovered.', {
    operation: 'verify_session',
    outcome: 'recovered_after_write_timeout',
  });
}

export async function clearAuthTokens() {
  await initializeSecureTokenStorage();

  await removeTokenBestEffort(SESSION_KEY, 'remove_session');
  await removeLegacyTokenKeys();
}
