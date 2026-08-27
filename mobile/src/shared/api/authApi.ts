import type { PlanType, UserRole } from '@/features/access/types';
import { translate } from '@/features/localization/i18n';
import { ApiClientError, apiRequest } from './httpClient';

export interface AuthUserDto {
  id: string;
  workspaceId?: string;
  email?: string;
  displayName?: string;
  role: UserRole;
  planType: PlanType;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionDto {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface SignInRequestDto {
  email: string;
  password: string;
}

export interface GoogleSignInRequestDto {
  idToken: string;
  invitationToken?: string;
}

export interface RegisterRequestDto {
  email: string;
  password: string;
  displayName: string;
  invitationToken?: string;
}

export interface AcceptWorkspaceInvitationRequestDto {
  token: string;
}

export interface RefreshSessionRequestDto {
  refreshToken: string;
}

export interface PasswordResetRequestDto {
  email: string;
}

export interface PasswordResetRequestResponseDto {
  message: string;
}

export interface PasswordResetConfirmRequestDto {
  token: string;
  password: string;
}

export type CurrentUserResponseDto = AuthUserDto | null;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function isAuthUserDto(value: unknown): value is AuthUserDto {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AuthUserDto>;

  return (
    isNonEmptyString(candidate.id) &&
    (candidate.workspaceId === undefined ||
      isNonEmptyString(candidate.workspaceId)) &&
    (candidate.email === undefined || typeof candidate.email === 'string') &&
    (candidate.displayName === undefined ||
      typeof candidate.displayName === 'string') &&
    (candidate.role === 'owner' ||
      candidate.role === 'adult_member' ||
      candidate.role === 'viewer') &&
    (candidate.planType === 'free' || candidate.planType === 'premium') &&
    isNonEmptyString(candidate.createdAt) &&
    isNonEmptyString(candidate.updatedAt)
  );
}

export function isAuthSessionDto(value: unknown): value is AuthSessionDto {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AuthSessionDto>;

  return (
    isAuthUserDto(candidate.user) &&
    isNonEmptyString(candidate.accessToken) &&
    isNonEmptyString(candidate.refreshToken) &&
    isNonEmptyString(candidate.expiresAt)
  );
}

export async function getCurrentUser(): Promise<CurrentUserResponseDto> {
  return apiRequest<CurrentUserResponseDto>('/auth/me', {
    requiresAuth: true,
  });
}

export async function signIn(
  payload: SignInRequestDto
): Promise<AuthSessionDto> {
  return apiRequest<AuthSessionDto>('/auth/sign-in', {
    method: 'POST',
    body: payload,
  });
}

export async function signInWithGoogleIdToken(
  payload: GoogleSignInRequestDto,
  signal?: AbortSignal
): Promise<AuthSessionDto> {
  const response = await apiRequest<unknown>('/auth/google', {
    method: 'POST',
    body: payload,
    signal,
  });

  if (!isAuthSessionDto(response)) {
    throw new ApiClientError(translate('api.backendContactFailed'), {
      code: 'invalid_auth_response',
    });
  }

  return response;
}

export async function register(
  payload: RegisterRequestDto
): Promise<AuthSessionDto> {
  return apiRequest<AuthSessionDto>('/auth/register', {
    method: 'POST',
    body: payload,
  });
}

export async function acceptWorkspaceInvitation(
  payload: AcceptWorkspaceInvitationRequestDto
): Promise<AuthSessionDto> {
  return apiRequest<AuthSessionDto>('/auth/invitations/accept', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });
}

export async function refreshSession(
  payload: RefreshSessionRequestDto
): Promise<AuthSessionDto> {
  return apiRequest<AuthSessionDto>('/auth/refresh', {
    method: 'POST',
    body: payload,
    skipAuthRefresh: true,
  });
}

export async function signOut(refreshToken?: string | null): Promise<void> {
  await apiRequest<void>('/auth/sign-out', {
    method: 'POST',
    body: refreshToken ? { refreshToken } : {},
    requiresAuth: true,
    skipAuthRefresh: true,
  });
}

export async function requestPasswordReset(
  payload: PasswordResetRequestDto
): Promise<PasswordResetRequestResponseDto> {
  return apiRequest<PasswordResetRequestResponseDto>(
    '/auth/password-reset/request',
    {
      method: 'POST',
      body: payload,
    }
  );
}

export async function confirmPasswordReset(
  payload: PasswordResetConfirmRequestDto
): Promise<void> {
  await apiRequest<void>('/auth/password-reset/confirm', {
    method: 'POST',
    body: payload,
  });
}
