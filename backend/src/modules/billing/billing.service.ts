import type { AuthContext, PlanType } from '../../shared/auth/index.js';
import { requireAuthenticatedContext } from '../../shared/auth/index.js';
import { ApiError } from '../../shared/errors/index.js';
import { resolveEffectivePlan } from '../../shared/repositories/index.js';
import {
  enabledFeatureKeys,
  hasTrustedPremiumEntitlement,
  resolveFeatureAccessMap,
} from './feature-access.js';
import {
  type RestoreSubscriptionRequestDto,
  type SubscriptionProviderDto,
  type SubscriptionStatusDto,
} from './billing.schema.js';
import {
  type SubscriptionDto,
  type SubscriptionRecord,
  type SubscriptionsRepository,
} from './subscriptions.repository.js';
import {
  RevenueCatClientError,
  type RevenueCatCustomerInfo,
  type RevenueCatClient,
  type RevenueCatEntitlement,
} from './revenuecat.client.js';

export { hasTrustedPremiumEntitlement } from './feature-access.js';

const GOOGLE_PLAY_MANAGE_URL =
  'https://play.google.com/store/account/subscriptions';
const APP_STORE_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';

type SubscriptionRepository = Pick<
  SubscriptionsRepository,
  | 'findCurrentSubscriptionForWorkspace'
  | 'findProviderSubscriptionForWorkspace'
  | 'upsertSubscription'
>;

type EntitlementProviderClient = Pick<
  RevenueCatClient,
  'configured' | 'getSubscriber'
>;

type RevenueCatEntitlementWithStore = RevenueCatEntitlement & {
  store?: string | null;
};

type ProviderEntitlementResult = {
  provider: SubscriptionProviderDto;
  providerCustomerId: string | null;
  providerEntitlementId: string | null;
  planType: PlanType;
  status: string;
  expiresAt: string | null;
  checkedAt: string;
};

function isFuture(value: string | null | undefined, now: Date) {
  return value ? Date.parse(value) > now.getTime() : false;
}

function providerFromRevenueCatStore(
  store: string | null | undefined,
  fallback: SubscriptionProviderDto,
): SubscriptionProviderDto {
  if (store === 'play_store') {
    return 'google_play';
  }

  if (store === 'app_store' || store === 'mac_app_store') {
    return 'app_store';
  }

  return fallback;
}

function requireSubscriptionOwner(auth: AuthContext | undefined) {
  const context = requireAuthenticatedContext(auth);

  if (context.role !== 'owner') {
    throw new ApiError(
      403,
      'subscription_owner_required',
      'Only the workspace owner can manage subscriptions.',
    );
  }

  return context;
}

function subscriptionStatusFromRecord(
  subscription: SubscriptionDto | SubscriptionRecord | null,
  role: AuthContext['role'],
  now: Date,
): SubscriptionStatusDto {
  const planType = resolveEffectivePlan(
    subscription
      ? {
          plan_type: subscription.planType,
          status: subscription.status,
          expires_at: subscription.expiresAt,
        }
      : null,
    now,
  );

  if (!subscription || planType === 'free') {
    const features = resolveFeatureAccessMap({ planType: 'free', role });

    return {
      planType: 'free',
      provider: null,
      enabledFeatures: enabledFeatureKeys(features),
      features,
      expiresAt: null,
      checkedAt: subscription?.lastCheckedAt ?? now.toISOString(),
    };
  }

  const features = resolveFeatureAccessMap({ planType: 'premium', role });

  return {
    planType: 'premium',
    provider: subscription.provider,
    enabledFeatures: enabledFeatureKeys(features),
    features,
    expiresAt: subscription.expiresAt,
    checkedAt: subscription.lastCheckedAt,
  };
}

function freeStatus(role: AuthContext['role'], now: Date): SubscriptionStatusDto {
  const features = resolveFeatureAccessMap({ planType: 'free', role });

  return {
    planType: 'free',
    provider: null,
    enabledFeatures: enabledFeatureKeys(features),
    features,
    expiresAt: null,
    checkedAt: now.toISOString(),
  };
}

function resolveRevenueCatEntitlement(input: {
  customerInfo: RevenueCatCustomerInfo;
  entitlementId: string;
  fallbackProvider: SubscriptionProviderDto;
  now: Date;
}): ProviderEntitlementResult {
  const subscriber = input.customerInfo.subscriber;
  const checkedAt = input.customerInfo.request_date ?? input.now.toISOString();
  const entitlement = subscriber?.entitlements?.[input.entitlementId] as
    | RevenueCatEntitlementWithStore
    | undefined;

  if (!entitlement) {
    return {
      provider: input.fallbackProvider,
      providerCustomerId: subscriber?.original_app_user_id ?? null,
      providerEntitlementId: input.entitlementId,
      planType: 'free',
      status: 'not_found',
      expiresAt: null,
      checkedAt,
    };
  }

  const inGracePeriod = isFuture(
    entitlement.grace_period_expires_date,
    input.now,
  );
  const isActive =
    entitlement.expires_date === null ||
    isFuture(entitlement.expires_date, input.now);
  const planType: PlanType = isActive || inGracePeriod ? 'premium' : 'free';

  return {
    provider: providerFromRevenueCatStore(
      entitlement.store,
      input.fallbackProvider,
    ),
    providerCustomerId: subscriber?.original_app_user_id ?? null,
    providerEntitlementId: input.entitlementId,
    planType,
    status: inGracePeriod
      ? 'grace_period'
      : planType === 'premium'
        ? 'active'
        : 'expired',
    expiresAt: inGracePeriod
      ? (entitlement.grace_period_expires_date ?? null)
      : (entitlement.expires_date ?? null),
    checkedAt,
  };
}

