import { defineStore } from 'pinia';
import { translate } from '@/features/localization/i18n';
import {
  getCurrentUser as getCurrentUserRequest,
  refreshSession as refreshSessionRequest,
  register as registerRequest,
  signIn as signInRequest,
  signInWithGoogleIdToken as signInWithGoogleIdTokenRequest,
  signOut as signOutRequest,
  type AuthUserDto,
  type AuthSessionDto,
} from '@/shared/api/authApi';
import { getNativeGoogleIdToken } from '@/features/auth/googleSignInService';
import { ApiClientError, setApiAuthHandlers } from '@/shared/api/httpClient';
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
import { captureHandledError } from '@/shared/services/errorMonitoringService';
import { warnSafely } from '@/shared/services/safeLogService';
import {
  prepareSyncForAuthenticatedUser,
  resetSyncRuntimeState,
} from '@/shared/services/syncSessionService';
import { useSubscriptionStore } from '@/app/stores/subscription';
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

const STORAGE_VERSION = 3;
const LEGACY_AUTH_STORAGE_KEY = 'ourweek:auth';

type SessionCheckStatus =
  | 'idle'
  | 'checking'
  | 'verified'
  | 'failed'
  | 'unauthorized';

interface StoredAuthState {
  version: number;
  user: AuthUser | null;
  authStatus: AuthStatus | 'localOnly';
  accessToken?: string | null;
  refreshToken?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  authStatus: AuthStatus;
  errorMessage: string;
  sessionCheckErrorMessage: string;
  sessionCheckStatus: SessionCheckStatus;
  lastAuthError: AuthErrorDiagnostics | null;
  hasHydratedSecureTokens: boolean;
  hasVerifiedCurrentUser: boolean;
}

export interface AuthErrorDiagnostics {
  source: 'google';
  status?: number;
  code?: string;
  name?: string;
  hasDetails?: boolean;
  googleToken?: GoogleIdTokenDiagnostics;
}

interface GoogleIdTokenClaims {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  iat?: unknown;
}

interface GoogleIdTokenDiagnostics {
  payloadReadable: boolean;
  issuer?: string;
  audienceLength?: number;
  audienceSuffix?: string;
  audienceFingerprint?: string;
  expectedAudienceLength?: number;
  expectedAudienceSuffix?: string;
  expectedAudienceFingerprint?: string;
  audienceMatchesConfiguredClient?: boolean;
  expiresAt?: string;
  issuedAt?: string;
  isExpired?: boolean;
}

let legacyTokensToMigrate: AuthTokens = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
};
let currentUserVerificationPromise: Promise<boolean> | null = null;
let sessionRefreshPromise: Promise<string | null> | null = null;

function readLegacyAuthTokensFromLocalStorage(): AuthTokens {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null };
  }

  try {
    const rawValue = window.localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);

    if (!rawValue) {
      return { accessToken: null, refreshToken: null, expiresAt: null };
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!parsedValue || typeof parsedValue !== 'object') {
      return { accessToken: null, refreshToken: null, expiresAt: null };
    }

    const authState = parsedValue as Partial<StoredAuthState>;

    return {
      accessToken: authState.accessToken ?? null,
      refreshToken: authState.refreshToken ?? null,
      expiresAt: null,
    };
  } catch (error) {
    warnSafely('Unable to read legacy auth token storage.', error);
    return { accessToken: null, refreshToken: null, expiresAt: null };
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
  prepareSyncForAuthenticatedUser(userId);
}

function resetSyncAfterSessionEnd() {
  resetSyncRuntimeState();
}

