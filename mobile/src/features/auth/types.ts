import type { PlanType } from '@/features/access/types';
import type { SignInMethod } from '@/shared/api/authApi';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error';

export interface AuthUser {
  id: string;
  workspaceId?: string;
  email: string;
  displayName: string;
  plan: PlanType;
  signInMethods?: SignInMethod[];
  createdAt: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignUpPayload extends SignInPayload {
  displayName: string;
  invitationToken?: string;
}
