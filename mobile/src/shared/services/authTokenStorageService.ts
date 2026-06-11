import {
  KeychainAccess,
  SecureStorage,
} from '@aparajita/capacitor-secure-storage';

const AUTH_TOKEN_STORAGE_PREFIX = 'ourweek:auth:';
const ACCESS_TOKEN_KEY = 'access-token';
const REFRESH_TOKEN_KEY = 'refresh-token';

export interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

let initializationPromise: Promise<void> | null = null;

async function initializeSecureTokenStorage() {
  if (!initializationPromise) {
    initializationPromise = Promise.all([
      SecureStorage.setKeyPrefix(AUTH_TOKEN_STORAGE_PREFIX),
      SecureStorage.setSynchronize(false),
      SecureStorage.setDefaultKeychainAccess(
        KeychainAccess.whenUnlockedThisDeviceOnly
      ),
    ]).then(() => undefined);
  }

  return initializationPromise;
}

async function readToken(key: string) {
  await initializeSecureTokenStorage();

  const value = await SecureStorage.get(key, false);
  return typeof value === 'string' && value ? value : null;
}

async function writeToken(key: string, value: string | null | undefined) {
  await initializeSecureTokenStorage();

  if (value) {
    await SecureStorage.set(key, value, false);
    return;
  }

  await SecureStorage.remove(key);
}

export async function readAuthTokens(): Promise<AuthTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    readToken(ACCESS_TOKEN_KEY),
    readToken(REFRESH_TOKEN_KEY),
  ]);

  return { accessToken, refreshToken };
}

export async function writeAuthTokens(tokens: AuthTokens) {
  await Promise.all([
    writeToken(ACCESS_TOKEN_KEY, tokens.accessToken),
    writeToken(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function clearAuthTokens() {
  await initializeSecureTokenStorage();

  await Promise.all([
    SecureStorage.remove(ACCESS_TOKEN_KEY),
    SecureStorage.remove(REFRESH_TOKEN_KEY),
  ]);
}
