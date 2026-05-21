import type { PlanType, UserRole } from '@/features/access/types'
import { apiRequest, isBackendApiConfigured } from './httpClient'

export interface AuthUserDto {
  id: string
  email?: string
  displayName?: string
  role: UserRole
  planType: PlanType
  createdAt: string
  updatedAt: string
}

export interface AuthSessionDto {
  user: AuthUserDto
  accessToken: string
  refreshToken?: string
  expiresAt?: string
}

export interface SignInRequestDto {
  email: string
  password: string
}

export interface RegisterRequestDto {
  email: string
  password: string
  displayName?: string
}

export interface RefreshSessionRequestDto {
  refreshToken: string
}

export type CurrentUserResponseDto = AuthUserDto | null

function createMockSession(email: string): AuthSessionDto {
  const now = new Date().toISOString()

  return {
    user: {
      id: 'mock-user-local',
      email,
      displayName: email.split('@')[0] || 'Local user',
      role: 'owner',
      planType: 'free',
      createdAt: now,
      updatedAt: now,
    },
    accessToken: 'mock-access-token',
  }
}

export async function getCurrentUser(): Promise<CurrentUserResponseDto> {
  if (!isBackendApiConfigured()) {
    return null
  }

  return apiRequest<CurrentUserResponseDto>('/auth/me')
}

export async function signIn(
  payload: SignInRequestDto,
): Promise<AuthSessionDto> {
  if (!isBackendApiConfigured()) {
    return createMockSession(payload.email)
  }

  return apiRequest<AuthSessionDto>('/auth/sign-in', {
    method: 'POST',
    body: payload,
  })
}

export async function register(
  payload: RegisterRequestDto,
): Promise<AuthSessionDto> {
  if (!isBackendApiConfigured()) {
    return createMockSession(payload.email)
  }

  return apiRequest<AuthSessionDto>('/auth/register', {
    method: 'POST',
    body: payload,
  })
}

export async function refreshSession(
  payload: RefreshSessionRequestDto,
): Promise<AuthSessionDto> {
  if (!isBackendApiConfigured()) {
    return createMockSession('local@example.com')
  }

  return apiRequest<AuthSessionDto>('/auth/refresh', {
    method: 'POST',
    body: payload,
  })
}

export async function signOut(): Promise<void> {
  if (!isBackendApiConfigured()) {
    return
  }

  await apiRequest<void>('/auth/sign-out', { method: 'POST' })
}
