import type { PlanType, UserRole } from '@/features/access/types';
import { apiRequest } from './httpClient';

export interface AuthUserDto {
  id: string;
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
}

export interface RegisterRequestDto {
  email: string;
  password: string;
  displayName: string;
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
  payload: GoogleSignInRequestDto
): Promise<AuthSessionDto> {
  return apiRequest<AuthSessionDto>('/auth/google', {
    method: 'POST',
    body: payload,
  });
}

export async function register(
  payload: RegisterRequestDto
): Promise<AuthSessionDto> {
  return apiRequest<AuthSessionDto>('/auth/register', {
    method: 'POST',
    body: payload,
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
