import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  clearAuthTokens: vi.fn(),
  clearPendingInvitationToken: vi.fn(),
  captureHandledError: vi.fn(),
  getCurrentUser: vi.fn(),
  logInRevenueCat: vi.fn(),
  logOutRevenueCat: vi.fn(),
  prepareSyncForAuthenticatedUser: vi.fn(),
  readOnboardingStorage: vi.fn(),
  readAuthTokens: vi.fn(),
  readPendingInvitationToken: vi.fn().mockResolvedValue(null),
  refreshSession: vi.fn(),
  resetSyncRuntimeState: vi.fn(),
  signIn: vi.fn(),
  signInWithGoogleIdToken: vi.fn(),
  signOut: vi.fn(),
  debugSafely: vi.fn(),
  warnSafely: vi.fn(),
  writeAuthTokens: vi.fn(),
  writeOnboardingStorage: vi.fn(),
  getNativeGoogleIdToken: vi.fn(),
  linkGoogleAccountWithIdToken: vi.fn(),
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/shared/api/httpClient', () => ({
  ApiClientError: class ApiClientError extends Error {
    status?: number;
    code?: string;
    details?: unknown;

    constructor(
      message: string,
      options: { status?: number; code?: string; details?: unknown } = {}
    ) {
      super(message);
      this.name = 'ApiClientError';
      this.status = options.status;
      this.code = options.code;
      this.details = options.details;
    }
  },
  setApiAuthHandlers: vi.fn(),
}));

vi.mock('@/shared/api/authApi', () => ({
  getCurrentUser: mocks.getCurrentUser,
  linkGoogleAccountWithIdToken: mocks.linkGoogleAccountWithIdToken,
  refreshSession: mocks.refreshSession,
  register: vi.fn(),
  signIn: mocks.signIn,
  signInWithGoogleIdToken: mocks.signInWithGoogleIdToken,
  signOut: mocks.signOut,
}));

vi.mock('@/features/auth/googleSignInService', () => ({
  GoogleSignInError: class GoogleSignInError extends Error {
    constructor(
      public code: string,
      message: string
    ) {
      super(message);
      this.name = 'GoogleSignInError';
    }
  },
  getNativeGoogleIdToken: mocks.getNativeGoogleIdToken,
}));

vi.mock('@/shared/services/authTokenStorageService', () => ({
  clearAuthTokens: mocks.clearAuthTokens,
  clearPendingInvitationToken: mocks.clearPendingInvitationToken,
  readAuthTokens: mocks.readAuthTokens,
  readPendingInvitationToken: mocks.readPendingInvitationToken,
  writeAuthTokens: mocks.writeAuthTokens,
}));

vi.mock('@/shared/services/errorMonitoringService', () => ({
  captureHandledError: mocks.captureHandledError,
}));

vi.mock('@/shared/services/storageService', () => ({
  readOnboardingStorage: mocks.readOnboardingStorage,
  writeOnboardingStorage: mocks.writeOnboardingStorage,
}));

vi.mock('@/shared/services/safeLogService', () => ({
  debugSafely: mocks.debugSafely,
  warnSafely: mocks.warnSafely,
}));

vi.mock('@/shared/services/syncSessionService', () => ({
  clearSyncSessionState: mocks.resetSyncRuntimeState,
  prepareSyncForAuthenticatedUser: mocks.prepareSyncForAuthenticatedUser,
}));

vi.mock('@/features/subscription/services/revenueCatService', () => ({
  logInRevenueCat: mocks.logInRevenueCat,
  logOutRevenueCat: mocks.logOutRevenueCat,
}));

vi.mock('@/shared/config/env', () => ({
  appConfig: {
    googleWebClientId: 'expected-web-client-id.apps.googleusercontent.com',
  },
}));

import { useAuthStore } from '@/app/stores/auth';
import { ApiClientError } from '@/shared/api/httpClient';

