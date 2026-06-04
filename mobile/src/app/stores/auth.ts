import { defineStore } from 'pinia';
import { translate } from '@/features/localization/i18n';
import {
  register as registerRequest,
  signIn as signInRequest,
  signOut as signOutRequest,
  type AuthSessionDto,
} from '@/shared/api/authApi';
import { useUserAccessStore } from '@/app/stores/userAccess';
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
import type { PlanType } from '@/features/access/types';
import type {
  AuthStatus,
  AuthUser,
  SignInPayload,
  SignUpPayload,
} from '@/features/auth/types';

const STORAGE_VERSION = 2;

interface StoredAuthState {
  version: number;
  user: AuthUser | null;
  authStatus: AuthStatus;
  accessToken?: string | null;
  refreshToken?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  authStatus: AuthStatus;
  errorMessage: string;
  hasHydratedSecureTokens: boolean;
}

let legacyTokensToMigrate: AuthTokens = {
  accessToken: null,
  refreshToken: null,
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapSessionUser(session: AuthSessionDto): AuthUser {
  return {
    id: session.user.id,
    email: normalizeEmail(session.user.email ?? ''),
    displayName:
      session.user.displayName?.trim() || translate('common.weeklyUsUser'),
    plan: session.user.planType,
    createdAt: session.user.createdAt,
  };
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

function getStoredState(): Pick<
  AuthState,
  'user' | 'accessToken' | 'refreshToken' | 'authStatus'
> {
  const storedState = readOnboardingStorage<unknown | null>('auth', null);

  if (!isStoredAuthState(storedState)) {
    return {
      user: null,
      accessToken: null,
      refreshToken: null,
      authStatus: 'idle',
    };
  }

  legacyTokensToMigrate = {
    accessToken: storedState.accessToken ?? null,
    refreshToken: storedState.refreshToken ?? null,
  };

  if (storedState.authStatus === 'authenticated' && !storedState.user) {
    return {
      user: null,
      accessToken: null,
      refreshToken: null,
      authStatus: 'idle',
    };
  }

  return {
    user: storedState.user,
    accessToken: null,
    refreshToken: null,
    authStatus: storedState.authStatus,
  };
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    ...getStoredState(),
    errorMessage: '',
    hasHydratedSecureTokens: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user && state.accessToken),
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
        this.accessToken = null;
        this.refreshToken = null;
        this.authStatus = 'idle';
        this.persist();
        return;
      }

      if (!tokens.accessToken && legacyTokensToMigrate.accessToken) {
        tokens = legacyTokensToMigrate;
        try {
          await writeAuthTokens(tokens);
        } catch {
          this.user = null;
          this.accessToken = null;
          this.refreshToken = null;
          this.authStatus = 'idle';
          this.persist();
          return;
        }
        this.persist();
      }

      legacyTokensToMigrate = { accessToken: null, refreshToken: null };

      if (!tokens.accessToken) {
        this.user = null;
        this.accessToken = null;
        this.refreshToken = null;
        this.authStatus = 'idle';
        this.persist();
        return;
      }

      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
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

      this.user = mapSessionUser(session);
      this.accessToken = session.accessToken;
      this.refreshToken = session.refreshToken ?? null;
      this.authStatus = 'authenticated';
      this.hasHydratedSecureTokens = true;
      this.errorMessage = '';
      this.persist();
      this.syncAccessState();
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
        this.user = null;
        this.accessToken = null;
        this.refreshToken = null;
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
        this.user = null;
        this.accessToken = null;
        this.refreshToken = null;
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
      await clearAuthTokens();
      this.user = null;
      this.accessToken = null;
      this.refreshToken = null;
      this.authStatus = 'localOnly';
      this.hasHydratedSecureTokens = true;
      this.errorMessage = '';
      this.persist();
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
    setMockSubscriptionPlan(plan: PlanType) {
      if (!this.user) {
        return false;
      }

      this.user = {
        ...this.user,
        plan,
      };
      this.persist();
      this.syncAccessState();
      return true;
    },
    async logout() {
      try {
        if (this.isAuthenticated) {
          await signOutRequest();
        }
      } finally {
        await clearAuthTokens();
        this.user = null;
        this.accessToken = null;
        this.refreshToken = null;
        this.authStatus = 'idle';
        this.hasHydratedSecureTokens = true;
        this.errorMessage = '';
        this.persist();
      }
    },
  },
});
