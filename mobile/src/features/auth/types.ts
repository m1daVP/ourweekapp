import type { PlanType } from '@/features/access/types'

export type AuthStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'localOnly'
  | 'error'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  plan: PlanType
  createdAt: string
}

export interface SignInPayload {
  email: string
  password: string
}

export interface SignUpPayload extends SignInPayload {
  displayName: string
}