function createJwtPayload(payload: Record<string, unknown>) {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createUnsignedJwt(payload: Record<string, unknown>) {
  return `header.${createJwtPayload(payload)}.signature`;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

async function waitUntil(assertion: () => void) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  throw lastError;
}

const session = {
  user: {
    id: 'user-1',
    email: 'rita@example.com',
    displayName: 'Rita',
    role: 'owner',
    planType: 'free',
    signInMethods: ['password'] as const,
    createdAt: '2026-06-13T12:00:00.000Z',
    updatedAt: '2026-06-13T12:00:00.000Z',
  },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: '2026-06-13T13:00:00.000Z',
};

const cachedUser = {
  id: 'cached-user',
  email: 'cached@example.com',
  displayName: 'Cached User',
  plan: 'free',
  createdAt: '2026-06-01T10:00:00.000Z',
} as const;

const storedAuthenticatedState = {
  version: 3,
  user: cachedUser,
  authStatus: 'authenticated',
};

beforeEach(() => {
  setActivePinia(createPinia());

  mocks.clearAuthTokens.mockReset();
  mocks.captureHandledError.mockReset();
  mocks.getCurrentUser.mockReset();
  mocks.logInRevenueCat.mockReset();
  mocks.logOutRevenueCat.mockReset();
  mocks.prepareSyncForAuthenticatedUser.mockReset();
  mocks.readAuthTokens.mockReset();
  mocks.readOnboardingStorage.mockReset();
  mocks.refreshSession.mockReset();
  mocks.resetSyncRuntimeState.mockReset();
  mocks.signIn.mockReset();
  mocks.signInWithGoogleIdToken.mockReset();
  mocks.signOut.mockReset();
  mocks.debugSafely.mockReset();
  mocks.warnSafely.mockReset();
  mocks.writeAuthTokens.mockReset();
  mocks.writeOnboardingStorage.mockReset();
  mocks.getNativeGoogleIdToken.mockReset();
  mocks.linkGoogleAccountWithIdToken.mockReset();

  mocks.signIn.mockResolvedValue(session);
  mocks.signInWithGoogleIdToken.mockResolvedValue(session);
  mocks.getCurrentUser.mockResolvedValue(session.user);
  mocks.logInRevenueCat.mockResolvedValue(undefined);
  mocks.logOutRevenueCat.mockResolvedValue(undefined);
  mocks.getNativeGoogleIdToken.mockResolvedValue('google-id-token');
  mocks.linkGoogleAccountWithIdToken.mockResolvedValue({
    ...session.user,
    signInMethods: ['password', 'google'],
  });
  mocks.refreshSession.mockResolvedValue({
    ...session,
    accessToken: 'rotated-access-token',
    refreshToken: 'rotated-refresh-token',
    expiresAt: '2026-06-13T14:00:00.000Z',
  });
  mocks.readAuthTokens.mockResolvedValue({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: '2026-06-13T13:00:00.000Z',
  });
  mocks.readOnboardingStorage.mockImplementation(
    (_: string, fallback: unknown) => fallback
  );
});

describe('auth sync safety hooks', () => {
  it('migrates legacy local-only auth state to signed out', () => {
    mocks.readOnboardingStorage.mockReturnValue({
      version: 2,
      user: null,
      authStatus: 'localOnly',
    });

    const authStore = useAuthStore();

    expect(authStore.authStatus).toBe('idle');
    expect(authStore.user).toBeNull();
  });

  it('prepares sync ownership before applying a signed-in session', async () => {
    const authStore = useAuthStore();

    await authStore.signIn({
      email: 'rita@example.com',
      password: 'password123',
    });

    expect(mocks.prepareSyncForAuthenticatedUser).toHaveBeenCalledWith(
      'user-1',
      'owner'
    );
    expect(authStore.user?.id).toBe('user-1');
  });

  it('uses native Google Sign-In and applies the backend session', async () => {
    const authStore = useAuthStore();

    const didSignIn = await authStore.signInWithGoogle();

    expect(didSignIn).toBe(true);
    expect(mocks.getNativeGoogleIdToken).toHaveBeenCalled();
    expect(mocks.signInWithGoogleIdToken).toHaveBeenCalledWith(
      {
        idToken: 'google-id-token',
      },
      expect.any(AbortSignal)
    );
    expect(mocks.writeAuthTokens).toHaveBeenCalledWith({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-06-13T13:00:00.000Z',
    });
    expect(mocks.prepareSyncForAuthenticatedUser).toHaveBeenCalledWith(
      'user-1',
      'owner'
    );
    expect(authStore.authStatus).toBe('authenticated');
    expect(authStore.authOperationStage).toBe('session_commit');
  });

  it('links Google to the active account and keeps password access', async () => {
    const authStore = useAuthStore();
    await authStore.applySession(session);
    mocks.clearAuthTokens.mockClear();

    await expect(authStore.linkGoogleAccount()).resolves.toBe('linked');

    expect(mocks.linkGoogleAccountWithIdToken).toHaveBeenCalledWith({
      idToken: 'google-id-token',
    });
    expect(authStore.user?.signInMethods).toEqual(['password', 'google']);
    expect(authStore.authStatus).toBe('authenticated');
    expect(mocks.clearAuthTokens).not.toHaveBeenCalled();
  });

  it('keeps the active session when Google linking is rejected', async () => {
    const authStore = useAuthStore();
    await authStore.applySession(session);
    mocks.clearAuthTokens.mockClear();
    mocks.linkGoogleAccountWithIdToken.mockRejectedValue(
      new ApiClientError('Different email', {
        status: 409,
        code: 'account_link_email_mismatch',
      })
    );

    await expect(authStore.linkGoogleAccount()).resolves.toBe('failed');

    expect(authStore.googleLinkErrorMessage).toBe(
      'account.googleLinkEmailMismatch'
    );
    expect(authStore.authStatus).toBe('authenticated');
    expect(authStore.user?.signInMethods).toEqual(['password']);
    expect(mocks.clearAuthTokens).not.toHaveBeenCalled();
  });

  it('clears partial auth state when Google Sign-In fails', async () => {
    const authStore = useAuthStore();

    mocks.signInWithGoogleIdToken.mockRejectedValue(new Error('failed'));

    const didSignIn = await authStore.signInWithGoogle();

    expect(didSignIn).toBe(false);
    expect(mocks.clearAuthTokens).toHaveBeenCalled();
    expect(authStore.authStatus).toBe('error');
    expect(authStore.user).toBeNull();
  });

  it('exits loading when the native Google provider times out', async () => {
    const authStore = useAuthStore();
    const timeoutError = Object.assign(
      new Error('auth.googleProviderTimedOut'),
      {
        code: 'timed_out',
        name: 'GoogleSignInError',
      }
    );
    mocks.getNativeGoogleIdToken.mockRejectedValue(timeoutError);

    await expect(authStore.signInWithGoogle()).resolves.toBe(false);
    expect(authStore.authStatus).toBe('error');
    expect(authStore.authOperationStage).toBe('google_provider');
    expect(authStore.errorMessage).toBe('auth.googleProviderTimedOut');
    expect(mocks.signInWithGoogleIdToken).not.toHaveBeenCalled();
  });

  it('shows a clearer message and logs debug metadata when backend rejects a Google token', async () => {
    const authStore = useAuthStore();
    const googleIdToken = createUnsignedJwt({
      iss: 'https://accounts.google.com',
      aud: 'other-web-client-id.apps.googleusercontent.com',
      exp: 2_000_000_000,
      iat: 1_999_999_000,
      email: 'rita@example.com',
    });

    mocks.getNativeGoogleIdToken.mockResolvedValue(googleIdToken);

    mocks.signInWithGoogleIdToken.mockRejectedValue(
      new ApiClientError('Invalid Google token', {
        status: 422,
        code: 'invalid_google_token',
        details: { reason: 'audience_mismatch' },
      })
    );

    const didSignIn = await authStore.signInWithGoogle();

    expect(didSignIn).toBe(false);
    expect(authStore.errorMessage).toBe('auth.googleTokenRejected');
    const expectedAuthError = {
      source: 'google',
      stage: 'backend_exchange',
      status: 422,
      code: 'invalid_google_token',
      hasDetails: true,
      googleToken: {
        payloadReadable: true,
        issuer: 'https://accounts.google.com',
        audienceLength: 46,
        audienceSuffix: 'tent.com',
        audienceFingerprint: expect.any(String),
        expectedAudienceLength: 49,
        expectedAudienceSuffix: 'tent.com',
        expectedAudienceFingerprint: expect.any(String),
        audienceMatchesConfiguredClient: false,
        expiresAt: '2033-05-18T03:33:20.000Z',
        issuedAt: '2033-05-18T03:16:40.000Z',
        isExpired: false,
      },
    };

    expect(authStore.lastAuthError).toEqual(expectedAuthError);
    expect(authStore.lastAuthError).not.toEqual(
      expect.objectContaining({
        idToken: googleIdToken,
        email: 'rita@example.com',
      })
    );
    expect(mocks.captureHandledError).toHaveBeenCalledWith(
      expect.any(ApiClientError),
      {
        tags: {
          feature: 'auth',
          provider: 'google',
          stage: 'backend_exchange',
        },
        extra: {
          authError: expectedAuthError,
        },
      }
    );
    expect(mocks.warnSafely).toHaveBeenCalledWith('Google sign-in failed.', {
      errorCategory: 'invalid_google_token',
      stage: 'backend_exchange',
      status: 422,
    });
  });

  it('returns the failed stage without waiting for secure-token cleanup', async () => {
    const authStore = useAuthStore();
    const cleanup = createDeferred<void>();
    mocks.signInWithGoogleIdToken.mockRejectedValue(new Error('failed'));
    mocks.clearAuthTokens.mockReturnValue(cleanup.promise);

    const signInPromise = authStore.signInWithGoogle();

    await waitUntil(() => {
      expect(authStore.authStatus).toBe('error');
    });
    expect(authStore.authOperationStage).toBe('backend_exchange');

    await expect(signInPromise).resolves.toBe(false);
    cleanup.resolve();
  });

  it('aborts a Google backend exchange after 20 seconds', async () => {
    vi.useFakeTimers();
    const authStore = useAuthStore();

    mocks.signInWithGoogleIdToken.mockImplementation(
      (_payload: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(
              new DOMException('The operation was aborted.', 'AbortError')
            );
          });
        })
    );

    try {
      const signInPromise = authStore.signInWithGoogle();
      await vi.advanceTimersByTimeAsync(20_000);

      await expect(signInPromise).resolves.toBe(false);
      expect(authStore.authStatus).toBe('error');
      expect(authStore.authOperationStage).toBe('backend_exchange');
      expect(authStore.errorMessage).toBe('auth.googleRequestTimedOut');
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels provider selection and ignores its late response', async () => {
    const authStore = useAuthStore();
    const providerResult = createDeferred<string>();
    mocks.getNativeGoogleIdToken.mockReturnValue(providerResult.promise);

    const signInPromise = authStore.signInWithGoogle();
    await waitUntil(() => {
      expect(authStore.authOperationStage).toBe('google_provider');
    });

    expect(authStore.cancelPendingGoogleSignIn()).toBe(true);
    expect(authStore.authStatus).toBe('idle');

    providerResult.resolve('late-google-id-token');
    await expect(signInPromise).resolves.toBe(false);
    expect(mocks.signInWithGoogleIdToken).not.toHaveBeenCalled();
    expect(mocks.writeAuthTokens).not.toHaveBeenCalled();
  });

  it('aborts the backend exchange when Google sign-in is cancelled', async () => {
    const authStore = useAuthStore();
    let backendSignal: AbortSignal | undefined;
    mocks.signInWithGoogleIdToken.mockImplementation(
      (_payload: unknown, signal: AbortSignal) => {
        backendSignal = signal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(
              new DOMException('The operation was aborted.', 'AbortError')
            );
          });
        });
      }
    );

    const signInPromise = authStore.signInWithGoogle();
    await waitUntil(() => {
      expect(authStore.authOperationStage).toBe('backend_exchange');
    });

    expect(authStore.cancelPendingGoogleSignIn()).toBe(true);
    expect(backendSignal?.aborted).toBe(true);
    await expect(signInPromise).resolves.toBe(false);
    expect(authStore.authStatus).toBe('idle');
    expect(mocks.writeAuthTokens).not.toHaveBeenCalled();
  });

  it('prevents a session commit when cancelled during token storage', async () => {
    const authStore = useAuthStore();
    const tokenWrite = createDeferred<void>();
    mocks.writeAuthTokens.mockReturnValue(tokenWrite.promise);

    const signInPromise = authStore.signInWithGoogle();
    await waitUntil(() => {
      expect(authStore.authOperationStage).toBe('token_storage');
    });

    expect(authStore.cancelPendingGoogleSignIn()).toBe(true);
    tokenWrite.resolve();

    await expect(signInPromise).resolves.toBe(false);
    expect(authStore.authStatus).toBe('idle');
    expect(authStore.user).toBeNull();
    expect(mocks.prepareSyncForAuthenticatedUser).not.toHaveBeenCalled();
    expect(mocks.clearAuthTokens).toHaveBeenCalled();
  });

  it('exits loading when secure token persistence rejects', async () => {
    const authStore = useAuthStore();
    mocks.writeAuthTokens.mockRejectedValue(new Error('storage failed'));

    const didSignIn = await authStore.signInWithGoogle();

    expect(didSignIn).toBe(false);
    expect(authStore.authStatus).toBe('error');
    expect(authStore.authOperationStage).toBe('token_storage');
    expect(authStore.lastAuthError).toMatchObject({
      source: 'google',
      stage: 'token_storage',
      name: 'Error',
    });
  });

  it('shows a secure-session message for categorized storage failures', async () => {
    const authStore = useAuthStore();
    mocks.writeAuthTokens.mockRejectedValue(
      Object.assign(new Error('internal storage error'), {
        code: 'secure_storage_timeout',
        name: 'AuthTokenStorageError',
      })
    );

    const didSignIn = await authStore.signInWithGoogle();

    expect(didSignIn).toBe(false);
    expect(authStore.authStatus).toBe('error');
    expect(authStore.authOperationStage).toBe('token_storage');
    expect(authStore.errorMessage).toBe('auth.secureSessionSaveFailed');
    expect(authStore.lastAuthError).toMatchObject({
      code: 'secure_storage_timeout',
      name: 'AuthTokenStorageError',
      source: 'google',
      stage: 'token_storage',
    });
  });

  it('uses the secure-session message for password sign-in storage failures', async () => {
    const authStore = useAuthStore();
    mocks.writeAuthTokens.mockRejectedValue(
      Object.assign(new Error('internal storage error'), {
        code: 'secure_storage_native_error',
        name: 'AuthTokenStorageError',
      })
    );

    const didSignIn = await authStore.signIn({
      email: 'rita@example.com',
      password: 'password123',
    });

    expect(didSignIn).toBe(false);
    expect(authStore.authStatus).toBe('error');
    expect(authStore.errorMessage).toBe('auth.secureSessionSaveFailed');
  });

  it('resets sync runtime state on logout cleanup', async () => {
    const authStore = useAuthStore();

    await authStore.applySession(session);
    await authStore.logout();

    expect(mocks.signOut).toHaveBeenCalledWith('refresh-token');
    expect(mocks.resetSyncRuntimeState).toHaveBeenCalled();
    expect(authStore.authStatus).toBe('idle');
  });

  it('stores rotated tokens after a refresh succeeds', async () => {
    const authStore = useAuthStore();

    await authStore.applySession(session);
    mocks.writeAuthTokens.mockClear();

    const accessToken = await authStore.refreshAuthenticatedSession();

    expect(mocks.refreshSession).toHaveBeenCalledWith({
      refreshToken: 'refresh-token',
    });
    expect(accessToken).toBe('rotated-access-token');
    expect(mocks.writeAuthTokens).toHaveBeenCalledWith({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
      expiresAt: '2026-06-13T14:00:00.000Z',
    });
    expect(authStore.authStatus).toBe('authenticated');
  });

  it('marks the session check pending without clearing cached auth state', async () => {
    mocks.readOnboardingStorage.mockReturnValue(storedAuthenticatedState);
    const deferred = createDeferred<typeof session.user>();
    mocks.getCurrentUser.mockReturnValue(deferred.promise);
    const authStore = useAuthStore();

    const verification = authStore.verifyCurrentUser();
    try {
      await waitUntil(() => {
        expect(authStore.sessionCheckStatus).toBe('checking');
      });

      expect(authStore.sessionCheckStatus).toBe('checking');
      expect(authStore.authStatus).toBe('authenticated');
      expect(authStore.user).toEqual(cachedUser);
    } finally {
      deferred.resolve(session.user);
    }

    await expect(verification).resolves.toBe(true);
  });

  it('updates the cached user when the session check succeeds', async () => {
    mocks.readOnboardingStorage.mockReturnValue(storedAuthenticatedState);
    const authStore = useAuthStore();

    await expect(authStore.verifyCurrentUser()).resolves.toBe(true);

    expect(mocks.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(authStore.sessionCheckStatus).toBe('verified');
    expect(authStore.hasVerifiedCurrentUser).toBe(true);
    expect(authStore.user?.id).toBe('user-1');
    expect(authStore.user?.email).toBe('rita@example.com');
  });

  it('clears sensitive session state when the session check is unauthorized', async () => {
    mocks.readOnboardingStorage.mockReturnValue(storedAuthenticatedState);
    mocks.getCurrentUser.mockRejectedValue(
      new ApiClientError('Unauthorized', { status: 401 })
    );
    const authStore = useAuthStore();

    await expect(authStore.verifyCurrentUser()).resolves.toBe(false);

    expect(mocks.clearAuthTokens).toHaveBeenCalled();
    expect(mocks.logOutRevenueCat).toHaveBeenCalled();
    expect(mocks.resetSyncRuntimeState).toHaveBeenCalled();
    expect(authStore.sessionCheckStatus).toBe('unauthorized');
    expect(authStore.authStatus).toBe('idle');
    expect(authStore.user).toBeNull();
  });

  it('keeps cached auth visible when the session check fails for network reasons', async () => {
    mocks.readOnboardingStorage.mockReturnValue(storedAuthenticatedState);
    mocks.getCurrentUser.mockRejectedValue(new Error('offline'));
    const authStore = useAuthStore();

    await expect(authStore.verifyCurrentUser()).resolves.toBe(true);

    expect(mocks.clearAuthTokens).not.toHaveBeenCalled();
    expect(authStore.sessionCheckStatus).toBe('failed');
    expect(authStore.sessionCheckErrorMessage).toBe(
      'auth.sessionCheckUnavailable'
    );
    expect(authStore.authStatus).toBe('authenticated');
    expect(authStore.user).toEqual(cachedUser);
  });

  it('deduplicates concurrent current-user session checks', async () => {
    mocks.readOnboardingStorage.mockReturnValue(storedAuthenticatedState);
    const deferred = createDeferred<typeof session.user>();
    mocks.getCurrentUser.mockReturnValue(deferred.promise);
    const authStore = useAuthStore();

    const firstVerification = authStore.verifyCurrentUser();
    const secondVerification = authStore.verifyCurrentUser();
    try {
      await waitUntil(() => {
        expect(mocks.getCurrentUser).toHaveBeenCalledTimes(1);
      });

      expect(mocks.getCurrentUser).toHaveBeenCalledTimes(1);
    } finally {
      deferred.resolve(session.user);
    }

    await expect(firstVerification).resolves.toBe(true);
    await expect(secondVerification).resolves.toBe(true);
    expect(authStore.sessionCheckStatus).toBe('verified');
  });

  it('clears tokens and auth state when refresh fails', async () => {
    const authStore = useAuthStore();

    await authStore.applySession(session);
    mocks.refreshSession.mockRejectedValue(
      new ApiClientError('expired', { status: 401 })
    );

    const accessToken = await authStore.refreshAuthenticatedSession();

    expect(accessToken).toBeNull();
    expect(mocks.clearAuthTokens).toHaveBeenCalled();
    expect(mocks.resetSyncRuntimeState).toHaveBeenCalled();
    expect(authStore.authStatus).toBe('idle');
    expect(authStore.user).toBeNull();
  });
});
