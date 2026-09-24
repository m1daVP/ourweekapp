import { Capacitor } from '@capacitor/core';
import { ErrorCode, GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { appConfig } from '@/shared/config/env';
import { translate } from '@/features/localization/i18n';

let initializationPromise: Promise<void> | null = null;
const GOOGLE_INITIALIZATION_TIMEOUT_MS = 10_000;
const GOOGLE_LOGIN_TIMEOUT_MS = 60_000;

export class GoogleSignInError extends Error {
  code: 'unavailable' | 'missing_id_token' | 'cancelled' | 'timed_out';

  constructor(
    code: 'unavailable' | 'missing_id_token' | 'cancelled' | 'timed_out',
    message: string
  ) {
    super(message);
    this.name = 'GoogleSignInError';
    this.code = code;
  }
}

async function withGoogleTimeout<T>(operation: Promise<T>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(
        new GoogleSignInError(
          'timed_out',
          translate('auth.googleProviderTimedOut')
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

export function isNativeGoogleSignInSupported() {
  return Capacitor.isNativePlatform();
}

function getGoogleClientConfig() {
  const platform = Capacitor.getPlatform();

  if (platform === 'android') {
    return appConfig.googleWebClientId ?? null;
  }

  if (platform === 'ios') {
    return appConfig.googleWebClientId ?? null;
  }

  return null;
}

async function initializeGoogleSignIn() {
  if (!Capacitor.isNativePlatform()) {
    throw new GoogleSignInError(
      'unavailable',
      translate('auth.googleSignInUnavailable')
    );
  }

  const googleConfig = getGoogleClientConfig();

  if (!googleConfig) {
    throw new GoogleSignInError(
      'unavailable',
      translate('auth.googleSignInUnavailable')
    );
  }

  if (!initializationPromise) {
    initializationPromise = withGoogleTimeout(
      GoogleSignIn.initialize({
        clientId: googleConfig,
        // Do not request OAuth scopes. Our backend only needs the ID token,
        // and scopes would start a second native authorization flow.
      }),
      GOOGLE_INITIALIZATION_TIMEOUT_MS
    ).catch((error: unknown) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}

function isUserCancelledError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === ErrorCode.SignInCanceled
  );
}

export async function getNativeGoogleIdToken() {
  await initializeGoogleSignIn();

  try {
    const login = await withGoogleTimeout(
      GoogleSignIn.signIn(),
      GOOGLE_LOGIN_TIMEOUT_MS
    );

    const idToken =
      typeof login.idToken === 'string' && login.idToken.trim()
        ? login.idToken
        : null;

    if (!idToken) {
      throw new GoogleSignInError(
        'missing_id_token',
        translate('auth.googleTokenMissing')
      );
    }

    return idToken;
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new GoogleSignInError(
        'cancelled',
        translate('auth.googleSignInFailed')
      );
    }

    throw error;
  }
}
