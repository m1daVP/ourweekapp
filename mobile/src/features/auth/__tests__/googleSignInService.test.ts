import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPlatform: vi.fn(),
  initialize: vi.fn(),
  isNativePlatform: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: mocks.getPlatform,
    isNativePlatform: mocks.isNativePlatform,
  },
}));

vi.mock('@capawesome/capacitor-google-sign-in', () => ({
  ErrorCode: {
    SignInCanceled: 'SIGN_IN_CANCELED',
  },
  GoogleSignIn: {
    initialize: mocks.initialize,
    signIn: mocks.signIn,
  },
}));

vi.mock('@/shared/config/env', () => ({
  appConfig: {
    googleWebClientId: 'web-client-id',
    googleIosClientId: 'ios-client-id',
  },
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

async function loadService() {
  vi.resetModules();
  return import('@/features/auth/googleSignInService');
}

beforeEach(() => {
  mocks.getPlatform.mockReset();
  mocks.initialize.mockReset();
  mocks.isNativePlatform.mockReset();
  mocks.signIn.mockReset();

  mocks.getPlatform.mockReturnValue('android');
  mocks.initialize.mockResolvedValue(undefined);
  mocks.isNativePlatform.mockReturnValue(true);
  mocks.signIn.mockResolvedValue({
    idToken: 'google-id-token',
    userId: 'google-user',
    email: 'rita@example.com',
    displayName: 'Rita',
    givenName: 'Rita',
    familyName: null,
    imageUrl: null,
    accessToken: null,
    serverAuthCode: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('googleSignInService', () => {
  it('rejects browser use before initializing the native plugin', async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    const { getNativeGoogleIdToken } = await loadService();

    await expect(getNativeGoogleIdToken()).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(mocks.initialize).not.toHaveBeenCalled();
  });

  it('returns the Google ID token without requesting OAuth scopes', async () => {
    const { getNativeGoogleIdToken } = await loadService();

    await expect(getNativeGoogleIdToken()).resolves.toBe('google-id-token');
    expect(mocks.initialize).toHaveBeenCalledWith({
      clientId: 'web-client-id',
    });
    expect(mocks.signIn).toHaveBeenCalledWith();
  });

  it('rejects missing Google ID tokens', async () => {
    mocks.signIn.mockResolvedValue({ idToken: '' });
    const { getNativeGoogleIdToken } = await loadService();

    await expect(getNativeGoogleIdToken()).rejects.toMatchObject({
      code: 'missing_id_token',
    });
  });

  it('maps native cancellation to a safe auth error', async () => {
    mocks.signIn.mockRejectedValue({ code: 'SIGN_IN_CANCELED' });
    const { getNativeGoogleIdToken } = await loadService();

    await expect(getNativeGoogleIdToken()).rejects.toMatchObject({
      code: 'cancelled',
    });
  });

  it('times out provider initialization after 10 seconds and allows retry', async () => {
    vi.useFakeTimers();
    mocks.initialize.mockReturnValueOnce(new Promise(() => undefined));
    const { getNativeGoogleIdToken } = await loadService();

    const firstAttempt = getNativeGoogleIdToken();
    const firstResult = expect(firstAttempt).rejects.toMatchObject({
      code: 'timed_out',
      message: 'auth.googleProviderTimedOut',
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await firstResult;
    expect(mocks.signIn).not.toHaveBeenCalled();

    mocks.initialize.mockResolvedValueOnce(undefined);
    await expect(getNativeGoogleIdToken()).resolves.toBe('google-id-token');
    expect(mocks.initialize).toHaveBeenCalledTimes(2);
  });

  it('times out native account selection after 60 seconds', async () => {
    vi.useFakeTimers();
    mocks.signIn.mockReturnValue(new Promise(() => undefined));
    const { getNativeGoogleIdToken } = await loadService();

    const signInAttempt = getNativeGoogleIdToken();
    const result = expect(signInAttempt).rejects.toMatchObject({
      code: 'timed_out',
      message: 'auth.googleProviderTimedOut',
    });
    await vi.advanceTimersByTimeAsync(60_000);

    await result;
  });
});
