import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { PlanType, UserRole } from '../../shared/auth/index.js';
import { requireAuthenticatedContext } from '../../shared/auth/index.js';
import { ApiError } from '../../shared/errors/index.js';
import { resolveEffectivePlan } from '../../shared/repositories/index.js';
import type {
  SubscriptionDto,
  SubscriptionRecord,
  SubscriptionsRepository,
} from './subscriptions.repository.js';

const TRUSTED_ENTITLEMENT_CACHE_MS = 24 * 60 * 60 * 1000;

export const subscriptionFeatureKeys = [
  'basicMeetings',
  'defaultTemplate',
  'tasksAndAgreements',
  'manualResponsibility',
  'meetingHistory',
  'limitedHistory',
  'localReminders',
  'unlimitedHistory',
  'aiSummary',
  'smartFollowUps',
  'agreementReminders',
  'additionalTemplates',
  'privateNotes',
  'googleCalendarSync',
  'export',
  'advancedStatistics',
] as const;

export const subscriptionFeatureSchema = z.enum(subscriptionFeatureKeys);
export const featureTierSchema = z.enum(['free', 'premium']);
export const featureLifecycleSchema = z.enum(['available', 'planned', 'retired']);
export const featureAccessStateSchema = z.enum([
  'available',
  'upgradeRequired',
  'roleRestricted',
  'notYetAvailable',
  'unavailable',
]);

export type SubscriptionFeatureKey = z.infer<typeof subscriptionFeatureSchema>;
export type FeatureTier = z.infer<typeof featureTierSchema>;
export type FeatureLifecycle = z.infer<typeof featureLifecycleSchema>;
export type FeatureAccessState = z.infer<typeof featureAccessStateSchema>;

export type FeatureCatalogEntry = {
  key: SubscriptionFeatureKey;
  tier: FeatureTier;
  lifecycle: FeatureLifecycle;
  eligibleRoles: readonly UserRole[];
  enforcement: 'server' | 'client' | 'both';
};

const allRoles = ['owner', 'adult_member', 'viewer'] as const satisfies readonly UserRole[];
const adultRoles = ['owner', 'adult_member'] as const satisfies readonly UserRole[];

export const featureCatalog = {
  basicMeetings: {
    key: 'basicMeetings', tier: 'free', lifecycle: 'available', eligibleRoles: allRoles, enforcement: 'both',
  },
  defaultTemplate: {
    key: 'defaultTemplate', tier: 'free', lifecycle: 'available', eligibleRoles: allRoles, enforcement: 'both',
  },
  tasksAndAgreements: {
    key: 'tasksAndAgreements', tier: 'free', lifecycle: 'available', eligibleRoles: allRoles, enforcement: 'both',
  },
  manualResponsibility: {
    key: 'manualResponsibility', tier: 'free', lifecycle: 'available', eligibleRoles: allRoles, enforcement: 'both',
  },
  meetingHistory: {
    key: 'meetingHistory', tier: 'free', lifecycle: 'available', eligibleRoles: allRoles, enforcement: 'server',
  },
  // Temporary compatibility alias for clients released before Milestone 1.
  limitedHistory: {
    key: 'limitedHistory', tier: 'free', lifecycle: 'available', eligibleRoles: allRoles, enforcement: 'both',
  },
  localReminders: {
    key: 'localReminders', tier: 'free', lifecycle: 'available', eligibleRoles: allRoles, enforcement: 'client',
  },
  // Temporary compatibility alias for clients released before Milestone 1.
  unlimitedHistory: {
    key: 'unlimitedHistory', tier: 'free', lifecycle: 'available', eligibleRoles: allRoles, enforcement: 'server',
  },
  aiSummary: {
    key: 'aiSummary', tier: 'premium', lifecycle: 'available', eligibleRoles: adultRoles, enforcement: 'server',
  },
  smartFollowUps: {
    key: 'smartFollowUps', tier: 'premium', lifecycle: 'available', eligibleRoles: adultRoles, enforcement: 'server',
  },
  agreementReminders: {
    key: 'agreementReminders', tier: 'free', lifecycle: 'available', eligibleRoles: allRoles, enforcement: 'client',
  },
  additionalTemplates: {
    key: 'additionalTemplates', tier: 'premium', lifecycle: 'available', eligibleRoles: adultRoles, enforcement: 'both',
  },
  privateNotes: {
    key: 'privateNotes', tier: 'premium', lifecycle: 'available', eligibleRoles: allRoles, enforcement: 'client',
  },
  googleCalendarSync: {
    key: 'googleCalendarSync', tier: 'premium', lifecycle: 'available', eligibleRoles: adultRoles, enforcement: 'server',
  },
  export: {
    key: 'export', tier: 'premium', lifecycle: 'available', eligibleRoles: adultRoles, enforcement: 'server',
  },
  advancedStatistics: {
    key: 'advancedStatistics', tier: 'premium', lifecycle: 'available', eligibleRoles: adultRoles, enforcement: 'server',
  },
} as const satisfies Record<SubscriptionFeatureKey, FeatureCatalogEntry>;

