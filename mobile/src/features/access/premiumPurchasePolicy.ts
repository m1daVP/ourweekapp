import type { FeatureAccessState, UserRole } from './types';

export function canPurchasePremium(role: UserRole) {
  return role === 'owner';
}

export function canOfferFeatureUpgrade(
  role: UserRole,
  state: FeatureAccessState | undefined
) {
  return canPurchasePremium(role) && state === 'upgradeRequired';
}
