import type { FeatureAccessDto } from './types';

export function canUseFeatureAccess(access: FeatureAccessDto | undefined) {
  return access?.state === 'available';
}
