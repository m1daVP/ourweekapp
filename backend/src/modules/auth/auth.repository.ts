import type { SupabaseClient } from '@supabase/supabase-js';

import type { AuthContext, PlanType, UserRole } from '../../shared/auth/index.js';
import { ApiError } from '../../shared/errors/index.js';
import { throwOnSupabaseError } from '../../shared/repositories/index.js';
import type { AccessTokenClaims } from './token.service.js';

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
};

type UserRow = {
  id: string;
  deleted_at: string | null;
};

type WorkspaceRow = {
  id: string;
  deleted_at: string | null;
};

type WorkspaceMemberRow = {
  workspace_id: string;
  user_id: string;
  role: UserRole;
  status: string;
};

type SubscriptionRow = {
  plan_type: PlanType;
  status: string;
  expires_at: string | null;
};

const PREMIUM_ACTIVE_STATUSES = new Set(['active', 'trialing', 'grace_period']);

function isActiveTimestamp(expiresAt: string, now: Date) {
  return new Date(expiresAt).getTime() > now.getTime();
}

export function isPremiumSubscriptionEffective(
  subscription: SubscriptionRow,
  now: Date,
) {
  return (
    subscription.plan_type === 'premium' &&
    PREMIUM_ACTIVE_STATUSES.has(subscription.status) &&
    (subscription.expires_at === null ||
      new Date(subscription.expires_at).getTime() > now.getTime())
  );
}

export class AuthRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findActiveSession(
    sessionId: string,
    userId: string,
    now = new Date(),
  ) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('id,user_id,expires_at,revoked_at')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle<SessionRow>();

    throwOnSupabaseError(error, 'auth_session_lookup_failed', 'Unable to load auth session.');

    if (
      !data ||
      data.revoked_at !== null ||
      !isActiveTimestamp(data.expires_at, now)
    ) {
      return null;
    }

    return data;
  }

  async findActiveUser(userId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('id,deleted_at')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle<UserRow>();

    throwOnSupabaseError(error, 'auth_user_lookup_failed', 'Unable to load auth user.');

    return data;
  }

  async findActiveWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('workspaces')
      .select('id,deleted_at')
      .eq('id', workspaceId)
      .is('deleted_at', null)
      .maybeSingle<WorkspaceRow>();

    throwOnSupabaseError(error, 'auth_workspace_lookup_failed', 'Unable to load auth workspace.');

    return data;
  }

  async findActiveWorkspaceMember(workspaceId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .select('workspace_id,user_id,role,status')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle<WorkspaceMemberRow>();

    throwOnSupabaseError(error, 'auth_membership_lookup_failed', 'Unable to load auth membership.');

    return data;
  }

  async getEffectivePlanType(workspaceId: string, now = new Date()) {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('plan_type,status,expires_at')
      .eq('workspace_id', workspaceId)
      .eq('plan_type', 'premium')
      .order('updated_at', { ascending: false })
      .limit(10)
      .returns<SubscriptionRow[]>();

    throwOnSupabaseError(error, 'auth_subscription_lookup_failed', 'Unable to load auth subscription.');

    return (data ?? []).some((subscription) =>
      isPremiumSubscriptionEffective(subscription, now),
    )
      ? 'premium'
      : 'free';
  }

  async getAuthenticatedContext(
    claims: AccessTokenClaims,
    now = new Date(),
  ): Promise<AuthContext | null> {
    const [session, user, workspace, member] = await Promise.all([
      this.findActiveSession(claims.sessionId, claims.sub, now),
      this.findActiveUser(claims.sub),
      this.findActiveWorkspace(claims.workspaceId),
      this.findActiveWorkspaceMember(claims.workspaceId, claims.sub),
    ]);

    if (!session || !user || !workspace || !member) {
      return null;
    }

    return {
      userId: user.id,
      sessionId: session.id,
      workspaceId: workspace.id,
      role: member.role,
      planType: await this.getEffectivePlanType(workspace.id, now),
    };
  }

  async findActiveSessionByRefreshTokenHash(
    refreshTokenHash: string,
    now = new Date(),
  ) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('id,user_id,expires_at,revoked_at')
      .eq('refresh_token_hash', refreshTokenHash)
      .maybeSingle<SessionRow>();

    throwOnSupabaseError(error, 'auth_session_lookup_failed', 'Unable to load auth session.');

    if (
      !data ||
      data.revoked_at !== null ||
      !isActiveTimestamp(data.expires_at, now)
    ) {
      return null;
    }

    return data;
  }

  async rotateSessionRefreshToken(
    sessionId: string,
    currentRefreshTokenHash: string,
    nextRefreshTokenHash: string,
    nextExpiresAt: Date,
    now = new Date(),
  ) {
    const { data, error } = await this.supabase
      .from('sessions')
      .update({
        refresh_token_hash: nextRefreshTokenHash,
        expires_at: nextExpiresAt.toISOString(),
        last_used_at: now.toISOString(),
      })
      .eq('id', sessionId)
      .eq('refresh_token_hash', currentRefreshTokenHash)
      .is('revoked_at', null)
      .gt('expires_at', now.toISOString())
      .select('id,user_id,expires_at,revoked_at')
      .maybeSingle<SessionRow>();

    throwOnSupabaseError(error, 'auth_session_rotation_failed', 'Unable to rotate auth session.');

    if (!data) {
      throw new ApiError(401, 'invalid_session', 'Please sign in again.');
    }

    return data;
  }

  async revokeSession(sessionId: string) {
    const { error } = await this.supabase
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', sessionId)
      .is('revoked_at', null);

    throwOnSupabaseError(error, 'auth_session_revoke_failed', 'Unable to revoke auth session.');
  }
}
