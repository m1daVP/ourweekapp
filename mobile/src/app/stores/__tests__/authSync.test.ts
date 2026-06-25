import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  clearAuthTokens: vi.fn(),
  prepareSyncForAuthenticatedUser: vi.fn(),
  readOnboardingStorage: vi.fn(),
  readAuthTokens: vi.fn(),
  refreshSession: vi.fn(),
  resetSyncRuntimeState: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  writeAuthTokens: vi.fn(),
  writeOnboardingStorage: vi.fn(),
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/shared/api/httpClient', () => ({
  ApiClientError: class ApiClientError extends Error {
    status?: number;
  },
  setApiAuthHandlers: vi.fn(),
}));

vi.mock('@/shared/api/authApi', () => ({
  getCurrentUser: vi.fn(),
  refreshSession: mocks.refreshSession,
  register: vi.fn(),
  signIn: mocks.signIn,
  signOut: mocks.signOut,
}));

vi.mock('@/shared/services/authTokenStorageService', () => ({
  clearAuthTokens: mocks.clearAuthTokens,
  readAuthTokens: mocks.readAuthTokens,
  writeAuthTokens: mocks.writeAuthTokens,
}));

vi.mock('@/shared/services/storageService', () => ({
  readOnboardingStorage: mocks.readOnboardingStorage,
  writeOnboardingStorage: mocks.writeOnboardingStorage,
}));

vi.mock('@/shared/services/safeLogService', () => ({
  warnSafely: vi.fn(),
}));

vi.mock('@/shared/services/syncSessionService', () => ({
  prepareSyncForAuthenticatedUser: mocks.prepareSyncForAuthenticatedUser,
  resetSyncRuntimeState: mocks.resetSyncRuntimeState,
}));

import { useAuthStore } from '@/app/stores/auth';

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
  mocks.prepareSyncForAuthenticatedUser.mockReset();
  mocks.readAuthTokens.mockReset();
  mocks.readOnboardingStorage.mockReset();
  mocks.refreshSession.mockReset();
  mocks.resetSyncRuntimeState.mockReset();
  mocks.signIn.mockReset();
  mocks.signOut.mockReset();
  mocks.writeAuthTokens.mockReset();
  mocks.writeOnboardingStorage.mockReset();

  mocks.signIn.mockResolvedValue(session);
  mocks.refreshSession.mockResolvedValue({
    ...session,
    accessToken: 'rotated-access-token',
    refreshToken: 'rotated-refresh-token',
  });
  mocks.readAuthTokens.mockResolvedValue({ refreshToken: 'refresh-token' });
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
      'user-1'
    );
    expect(authStore.user?.id).toBe('user-1');
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
    });
    expect(authStore.authStatus).toBe('authenticated');
  });

  it('clears tokens and auth state when refresh fails', async () => {
    const authStore = useAuthStore();

    await authStore.applySession(session);
    mocks.refreshSession.mockRejectedValue(new Error('expired'));

    const accessToken = await authStore.refreshAuthenticatedSession();

    expect(accessToken).toBeNull();
    expect(mocks.clearAuthTokens).toHaveBeenCalled();
    expect(mocks.resetSyncRuntimeState).toHaveBeenCalled();
    expect(authStore.authStatus).toBe('idle');
    expect(authStore.user).toBeNull();
  });
});
