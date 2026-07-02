import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { appConfig } from '@/shared/config/env';
import { translate } from '@/features/localization/i18n';

let initializationPromise: Promise<void> | null = null;

export class GoogleSignInError extends Error {
  code: 'unavailable' | 'missing_id_token' | 'cancelled';

  constructor(
    code: 'unavailable' | 'missing_id_token' | 'cancelled',
    message: string
  ) {
    super(message);
    this.name = 'GoogleSignInError';
    this.code = code;
  }
}

export function isNativeGoogleSignInSupported() {
  return Capacitor.isNativePlatform();
}

function getGoogleClientConfig() {
  const platform = Capacitor.getPlatform();

  if (platform === 'android') {
    return appConfig.googleWebClientId
      ? { webClientId: appConfig.googleWebClientId, mode: 'online' as const }
      : null;
  }

  if (platform === 'ios') {
    return appConfig.googleIosClientId
      ? {
          iOSClientId: appConfig.googleIosClientId,
          iOSServerClientId: appConfig.googleWebClientId ?? undefined,
          mode: 'online' as const,
        }
      : null;
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
    initializationPromise = SocialLogin.initialize({
      google: googleConfig,
    }).catch((error: unknown) => {
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
    (error as { code?: unknown }).code === 'USER_CANCELLED'
  );
}

export async function getNativeGoogleIdToken() {
  await initializeGoogleSignIn();

  try {
    const login = await SocialLogin.login({
      provider: 'google',
      options: {},
    });

    const result = login.result;
    const idToken =
      'idToken' in result &&
      typeof result.idToken === 'string' &&
      result.idToken.trim()
        ? result.idToken
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
