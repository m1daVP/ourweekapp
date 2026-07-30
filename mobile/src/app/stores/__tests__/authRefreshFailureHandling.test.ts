import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clearAuthTokens: vi.fn(),
  logInRevenueCat: vi.fn(),
  logOutRevenueCat: vi.fn(),
  prepareSyncForAuthenticatedUser: vi.fn(),
  readAuthTokens: vi.fn(),
  readOnboardingStorage: vi.fn(),
  refreshSession: vi.fn(),
  resetSyncRuntimeState: vi.fn(),
  writeAuthTokens: vi.fn(),
  writeOnboardingStorage: vi.fn(),
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
  getCurrentUser: vi.fn(),
  refreshSession: mocks.refreshSession,
  register: vi.fn(),
  signIn: vi.fn(),
  signInWithGoogleIdToken: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/features/auth/googleSignInService', () => ({
  getNativeGoogleIdToken: vi.fn(),
}));

vi.mock('@/shared/services/authTokenStorageService', () => ({
  clearAuthTokens: mocks.clearAuthTokens,
  readAuthTokens: mocks.readAuthTokens,
  writeAuthTokens: mocks.writeAuthTokens,
}));

vi.mock('@/shared/services/errorMonitoringService', () => ({
  captureHandledError: vi.fn(),
}));

vi.mock('@/shared/services/storageService', () => ({
  readOnboardingStorage: mocks.readOnboardingStorage,
  writeOnboardingStorage: mocks.writeOnboardingStorage,
}));

vi.mock('@/shared/services/safeLogService', () => ({
  debugSafely: vi.fn(),
  warnSafely: vi.fn(),
}));

vi.mock('@/shared/services/syncSessionService', () => ({
  prepareSyncForAuthenticatedUser: mocks.prepareSyncForAuthenticatedUser,
  resetSyncRuntimeState: mocks.resetSyncRuntimeState,
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

const session = {
  user: {
    id: 'user-1',
    workspaceId: 'workspace-1',
    email: 'rita@example.com',
    displayName: 'Rita',
    role: 'owner',
    planType: 'free',
    createdAt: '2026-06-13T12:00:00.000Z',
    updatedAt: '2026-06-13T12:00:00.000Z',
  },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: '2026-06-13T13:00:00.000Z',
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

async function createAuthenticatedStore() {
  const authStore = useAuthStore();
  await authStore.applySession(session);
  mocks.clearAuthTokens.mockClear();
  mocks.refreshSession.mockClear();
  mocks.resetSyncRuntimeState.mockClear();
  return authStore;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();

  mocks.readAuthTokens.mockResolvedValue({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
  });
  mocks.readOnboardingStorage.mockImplementation(
    (_: string, fallback: unknown) => fallback
  );
  mocks.logInRevenueCat.mockResolvedValue(undefined);
  mocks.logOutRevenueCat.mockResolvedValue(undefined);
});

describe('auth refresh failure handling', () => {
  it('keeps the authenticated session when a network error interrupts refresh', async () => {
    const authStore = await createAuthenticatedStore();
    const error = new TypeError('Network request failed');
    mocks.refreshSession.mockRejectedValue(error);

    await expect(authStore.refreshAuthenticatedSession()).rejects.toBe(error);

    expect(mocks.clearAuthTokens).not.toHaveBeenCalled();
    expect(mocks.resetSyncRuntimeState).not.toHaveBeenCalled();
    expect(authStore.authStatus).toBe('authenticated');
    expect(authStore.user?.id).toBe('user-1');
  });

  it.each([500, 429])(
    'keeps the authenticated session for an API %s refresh response',
    async (status) => {
      const authStore = await createAuthenticatedStore();
      const error = new ApiClientError('Refresh unavailable', { status });
      mocks.refreshSession.mockRejectedValue(error);

      await expect(authStore.refreshAuthenticatedSession()).rejects.toBe(error);

      expect(mocks.clearAuthTokens).not.toHaveBeenCalled();
      expect(mocks.resetSyncRuntimeState).not.toHaveBeenCalled();
      expect(authStore.authStatus).toBe('authenticated');
      expect(authStore.user?.id).toBe('user-1');
    }
  );

  it.each([401, 422])(
    'clears the session for an API %s refresh response',
    async (status) => {
      const authStore = await createAuthenticatedStore();
      mocks.refreshSession.mockRejectedValue(
        new ApiClientError('Refresh token rejected', { status })
      );

      await expect(authStore.refreshAuthenticatedSession()).resolves.toBeNull();

      expect(mocks.clearAuthTokens).toHaveBeenCalled();
      expect(mocks.resetSyncRuntimeState).toHaveBeenCalled();
      expect(authStore.authStatus).toBe('idle');
      expect(authStore.user).toBeNull();
    }
  );

  it('shares a transient rejection and resets the single-flight guard afterward', async () => {
    const authStore = await createAuthenticatedStore();
    const deferred = createDeferred<typeof session>();
    const error = new TypeError('Network request failed');
    mocks.refreshSession.mockReturnValueOnce(deferred.promise);

    const first = authStore.refreshAuthenticatedSession();
    const second = authStore.refreshAuthenticatedSession();
    const resultsPromise = Promise.allSettled([first, second]);
    deferred.reject(error);

    const results = await resultsPromise;
    expect(results).toEqual([
      { status: 'rejected', reason: error },
      { status: 'rejected', reason: error },
    ]);
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mocks.clearAuthTokens).not.toHaveBeenCalled();

    mocks.refreshSession.mockResolvedValueOnce({
      ...session,
      accessToken: 'rotated-access-token',
    });
    await expect(authStore.refreshAuthenticatedSession()).resolves.toBe(
      'rotated-access-token'
    );
    expect(mocks.refreshSession).toHaveBeenCalledTimes(2);
  });
});