export class SubscriptionService {
  constructor(
    private readonly repository: SubscriptionRepository,
    private readonly revenueCatClient: EntitlementProviderClient,
    private readonly entitlementId = 'premium',
  ) {}

  async getStatus(auth: AuthContext | undefined) {
    const context = requireAuthenticatedContext(auth);
    const now = new Date();

    if (this.revenueCatClient.configured) {
      try {
        return await this.syncRevenueCatEntitlement(context.workspaceId, {
          fallbackProvider: 'revenuecat',
          role: context.role,
          now,
        });
      } catch {
        return this.cachedOrFreeStatus(context.workspaceId, context.role, now);
      }
    }

    return this.cachedOrFreeStatus(context.workspaceId, context.role, now);
  }

  async restore(
    auth: AuthContext | undefined,
    body: RestoreSubscriptionRequestDto,
  ) {
    const context = requireSubscriptionOwner(auth);
    const now = new Date();

    if (!this.revenueCatClient.configured) {
      return freeStatus(context.role, now);
    }

    try {
      return await this.syncRevenueCatEntitlement(context.workspaceId, {
        fallbackProvider: body.provider,
        role: context.role,
        now,
      });
    } catch (error) {
      if (error instanceof RevenueCatClientError) {
        if (error.statusCode === 404) {
          return freeStatus(context.role, now);
        }

        throw new ApiError(
          502,
          'subscription_provider_unavailable',
          'Subscription validation is temporarily unavailable.',
        );
      }

      throw error;
    }
  }

  async getManageUrl(auth: AuthContext | undefined) {
    const context = requireSubscriptionOwner(auth);

    if (this.revenueCatClient.configured) {
      try {
        const customerInfo = await this.revenueCatClient.getSubscriber(
          context.workspaceId,
        );
        const revenueCatUrl = customerInfo.subscriber?.management_url;

        if (revenueCatUrl) {
          return { url: revenueCatUrl };
        }
      } catch {
        // Fall through to safe store URLs below.
      }
    }

    const subscription =
      await this.repository.findCurrentSubscriptionForWorkspace(
        context.workspaceId,
      );

    return {
      url:
        subscription?.provider === 'app_store'
          ? APP_STORE_MANAGE_URL
          : GOOGLE_PLAY_MANAGE_URL,
    };
  }

  async syncEntitlementForWorkspace(
    workspaceId: string,
    options: {
      fallbackProvider?: SubscriptionProviderDto;
      now?: Date;
    } = {},
  ) {
    if (!this.revenueCatClient.configured) {
      return null;
    }

    return this.syncRevenueCatEntitlement(workspaceId, {
      fallbackProvider: options.fallbackProvider ?? 'revenuecat',
      role: 'owner',
      now: options.now ?? new Date(),
    });
  }

  private async cachedOrFreeStatus(
    workspaceId: string,
    role: AuthContext['role'],
    now: Date,
  ) {
    const subscription =
      await this.repository.findCurrentSubscriptionForWorkspace(workspaceId);

    if (!hasTrustedPremiumEntitlement(subscription, now)) {
      return freeStatus(role, now);
    }

    return subscriptionStatusFromRecord(subscription, role, now);
  }

  private async syncRevenueCatEntitlement(
    workspaceId: string,
    input: {
      customerInfo?: RevenueCatCustomerInfo;
      fallbackProvider: SubscriptionProviderDto;
      role: AuthContext['role'];
      now: Date;
    },
  ) {
    const customerInfo =
      input.customerInfo ??
      (await this.revenueCatClient.getSubscriber(
        workspaceId,
        input.fallbackProvider,
      ));
    const resolved = resolveRevenueCatEntitlement({
      customerInfo,
      entitlementId: this.entitlementId,
      fallbackProvider: input.fallbackProvider,
      now: input.now,
    });
    const existing = await this.repository.findProviderSubscriptionForWorkspace(
      workspaceId,
      resolved.provider,
    );
    const saved = await this.repository.upsertSubscription({
      id: existing?.id,
      workspaceId,
      provider: resolved.provider,
      providerCustomerId: resolved.providerCustomerId,
      providerEntitlementId: resolved.providerEntitlementId,
      planType: resolved.planType,
      status: resolved.status,
      expiresAt: resolved.expiresAt,
      lastCheckedAt: resolved.checkedAt,
    });

    return subscriptionStatusFromRecord(saved, input.role, input.now);
  }
}
