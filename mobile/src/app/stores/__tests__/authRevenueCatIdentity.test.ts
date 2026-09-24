import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  logInRevenueCat: vi.fn(),
  prepareSyncForAuthenticatedUser: vi.fn(),
  writeAuthTokens: vi.fn(),
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/shared/api/httpClient', () => ({
  ApiClientError: class ApiClientError extends Error {},
  setApiAuthHandlers: vi.fn(),
}));

vi.mock('@/shared/api/authApi', () => ({
  getCurrentUser: vi.fn(),
  refreshSession: vi.fn(),
  register: vi.fn(),
  signIn: vi.fn(),
  signInWithGoogleIdToken: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/features/auth/googleSignInService', () => ({
  getNativeGoogleIdToken: vi.fn(),
}));

vi.mock('@/shared/services/authTokenStorageService', () => ({
  clearAuthTokens: vi.fn(),
  clearPendingInvitationToken: vi.fn(),
  readAuthTokens: vi.fn(),
  readPendingInvitationToken: vi.fn().mockResolvedValue(null),
  writeAuthTokens: mocks.writeAuthTokens,
}));

vi.mock('@/shared/services/storageService', () => ({
  readOnboardingStorage: (_key: string, fallback: unknown) => fallback,
  writeOnboardingStorage: vi.fn(),
}));

vi.mock('@/shared/services/errorMonitoringService', () => ({
  captureHandledError: vi.fn(),
}));

vi.mock('@/shared/services/safeLogService', () => ({
  debugSafely: vi.fn(),
  warnSafely: vi.fn(),
}));

vi.mock('@/shared/services/syncSessionService', () => ({
  clearSyncSessionState: vi.fn(),
  prepareSyncForAuthenticatedUser: mocks.prepareSyncForAuthenticatedUser,
}));

vi.mock('@/features/subscription/services/revenueCatService', () => ({
  logInRevenueCat: mocks.logInRevenueCat,
  logOutRevenueCat: vi.fn(),
}));

vi.mock('@/shared/config/env', () => ({
  appConfig: { googleWebClientId: undefined },
}));

import { useAuthStore } from '@/app/stores/auth';
import type { AuthSessionDto } from '@/shared/api/authApi';

function session(workspaceId?: string): AuthSessionDto {
  return {
    user: {
      id: 'user-1',
      workspaceId,
      email: 'rita@example.com',
      displayName: 'Rita',
      role: 'owner',
      planType: 'free',
      createdAt: '2026-07-12T10:00:00.000Z',
      updatedAt: '2026-07-12T10:00:00.000Z',
    },
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: '2026-07-12T11:00:00.000Z',
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

describe('RevenueCat auth identity', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.logInRevenueCat.mockResolvedValue(undefined);
    mocks.writeAuthTokens.mockResolvedValue(undefined);
  });

  it('uses workspace identity for RevenueCat and user identity for sync', async () => {
    await useAuthStore().applySession(session('workspace-1'));

    expect(mocks.logInRevenueCat).toHaveBeenCalledWith('workspace-1');
    expect(mocks.logInRevenueCat).not.toHaveBeenCalledWith('user-1');
    expect(mocks.prepareSyncForAuthenticatedUser).toHaveBeenCalledWith(
      'user-1',
      'owner'
    );
  });

  it('skips RevenueCat login for persisted sessions without a workspace id', async () => {
    await useAuthStore().applySession(session());

    expect(mocks.logInRevenueCat).not.toHaveBeenCalled();
    expect(mocks.prepareSyncForAuthenticatedUser).toHaveBeenCalledWith(
      'user-1',
      'owner'
    );
  });

  it('does not block authentication on a pending RevenueCat login', async () => {
    const revenueCatLogin = createDeferred<void>();
    mocks.logInRevenueCat.mockReturnValue(revenueCatLogin.promise);
    const authStore = useAuthStore();

    await authStore.applySession(session('workspace-1'));

    expect(authStore.authStatus).toBe('authenticated');
    expect(authStore.isAuthenticated).toBe(true);

    revenueCatLogin.resolve();
  });
});