function resetSubscriptionAfterSessionEnd() {
  useSubscriptionStore().$reset();
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

function getGoogleSignInErrorMessage(error: unknown) {
  if (!(error instanceof ApiClientError)) {
    return error instanceof Error
      ? error.message
      : translate('auth.googleSignInFailed');
  }

  if (error.status === 429) {
    return translate('auth.googleTooManyAttempts');
  }

  switch (error.code) {
    case 'account_link_conflict':
      return translate('auth.googleAccountConflict');
    case 'google_sign_in_not_configured':
      return translate('auth.googleNotConfigured');
    case 'invalid_google_token':
    case 'validation_failed':
      return translate('auth.googleTokenRejected');
    default:
      return error.message || translate('auth.googleSignInFailed');
  }
}

function getSafeStringSuffix(value: string) {
  return value.length > 8 ? value.slice(-8) : value;
}

function getSafeStringFingerprint(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function readGoogleIdTokenClaims(idToken: string): GoogleIdTokenClaims | null {
  const [, encodedPayload] = idToken.split('.');

  if (!encodedPayload) {
    return null;
  }

  try {
    const normalizedPayload = encodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '='
    );
    const parsedPayload = JSON.parse(atob(paddedPayload)) as unknown;

    return parsedPayload && typeof parsedPayload === 'object'
      ? (parsedPayload as GoogleIdTokenClaims)
      : null;
  } catch {
    return null;
  }
}

function getUnixDateTime(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return new Date(value * 1000).toISOString();
}

function getGoogleIdTokenDiagnostics(
  idToken: string
): GoogleIdTokenDiagnostics {
  const claims = readGoogleIdTokenClaims(idToken);
  const expectedAudience = appConfig.googleWebClientId ?? undefined;

  if (!claims) {
    return {
      payloadReadable: false,
      expectedAudienceLength: expectedAudience?.length,
      expectedAudienceSuffix: expectedAudience
        ? getSafeStringSuffix(expectedAudience)
        : undefined,
      expectedAudienceFingerprint: expectedAudience
        ? getSafeStringFingerprint(expectedAudience)
        : undefined,
    };
  }

  const audience = typeof claims.aud === 'string' ? claims.aud : undefined;
  const expiresAt = getUnixDateTime(claims.exp);

  return {
    payloadReadable: true,
    issuer: typeof claims.iss === 'string' ? claims.iss : undefined,
    audienceLength: audience?.length,
    audienceSuffix: audience ? getSafeStringSuffix(audience) : undefined,
    audienceFingerprint: audience
      ? getSafeStringFingerprint(audience)
      : undefined,
    expectedAudienceLength: expectedAudience?.length,
    expectedAudienceSuffix: expectedAudience
      ? getSafeStringSuffix(expectedAudience)
      : undefined,
    expectedAudienceFingerprint: expectedAudience
      ? getSafeStringFingerprint(expectedAudience)
      : undefined,
    audienceMatchesConfiguredClient:
      audience && expectedAudience ? audience === expectedAudience : undefined,
    expiresAt,
    issuedAt: getUnixDateTime(claims.iat),
    isExpired: expiresAt ? Date.parse(expiresAt) <= Date.now() : undefined,
  };
}

function getGoogleSignInDebugDetails(
  error: unknown,
  googleToken?: GoogleIdTokenDiagnostics
): AuthErrorDiagnostics {
  if (error instanceof ApiClientError) {
    return {
      source: 'google',
      status: error.status,
      code: error.code,
      hasDetails: error.details !== undefined,
      googleToken,
    };
  }

  if (error instanceof Error) {
    const code =
      'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;

    return {
      source: 'google',
      name: error.name,
      code,
      googleToken,
    };
  }

  return { source: 'google', googleToken };
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
    (candidate.version === 1 ||
      candidate.version === 2 ||
      candidate.version === STORAGE_VERSION) &&
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

  if (storedState.authStatus === 'localOnly') {
    return {
      user: null,
      authStatus: 'idle',
    };
  }

  return {
    user: storedState.user,
    authStatus: storedState.authStatus as AuthStatus,
  };
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    ...getStoredState(),
    errorMessage: '',
    sessionCheckErrorMessage: '',
    sessionCheckStatus: 'idle',
    lastAuthError: null,
    hasHydratedSecureTokens: false,
    hasVerifiedCurrentUser: false,
  }),
  getters: {
    isAuthenticated: (state) =>
      Boolean(state.user && state.authStatus === 'authenticated'),
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
        legacyTokensToMigrate = {
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
        };
        return;
      }

      let tokens: AuthTokens;

      try {
        tokens = await readAuthTokens();
      } catch {
        this.user = null;
        this.authStatus = 'idle';
        this.sessionCheckStatus = 'unauthorized';
        this.sessionCheckErrorMessage = '';
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
          this.sessionCheckStatus = 'unauthorized';
          this.sessionCheckErrorMessage = '';
          this.hasVerifiedCurrentUser = false;
          this.persist();
          return;
        }
        this.persist();
      }

      legacyTokensToMigrate = {
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
      };

      if (!tokens.accessToken) {
        this.user = null;
        this.authStatus = 'idle';
        this.sessionCheckStatus = 'unauthorized';
        this.sessionCheckErrorMessage = '';
        this.hasVerifiedCurrentUser = false;
        this.persist();
        return;
      }

      clearLegacyAuthTokensFromLocalStorage();
    },
    async applySession(session: AuthSessionDto) {
      await writeAuthTokens({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? null,
        expiresAt: session.expiresAt,
      });

      const nextUser = mapSessionUser(session);
      await prepareSyncForSessionUser(nextUser.id);
      await syncRevenueCatForSessionUser(nextUser.id);

      this.user = nextUser;
      this.authStatus = 'authenticated';
      this.sessionCheckStatus = 'verified';
      this.sessionCheckErrorMessage = '';
      this.hasHydratedSecureTokens = true;
      this.hasVerifiedCurrentUser = true;
      this.errorMessage = '';
      this.lastAuthError = null;
      this.persist();
    },
    async clearSessionAfterUnauthorized() {
      await clearRevenueCatSessionSafely();
      await clearStoredAuthTokensSafely();
      await resetSyncAfterSessionEnd();
      resetSubscriptionAfterSessionEnd();
      this.user = null;
      this.authStatus = 'idle';
      this.sessionCheckStatus = 'unauthorized';
      this.sessionCheckErrorMessage = '';
      this.hasHydratedSecureTokens = true;
      this.hasVerifiedCurrentUser = true;
      this.errorMessage = '';
      this.lastAuthError = null;
      this.persist();
    },
    async verifyCurrentUser() {
      await this.hydrateSecureTokens();

      if (this.authStatus !== 'authenticated') {
        if (this.sessionCheckStatus === 'checking') {
          this.sessionCheckStatus = 'idle';
        }
        return false;
      }

      if (this.hasVerifiedCurrentUser) {
        this.sessionCheckStatus = 'verified';
        this.sessionCheckErrorMessage = '';
        return true;
      }

      if (currentUserVerificationPromise) {
        return currentUserVerificationPromise;
      }

      this.sessionCheckStatus = 'checking';
      this.sessionCheckErrorMessage = '';
      const expectedUserId = this.user?.id;

      currentUserVerificationPromise = (async () => {
        try {
          const currentUser = await getCurrentUserRequest();

          if (!currentUser) {
            await this.clearSessionAfterUnauthorized();
            return false;
          }

          if (
            this.authStatus !== 'authenticated' ||
            (expectedUserId && this.user?.id !== expectedUserId)
          ) {
            return false;
          }

          const nextUser = mapAuthUser(currentUser, this.user?.email);
          await prepareSyncForSessionUser(nextUser.id);
          await syncRevenueCatForSessionUser(nextUser.id);

          this.user = nextUser;
          this.authStatus = 'authenticated';
          this.sessionCheckStatus = 'verified';
          this.sessionCheckErrorMessage = '';
          this.hasVerifiedCurrentUser = true;
          this.errorMessage = '';
          this.persist();
          return true;
        } catch (error) {
          if (error instanceof ApiClientError && error.status === 401) {
            await this.clearSessionAfterUnauthorized();
            return false;
          }

          this.sessionCheckStatus = 'failed';
          this.sessionCheckErrorMessage = translate(
            'auth.sessionCheckUnavailable'
          );
          this.errorMessage = this.sessionCheckErrorMessage;

          return this.isAuthenticated;
        } finally {
          currentUserVerificationPromise = null;
        }
      })();

      return currentUserVerificationPromise;
    },
    async refreshAuthenticatedSession() {
      if (sessionRefreshPromise) {
        return sessionRefreshPromise;
      }

      sessionRefreshPromise = (async () => {
        try {
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
        } finally {
          sessionRefreshPromise = null;
        }
      })();

      return sessionRefreshPromise;
    },
    async signIn(payload: SignInPayload) {
      this.authStatus = 'loading';
      this.sessionCheckStatus = 'idle';
      this.sessionCheckErrorMessage = '';
      this.errorMessage = '';
      this.lastAuthError = null;

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
    async signInWithGoogle() {
      this.authStatus = 'loading';
      this.sessionCheckStatus = 'idle';
      this.sessionCheckErrorMessage = '';
      this.errorMessage = '';
      this.lastAuthError = null;
      let googleTokenDiagnostics: GoogleIdTokenDiagnostics | undefined;

      try {
        const idToken = await getNativeGoogleIdToken();
        googleTokenDiagnostics = getGoogleIdTokenDiagnostics(idToken);
        const session = await signInWithGoogleIdTokenRequest({ idToken });

        await this.applySession(session);
        return true;
      } catch (error) {
        const debugDetails = getGoogleSignInDebugDetails(
          error,
          googleTokenDiagnostics
        );
        warnSafely('Google sign-in failed.', debugDetails);
        captureHandledError(error, {
          tags: {
            feature: 'auth',
            provider: 'google',
          },
          extra: {
            authError: debugDetails,
          },
        });
        await clearStoredAuthTokensSafely();
        this.user = null;
        this.authStatus = 'error';
        this.errorMessage = getGoogleSignInErrorMessage(error);
        this.lastAuthError = debugDetails;
        this.persist();
        return false;
      }
    },
    async signUp(payload: SignUpPayload) {
      this.authStatus = 'loading';
      this.sessionCheckStatus = 'idle';
      this.sessionCheckErrorMessage = '';
      this.errorMessage = '';
      this.lastAuthError = null;

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
