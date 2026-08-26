import { describe, expect, it } from 'vitest';

import {
  canOfferFeatureUpgrade,
  canPurchasePremium,
} from './premiumPurchasePolicy';

describe('premium purchase policy', () => {
  it.each([
    ['owner', true],
    ['adult_member', false],
    ['viewer', false],
  ] as const)('allows %s to purchase Premium: %s', (role, expected) => {
    expect(canPurchasePremium(role)).toBe(expected);
  });

  it.each([
    ['owner', 'upgradeRequired', true],
    ['adult_member', 'upgradeRequired', false],
    ['viewer', 'roleRestricted', false],
    ['owner', 'notYetAvailable', false],
  ] as const)(
    'offers a feature upgrade only for %s/%s',
    (role, state, expected) => {
      expect(canOfferFeatureUpgrade(role, state)).toBe(expected);
    }
  );
});
