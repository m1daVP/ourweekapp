import { featureAccessConfig } from './featureAccess.config';
import type { FeatureKey, PlanType, UserRole } from './types';

export interface FeatureAccessContext {
  plan: PlanType;
  hasPremiumEntitlement: boolean;
  role: UserRole;
}

export function canUseFeatureWithContext(
  featureKey: FeatureKey,
  context: FeatureAccessContext
): boolean {
  const access = featureAccessConfig[featureKey];

  if (!access.plans.includes(context.plan)) {
    return false;
  }

  if (
    context.plan === 'premium' &&
    access.plans.length === 1 &&
    !context.hasPremiumEntitlement
  ) {
    return false;
  }

  if (access.roles && !access.roles.includes(context.role)) {
    return false;
  }

  return true;
}