export const featureAccessDtoSchema = z.object({
  key: subscriptionFeatureSchema,
  tier: featureTierSchema,
  lifecycle: featureLifecycleSchema,
  state: featureAccessStateSchema,
  roleEligible: z.boolean(),
  upgradeEligible: z.boolean(),
});

export const featureAccessMapSchema = z.record(
  subscriptionFeatureSchema,
  featureAccessDtoSchema,
);

export type FeatureAccessDto = z.infer<typeof featureAccessDtoSchema>;
export type FeatureAccessMap = z.infer<typeof featureAccessMapSchema>;

function roleIsEligible(feature: FeatureCatalogEntry, role: UserRole) {
  return (feature.eligibleRoles as readonly UserRole[]).includes(role);
}

function isRecentlyChecked(subscription: SubscriptionDto, now: Date) {
  const checkedAt = Date.parse(subscription.lastCheckedAt);

  return (
    Number.isFinite(checkedAt) &&
    now.getTime() - checkedAt <= TRUSTED_ENTITLEMENT_CACHE_MS
  );
}

export function hasTrustedPremiumEntitlement(
  subscription: SubscriptionDto | SubscriptionRecord | null,
  now = new Date(),
) {
  if (!subscription || !isRecentlyChecked(subscription, now)) {
    return false;
  }

  return (
    resolveEffectivePlan(
      {
        plan_type: subscription.planType,
        status: subscription.status,
        expires_at: subscription.expiresAt,
      },
      now,
    ) === 'premium'
  );
}

export function resolveFeatureAccess(
  feature: FeatureCatalogEntry,
  context: { planType: PlanType; role: UserRole },
): FeatureAccessDto {
  const roleEligible = roleIsEligible(feature, context.role);
  let state: FeatureAccessState;

  if (feature.lifecycle === 'planned') {
    state = 'notYetAvailable';
  } else if (feature.lifecycle === 'retired') {
    state = 'unavailable';
  } else if (!roleEligible) {
    state = 'roleRestricted';
  } else if (feature.tier === 'premium' && context.planType !== 'premium') {
    state = 'upgradeRequired';
  } else {
    state = 'available';
  }

  return {
    key: feature.key,
    tier: feature.tier,
    lifecycle: feature.lifecycle,
    state,
    roleEligible,
    upgradeEligible: state === 'upgradeRequired',
  };
}

export function resolveFeatureAccessMap(context: {
  planType: PlanType;
  role: UserRole;
}): FeatureAccessMap {
  return Object.fromEntries(
    subscriptionFeatureKeys.map((key) => [
      key,
      resolveFeatureAccess(featureCatalog[key], context),
    ]),
  ) as FeatureAccessMap;
}

export function enabledFeatureKeys(access: FeatureAccessMap) {
  return subscriptionFeatureKeys.filter((key) => access[key].state === 'available');
}

type SubscriptionEntitlementRepository = Pick<
  SubscriptionsRepository,
  'findCurrentSubscriptionForWorkspace'
>;

export async function resolveWorkspaceFeatureAccess(
  repository: SubscriptionEntitlementRepository,
  auth: FastifyRequest['auth'],
  now = new Date(),
) {
  const context = requireAuthenticatedContext(auth);
  const subscription = (await repository.findCurrentSubscriptionForWorkspace(
    context.workspaceId,
  )) as SubscriptionDto | SubscriptionRecord | null;

  return {
    context,
    access: resolveFeatureAccessMap({
      planType: hasTrustedPremiumEntitlement(subscription, now) ? 'premium' : 'free',
      role: context.role,
    }),
  };
}

export async function assertFeatureAccess(
  repository: SubscriptionEntitlementRepository,
  auth: FastifyRequest['auth'],
  featureKey: SubscriptionFeatureKey,
  now = new Date(),
) {
  const context = requireAuthenticatedContext(auth);
  const catalogEntry = featureCatalog[featureKey];

  if (catalogEntry.lifecycle !== 'available') {
    throw new ApiError(404, 'feature_not_available', 'This feature is not available.');
  }

  if (!roleIsEligible(catalogEntry, context.role)) {
    throw new ApiError(403, 'feature_role_restricted', 'Your workspace role cannot use this feature.');
  }

  const { access } = await resolveWorkspaceFeatureAccess(repository, auth, now);
  const feature = access[featureKey];

  if (feature.state === 'available') {
    return context;
  }

  if (feature.state === 'roleRestricted') {
    throw new ApiError(403, 'feature_role_restricted', 'Your workspace role cannot use this feature.');
  }

  if (feature.state === 'upgradeRequired') {
    throw new ApiError(403, 'premium_required', 'Premium is required for this feature.');
  }

  throw new ApiError(404, 'feature_not_available', 'This feature is not available.');
}
