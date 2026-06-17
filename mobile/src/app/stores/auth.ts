import { defineStore } from 'pinia';
import { translate } from '@/features/localization/i18n';
import {
  getCurrentUser as getCurrentUserRequest,
  refreshSession as refreshSessionRequest,
  register as registerRequest,
  signIn as signInRequest,
  signOut as signOutRequest,
  type AuthUserDto,
  type AuthSessionDto,
} from '@/shared/api/authApi';
import { ApiClientError, setApiAuthHandlers } from '@/shared/api/httpClient';
import { useUserAccessStore } from '@/app/stores/userAccess';
import { appConfig } from '@/shared/config/env';
import {
  clearAuthTokens,
  readAuthTokens,
  writeAuthTokens,
  type AuthTokens,
} from '@/shared/services/authTokenStorageService';
import {
  readOnboardingStorage,
  writeOnboardingStorage,
} from '@/shared/services/storageService';
import { warnSafely } from '@/shared/services/safeLogService';
import {
  prepareSyncForAuthenticatedUser,
  resetSyncRuntimeState,
} from '@/shared/services/syncSessionService';
import {
  logInRevenueCat,
  logOutRevenueCat,
} from '@/features/subscription/services/revenueCatService';
import type {
  AuthStatus,
  AuthUser,
  SignInPayload,
  SignUpPayload,
} from '@/features/auth/types';

const STORAGE_VERSION = 2;
const LEGACY_AUTH_STORAGE_KEY = 'ourweek:auth';

interface StoredAuthState {
  version: number;
  user: AuthUser | null;
  authStatus: AuthStatus;
  accessToken?: string | null;
  refreshToken?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  authStatus: AuthStatus;
  errorMessage: string;
  hasHydratedSecureTokens: boolean;
  hasVerifiedCurrentUser: boolean;
}

let legacyTokensToMigrate: AuthTokens = {
  accessToken: null,
  refreshToken: null,
};

function readLegacyAuthTokensFromLocalStorage(): AuthTokens {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null };
  }

  try {
    const rawValue = window.localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);

    if (!rawValue) {
      return { accessToken: null, refreshToken: null };
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!parsedValue || typeof parsedValue !== 'object') {
      return { accessToken: null, refreshToken: null };
    }

    const authState = parsedValue as Partial<StoredAuthState>;

    return {
      accessToken: authState.accessToken ?? null,
      refreshToken: authState.refreshToken ?? null,
    };
  } catch (error) {
    warnSafely('Unable to read legacy auth token storage.', error);
    return { accessToken: null, refreshToken: null };
  }
}

function clearLegacyAuthTokensFromLocalStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  } catch (error) {
    warnSafely('Unable to clear legacy auth token storage.', error);
  }
}

async function clearStoredAuthTokensSafely() {
  try {
    await clearAuthTokens();
  } catch (error) {
    warnSafely('Unable to clear secure auth token storage.', error);
  }

  clearLegacyAuthTokensFromLocalStorage();
}

async function prepareSyncForSessionUser(userId: string) {
  if (!appConfig.isBackendApiEnabled) {
    return;
  }

  prepareSyncForAuthenticatedUser(userId);
}

function resetSyncAfterSessionEnd() {
  resetSyncRuntimeState();
}

async function syncRevenueCatForSessionUser(userId: string) {
  try {
    await logInRevenueCat(userId);
  } catch (error) {
    warnSafely('Unable to sync RevenueCat user identity.', error);
  }
}

