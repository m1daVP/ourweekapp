import type { AuthContext, PlanType, UserRole } from '../auth/index.js';
import type { SupabaseRepositoryClient } from './supabase.repository.js';
import { throwOnSupabaseError } from './supabase.repository.js';

type SessionLookupRow = {
  id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
};

type UserLookupRow = {
  id: string;
  deleted_at: string | null;
};

type WorkspaceLookupRow = {
  id: string;
  deleted_at: string | null;
};

type MembershipLookupRow = {
  workspace_id: string;
  user_id: string;
  role: UserRole;
  status: 'active' | 'invited' | 'removed';
};

type SubscriptionPlanRow = {
  plan_type: PlanType;
  status: string;
  expires_at: string | null;
};

export type LookupAuthContextInput = {
  userId: string;
  sessionId: string;
  workspaceId: string;
  now?: Date;
};

const PREMIUM_ACTIVE_STATUSES = new Set(['active', 'trialing', 'grace_period']);

export function resolveEffectivePlan(row: SubscriptionPlanRow | null, now = new Date()): PlanType {
  if (!row || row.plan_type !== 'premium') {
    return 'free';
  }

  if (!PREMIUM_ACTIVE_STATUSES.has(row.status)) {
    return 'free';
  }

  if (row.expires_at && Date.parse(row.expires_at) <= now.getTime()) {
    return 'free';
  }

  return 'premium';
}

export class AuthContextRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async lookupAuthContext(input: LookupAuthContextInput): Promise<AuthContext | null> {
    const now = input.now ?? new Date();

    const { data: session, error: sessionError } = await this.supabase
      .from('sessions')
      .select('id,user_id,expires_at,revoked_at')
      .eq('id', input.sessionId)
      .eq('user_id', input.userId)
      .is('revoked_at', null)
      .gt('expires_at', now.toISOString())
      .maybeSingle<SessionLookupRow>();

    throwOnSupabaseError(sessionError, 'auth_context_lookup_failed', 'Unable to load auth context.');

    if (!session) {
      return null;
    }

    const { data: user, error: userError } = await this.supabase
      .from('users')
      .select('id,deleted_at')
      .eq('id', input.userId)
      .is('deleted_at', null)
      .maybeSingle<UserLookupRow>();

    throwOnSupabaseError(userError, 'auth_context_lookup_failed', 'Unable to load auth context.');

    if (!user) {
      return null;
    }

    const { data: workspace, error: workspaceError } = await this.supabase
      .from('workspaces')
      .select('id,deleted_at')
      .eq('id', input.workspaceId)
      .is('deleted_at', null)
      .maybeSingle<WorkspaceLookupRow>();

    throwOnSupabaseError(workspaceError, 'auth_context_lookup_failed', 'Unable to load auth context.');

    if (!workspace) {
      return null;
    }

    const { data: membership, error: membershipError } = await this.supabase
      .from('workspace_members')
      .select('workspace_id,user_id,role,status')
      .eq('workspace_id', input.workspaceId)
      .eq('user_id', input.userId)
      .eq('status', 'active')
      .maybeSingle<MembershipLookupRow>();

    throwOnSupabaseError(membershipError, 'auth_context_lookup_failed', 'Unable to load auth context.');

    if (!membership) {
      return null;
    }

    const { data: subscription, error: subscriptionError } = await this.supabase
      .from('subscriptions')
      .select('plan_type,status,expires_at')
      .eq('workspace_id', input.workspaceId)
      .order('last_checked_at', { ascending: false })
      .limit(1)
      .maybeSingle<SubscriptionPlanRow>();

    throwOnSupabaseError(subscriptionError, 'auth_context_lookup_failed', 'Unable to load auth context.');

    return {
      userId: input.userId,
      sessionId: session.id,
      workspaceId: input.workspaceId,
      role: membership.role,
      planType: resolveEffectivePlan(subscription, now),
    };
  }
}
