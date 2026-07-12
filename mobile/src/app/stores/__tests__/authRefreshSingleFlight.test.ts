import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  clearAuthTokens: vi.fn(),
  captureHandledError: vi.fn(),
  getCurrentUser: vi.fn(),
  logInRevenueCat: vi.fn(),
  logOutRevenueCat: vi.fn(),
  prepareSyncForAuthenticatedUser: vi.fn(),
  readOnboardingStorage: vi.fn(),
  readAuthTokens: vi.fn(),
  refreshSession: vi.fn(),
  resetSyncRuntimeState: vi.fn(),
  signIn: vi.fn(),
  signInWithGoogleIdToken: vi.fn(),
  signOut: vi.fn(),
  warnSafely: vi.fn(),
  writeAuthTokens: vi.fn(),
  writeOnboardingStorage: vi.fn(),
  getNativeGoogleIdToken: vi.fn(),
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
  refreshSession: mocks.refreshSession,
  register: vi.fn(),
  signIn: mocks.signIn,
  signInWithGoogleIdToken: mocks.signInWithGoogleIdToken,
  signOut: mocks.signOut,
}));

vi.mock('@/features/auth/googleSignInService', () => ({
  getNativeGoogleIdToken: mocks.getNativeGoogleIdToken,
}));

vi.mock('@/shared/services/authTokenStorageService', () => ({
  clearAuthTokens: mocks.clearAuthTokens,
  readAuthTokens: mocks.readAuthTokens,
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
  warnSafely: mocks.warnSafely,
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

const session = {
  user: {
    id: 'user-1',
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
  mocks.warnSafely.mockReset();
  mocks.writeAuthTokens.mockReset();
  mocks.writeOnboardingStorage.mockReset();
  mocks.getNativeGoogleIdToken.mockReset();

  mocks.signIn.mockResolvedValue(session);
  mocks.signInWithGoogleIdToken.mockResolvedValue(session);
  mocks.getCurrentUser.mockResolvedValue(session.user);
  mocks.logInRevenueCat.mockResolvedValue(undefined);
  mocks.logOutRevenueCat.mockResolvedValue(undefined);
  mocks.getNativeGoogleIdToken.mockResolvedValue('google-id-token');
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

describe('auth refresh single-flight guard', () => {
  it('dedupes concurrent refresh calls into a single backend request', async () => {
    const authStore = useAuthStore();
    await authStore.applySession(session);
    mocks.refreshSession.mockClear();
    mocks.writeAuthTokens.mockClear();

    const deferred = createDeferred<typeof session>();
    mocks.refreshSession.mockReturnValue(deferred.promise);

    const first = authStore.refreshAuthenticatedSession();
    const second = authStore.refreshAuthenticatedSession();

    deferred.resolve({
      ...session,
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
      expiresAt: '2026-06-13T14:00:00.000Z',
    });

    const [firstToken, secondToken] = await Promise.all([first, second]);

    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(firstToken).toBe('rotated-access-token');
    expect(secondToken).toBe('rotated-access-token');
    expect(mocks.writeAuthTokens).toHaveBeenCalledTimes(1);
    expect(mocks.writeAuthTokens).toHaveBeenCalledWith({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
      expiresAt: '2026-06-13T14:00:00.000Z',
    });
  });

  it('resets the guard after a successful refresh so later calls hit the backend again', async () => {
    const authStore = useAuthStore();
    await authStore.applySession(session);
    mocks.refreshSession.mockClear();

    await authStore.refreshAuthenticatedSession();
    await authStore.refreshAuthenticatedSession();

    expect(mocks.refreshSession).toHaveBeenCalledTimes(2);
  });

  it('shares a single failure across concurrent callers and clears the session', async () => {
    const authStore = useAuthStore();
    await authStore.applySession(session);
    mocks.refreshSession.mockClear();
    mocks.clearAuthTokens.mockClear();

    const deferred = createDeferred<typeof session>();
    mocks.refreshSession.mockReturnValue(deferred.promise);

    const first = authStore.refreshAuthenticatedSession();
    const second = authStore.refreshAuthenticatedSession();

    deferred.reject(new ApiClientError('expired', { status: 401 }));

    const [firstToken, secondToken] = await Promise.all([first, second]);

    expect(firstToken).toBeNull();
    expect(secondToken).toBeNull();
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mocks.clearAuthTokens).toHaveBeenCalled();
    expect(authStore.authStatus).toBe('idle');
  });

  it('resets the guard after a failed refresh so a later call hits the backend again', async () => {
    const authStore = useAuthStore();
    await authStore.applySession(session);
    mocks.refreshSession.mockClear();

    mocks.refreshSession.mockRejectedValueOnce(
      new ApiClientError('expired', { status: 401 })
    );
    await authStore.refreshAuthenticatedSession();

    mocks.refreshSession.mockRejectedValueOnce(
      new ApiClientError('expired again', { status: 401 })
    );
    await authStore.refreshAuthenticatedSession();

    expect(mocks.refreshSession).toHaveBeenCalledTimes(2);
  });
});