async function clearRevenueCatSessionSafely() {
  try {
    await logOutRevenueCat();
  } catch (error) {
    warnSafely('Unable to clear RevenueCat user identity.', error);
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapAuthUser(user: AuthUserDto, fallbackEmail = ''): AuthUser {
  return {
    id: user.id,
    email: normalizeEmail(user.email ?? fallbackEmail),
    displayName: user.displayName?.trim() || translate('common.weeklyUsUser'),
    plan: user.planType,
    createdAt: user.createdAt,
  };
}

function mapSessionUser(session: AuthSessionDto): AuthUser {
  return mapAuthUser(session.user);
}

function isStoredAuthState(value: unknown): value is StoredAuthState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StoredAuthState>;
  const status = candidate.authStatus;

  return (
    (candidate.version === 1 || candidate.version === STORAGE_VERSION) &&
    (status === 'authenticated' || status === 'localOnly' || status === 'idle')
  );
}

function getStoredState(): Pick<AuthState, 'user' | 'authStatus'> {
  const storedState = readOnboardingStorage<unknown | null>('auth', null);

  if (!isStoredAuthState(storedState)) {
    return {
      user: null,
      authStatus: 'idle',
    };
  }

  const legacyLocalStorageTokens = readLegacyAuthTokensFromLocalStorage();

  legacyTokensToMigrate = {
    accessToken:
      storedState.accessToken ?? legacyLocalStorageTokens.accessToken,
    refreshToken:
      storedState.refreshToken ?? legacyLocalStorageTokens.refreshToken,
  };

  if (storedState.authStatus === 'authenticated' && !storedState.user) {
    return {
      user: null,
      authStatus: 'idle',
    };
  }

  if (appConfig.isBackendApiEnabled && storedState.authStatus === 'localOnly') {
    return {
      user: null,
      authStatus: 'idle',
    };
  }

  return {
    user: storedState.user,
    authStatus: storedState.authStatus,
  };
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    ...getStoredState(),
    errorMessage: '',
    hasHydratedSecureTokens: false,
    hasVerifiedCurrentUser: false,
  }),
  getters: {
    isAuthenticated: (state) =>
      Boolean(state.user && state.authStatus === 'authenticated'),
    isLocalOnly: (state) => state.authStatus === 'localOnly',
  },
  actions: {
    persist() {
      if (typeof window === 'undefined') {
        return;
      }

      const storedState: StoredAuthState = {
        version: STORAGE_VERSION,
        user: this.user,
        authStatus: this.authStatus,
      };

      writeOnboardingStorage('auth', storedState);
    },
    async hydrateSecureTokens() {
      if (this.hasHydratedSecureTokens) {
        return;
      }

      this.hasHydratedSecureTokens = true;

      if (this.authStatus !== 'authenticated') {
        legacyTokensToMigrate = { accessToken: null, refreshToken: null };
        return;
      }

      let tokens: AuthTokens;

      try {
        tokens = await readAuthTokens();
      } catch {
        this.user = null;
        this.authStatus = 'idle';
        this.hasVerifiedCurrentUser = false;
        this.persist();
        return;
      }

      if (!tokens.accessToken && legacyTokensToMigrate.accessToken) {
        tokens = legacyTokensToMigrate;
        try {
          await writeAuthTokens(tokens);
          clearLegacyAuthTokensFromLocalStorage();
        } catch {
          this.user = null;
          this.authStatus = 'idle';
          this.hasVerifiedCurrentUser = false;
          this.persist();
          return;
        }
        this.persist();
      }

      legacyTokensToMigrate = { accessToken: null, refreshToken: null };

      if (!tokens.accessToken) {
        this.user = null;
        this.authStatus = 'idle';
        this.hasVerifiedCurrentUser = false;
        this.persist();
        return;
      }

      clearLegacyAuthTokensFromLocalStorage();
    },
    syncAccessState() {
      const accessStore = useUserAccessStore();

      if (this.user) {
        accessStore.setAccountPlan(this.user.plan);
      }
    },
    async applySession(session: AuthSessionDto) {
      await writeAuthTokens({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? null,
      });

      const nextUser = mapSessionUser(session);
      await prepareSyncForSessionUser(nextUser.id);
      await syncRevenueCatForSessionUser(nextUser.id);

      this.user = nextUser;
      this.authStatus = 'authenticated';
      this.hasHydratedSecureTokens = true;
      this.hasVerifiedCurrentUser = true;
      this.errorMessage = '';
      this.persist();
      this.syncAccessState();
    },
    async clearSessionAfterUnauthorized() {
      await clearRevenueCatSessionSafely();
      await clearStoredAuthTokensSafely();
      await resetSyncAfterSessionEnd();
      this.user = null;
      this.authStatus = 'idle';
      this.hasHydratedSecureTokens = true;
      this.hasVerifiedCurrentUser = true;
      this.errorMessage = '';
      this.persist();
    },
    async verifyCurrentUser() {
      await this.hydrateSecureTokens();

      if (this.authStatus !== 'authenticated') {
        return false;
      }

      if (this.hasVerifiedCurrentUser) {
        return true;
      }

      try {
        const currentUser = await getCurrentUserRequest();

        if (!currentUser) {
          await this.clearSessionAfterUnauthorized();
          return false;
        }

        const nextUser = mapAuthUser(currentUser, this.user?.email);
        await prepareSyncForSessionUser(nextUser.id);
        await syncRevenueCatForSessionUser(nextUser.id);

        this.user = nextUser;
        this.authStatus = 'authenticated';
        this.hasVerifiedCurrentUser = true;
        this.errorMessage = '';
        this.persist();
        this.syncAccessState();
        return true;
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          await this.clearSessionAfterUnauthorized();
          return false;
        }

        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('api.backendContactFailed');

        return this.isAuthenticated;
      }
    },
    async refreshAuthenticatedSession() {
      await this.hydrateSecureTokens();
      const tokens = await readAuthTokens();

      if (!tokens.refreshToken) {
        await this.clearSessionAfterUnauthorized();
        return null;
      }

      try {
        const session = await refreshSessionRequest({
          refreshToken: tokens.refreshToken,
        });
        await this.applySession(session);
        return session.accessToken;
      } catch {
        await this.clearSessionAfterUnauthorized();
        return null;
      }
    },
    async signIn(payload: SignInPayload) {
      this.authStatus = 'loading';
      this.errorMessage = '';

      try {
        const session = await signInRequest({
          email: normalizeEmail(payload.email),
          password: payload.password,
        });

        await this.applySession(session);
        return true;
      } catch (error) {
        await clearStoredAuthTokensSafely();
        this.user = null;
        this.authStatus = 'error';
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('api.signInFailed');
        this.persist();
        return false;
      }
    },
    async signUp(payload: SignUpPayload) {
      this.authStatus = 'loading';
      this.errorMessage = '';

      try {
        const session = await registerRequest({
          email: normalizeEmail(payload.email),
          password: payload.password,
          displayName: payload.displayName.trim(),
        });

        await this.applySession(session);
        return true;
      } catch (error) {
        await clearStoredAuthTokensSafely();
        this.user = null;
        this.authStatus = 'error';
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('api.signUpFailed');
        this.persist();
        return false;
      }
    },
    async continueLocalOnly() {
      if (appConfig.isBackendApiEnabled) {
        this.errorMessage = translate('auth.accountRequired');
        return false;
      }

      await clearStoredAuthTokensSafely();
      await resetSyncAfterSessionEnd();
      await clearRevenueCatSessionSafely();
      this.user = null;
      this.authStatus = 'localOnly';
      this.hasHydratedSecureTokens = true;
      this.hasVerifiedCurrentUser = true;
      this.errorMessage = '';
      this.persist();
      return true;
    },
    updateProfile(displayName: string) {
      const nextDisplayName = displayName.trim();

      if (!this.user || !nextDisplayName) {
        return false;
      }

      this.user = {
        ...this.user,
        displayName: nextDisplayName,
      };
      this.persist();
      return true;
    },
    async logout() {
      try {
        if (this.isAuthenticated) {
          const { refreshToken } = await readAuthTokens();
          await signOutRequest(refreshToken);
        }
      } finally {
        await this.clearSessionAfterUnauthorized();
      }
    },
  },
});

setApiAuthHandlers({
  getAccessToken: async () => {
    const authStore = useAuthStore();
    await authStore.hydrateSecureTokens();
    const { accessToken } = await readAuthTokens();
    return accessToken;
  },
  refreshSession: async () => {
    const authStore = useAuthStore();
    return authStore.refreshAuthenticatedSession();
  },
  onUnauthorized: async () => {
    const authStore = useAuthStore();
    await authStore.clearSessionAfterUnauthorized();
  },
});
