import { describe, expect, it } from 'vitest';
import { canUseFeatureAccess } from './featureAccessPolicy';
import type { FeatureAccessDto } from './types';

function access(state: FeatureAccessDto['state']): FeatureAccessDto {
  return {
    key: 'aiSummary',
    tier: 'premium',
    lifecycle: state === 'notYetAvailable' ? 'planned' : 'available',
    state,
    roleEligible: state !== 'roleRestricted',
    upgradeEligible: state === 'upgradeRequired',
  };
}

describe('canUseFeatureAccess', () => {
  it.each([
    ['available', true],
    ['upgradeRequired', false],
    ['roleRestricted', false],
    ['notYetAvailable', false],
    ['unavailable', false],
  ] as const)('allows a feature only when state is %s', (state, expected) => {
    expect(canUseFeatureAccess(access(state))).toBe(expected);
  });
});
