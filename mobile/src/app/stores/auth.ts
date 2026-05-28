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

const STORAGE_VERSION = 1;

interface StoredAuthState {
  version: number;
  user: AuthUser | null;
  accessToken: string | null;
  authStatus: AuthStatus;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  authStatus: AuthStatus;
  errorMessage: string;
}

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
    candidate.version === STORAGE_VERSION &&
    (status === 'authenticated' || status === 'localOnly' || status === 'idle')
  );
}

function getStoredState(): Pick<
  AuthState,
  'user' | 'accessToken' | 'authStatus'
> {
  const storedState = readOnboardingStorage<unknown | null>('auth', null);

  if (!isStoredAuthState(storedState)) {
    return { user: null, accessToken: null, authStatus: 'idle' };
  }

  if (storedState.authStatus === 'authenticated' && !storedState.user) {
    return { user: null, accessToken: null, authStatus: 'idle' };
  }

  return {
    user: storedState.user,
    accessToken: storedState.accessToken,
    authStatus: storedState.authStatus,
  };
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    ...getStoredState(),
    errorMessage: '',
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
        accessToken: this.accessToken,
        authStatus: this.authStatus,
      };

      writeOnboardingStorage('auth', storedState);
    },
    syncAccessState() {
      const accessStore = useUserAccessStore();

      if (this.user) {
        accessStore.setAccountPlan(this.user.plan);
      }
    },
    applySession(session: AuthSessionDto) {
      this.user = mapSessionUser(session);
      this.accessToken = session.accessToken;
      this.authStatus = 'authenticated';
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

        this.applySession(session);
        return true;
      } catch (error) {
        this.user = null;
        this.accessToken = null;
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

        this.applySession(session);
        return true;
      } catch (error) {
        this.user = null;
        this.accessToken = null;
        this.authStatus = 'error';
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('api.signUpFailed');
        this.persist();
        return false;
      }
    },
    continueLocalOnly() {
      this.user = null;
      this.accessToken = null;
      this.authStatus = 'localOnly';
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
        this.user = null;
        this.accessToken = null;
        this.authStatus = 'idle';
        this.errorMessage = '';
        this.persist();
      }
    },
  },
});
