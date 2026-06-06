import type { PlanType } from '../../shared/auth/index.js';
import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { requireRow, throwOnSupabaseError } from '../../shared/repositories/index.js';
import { resolveEffectivePlan } from '../../shared/repositories/index.js';

type SubscriptionProvider = 'google_play' | 'app_store' | 'revenuecat';

const SUBSCRIPTION_COLUMNS =
  'id,workspace_id,provider,provider_customer_id,provider_entitlement_id,plan_type,status,expires_at,last_checked_at,created_at,updated_at' as const;
const PUBLIC_SUBSCRIPTION_COLUMNS =
  'id,workspace_id,provider,plan_type,status,expires_at,last_checked_at,created_at,updated_at' as const;

type SubscriptionRow = {
  id: string;
  workspace_id: string;
  provider: SubscriptionProvider;
  provider_customer_id: string | null;
  provider_entitlement_id: string | null;
  plan_type: PlanType;
  status: string;
  expires_at: string | null;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
};

type PublicSubscriptionRow = Omit<SubscriptionRow, 'provider_customer_id' | 'provider_entitlement_id'>;

export type SubscriptionDto = {
  id: string;
  workspaceId: string;
  provider: SubscriptionProvider;
  planType: PlanType;
  status: string;
  expiresAt: string | null;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionRecord = SubscriptionDto & {
  providerCustomerId: string | null;
  providerEntitlementId: string | null;
};

export type UpsertSubscriptionInput = {
  id?: string;
  workspaceId: string;
  provider: SubscriptionProvider;
  providerCustomerId?: string | null;
  providerEntitlementId?: string | null;
  planType: PlanType;
  status: string;
  expiresAt?: string | null;
  lastCheckedAt: string;
};

export function mapSubscriptionRowToDto(row: PublicSubscriptionRow): SubscriptionDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    provider: row.provider,
    planType: row.plan_type,
    status: row.status,
    expiresAt: row.expires_at,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSubscriptionRowToRecord(row: SubscriptionRow): SubscriptionRecord {
  return {
    ...mapSubscriptionRowToDto(row),
    providerCustomerId: row.provider_customer_id,
    providerEntitlementId: row.provider_entitlement_id,
  };
}

export class SubscriptionsRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async findCurrentSubscriptionForWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select(PUBLIC_SUBSCRIPTION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('last_checked_at', { ascending: false })
      .limit(1)
      .maybeSingle<PublicSubscriptionRow>();

    throwOnSupabaseError(error, 'subscription_lookup_failed', 'Unable to load subscription.');

    return data ? mapSubscriptionRowToDto(data) : null;
  }

  async getCurrentPlanForWorkspace(workspaceId: string, now = new Date()) {
    const subscription = await this.findCurrentSubscriptionForWorkspace(workspaceId);

    return resolveEffectivePlan(
      subscription
        ? {
            plan_type: subscription.planType,
            status: subscription.status,
            expires_at: subscription.expiresAt,
          }
        : null,
      now,
    );
  }

  async findProviderSubscriptionForWorkspace(workspaceId: string, provider: SubscriptionProvider) {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('provider', provider)
      .order('last_checked_at', { ascending: false })
      .limit(1)
      .maybeSingle<SubscriptionRow>();

    throwOnSupabaseError(error, 'subscription_lookup_failed', 'Unable to load subscription.');

    return data ? mapSubscriptionRowToRecord(data) : null;
  }

  async upsertSubscription(input: UpsertSubscriptionInput) {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .upsert({
        ...(input.id ? { id: input.id } : {}),
        workspace_id: input.workspaceId,
        provider: input.provider,
        provider_customer_id: input.providerCustomerId ?? null,
        provider_entitlement_id: input.providerEntitlementId ?? null,
        plan_type: input.planType,
        status: input.status,
        expires_at: input.expiresAt ?? null,
        last_checked_at: input.lastCheckedAt,
      })
      .select(SUBSCRIPTION_COLUMNS)
      .single<SubscriptionRow>();

    return mapSubscriptionRowToRecord(
      requireRow(data, error, 'subscription_upsert_failed', 'Unable to save subscription.'),
    );
  }
}
