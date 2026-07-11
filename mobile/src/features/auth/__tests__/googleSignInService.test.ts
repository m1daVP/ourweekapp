import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPlatform: vi.fn(),
  initialize: vi.fn(),
  isNativePlatform: vi.fn(),
  login: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: mocks.getPlatform,
    isNativePlatform: mocks.isNativePlatform,
  },
}));

vi.mock('@capgo/capacitor-social-login', () => ({
  SocialLogin: {
    initialize: mocks.initialize,
    login: mocks.login,
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
  mocks.login.mockReset();

  mocks.getPlatform.mockReturnValue('android');
  mocks.initialize.mockResolvedValue(undefined);
  mocks.isNativePlatform.mockReturnValue(true);
  mocks.login.mockResolvedValue({
    provider: 'google',
    result: {
      accessToken: { token: 'google-access-token' },
      idToken: 'google-id-token',
      profile: {
        email: 'rita@example.com',
        familyName: null,
        givenName: 'Rita',
        id: 'google-user',
        name: 'Rita',
        imageUrl: null,
      },
      responseType: 'online',
    },
  });
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

  it('returns the Google ID token from result.idToken', async () => {
    const { getNativeGoogleIdToken } = await loadService();

    await expect(getNativeGoogleIdToken()).resolves.toBe('google-id-token');
    expect(mocks.initialize).toHaveBeenCalledWith({
      google: {
        webClientId: 'web-client-id',
        mode: 'online',
      },
    });
    expect(mocks.login).toHaveBeenCalledWith({
      provider: 'google',
      options: {},
    });
  });

  it('returns the Google ID token when the plugin omits responseType', async () => {
    mocks.login.mockResolvedValue({
      provider: 'google',
      result: {
        idToken: 'google-id-token',
      },
    });
    const { getNativeGoogleIdToken } = await loadService();

    await expect(getNativeGoogleIdToken()).resolves.toBe('google-id-token');
  });

  it('rejects missing Google ID tokens', async () => {
    mocks.login.mockResolvedValue({
      provider: 'google',
      result: {
        serverAuthCode: 'server-auth-code',
        responseType: 'offline',
      },
    });
    const { getNativeGoogleIdToken } = await loadService();

    await expect(getNativeGoogleIdToken()).rejects.toMatchObject({
      code: 'missing_id_token',
    });
  });
});
