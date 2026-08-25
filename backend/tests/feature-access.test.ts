import { describe, expect, it } from 'vitest';

import {
  featureCatalog,
  resolveFeatureAccess,
  resolveFeatureAccessMap,
  subscriptionFeatureKeys,
} from '../src/modules/billing/feature-access.js';

describe('feature access catalog', () => {
  it('defines one entry for every stable feature key', () => {
    expect(Object.keys(featureCatalog).sort()).toEqual([...subscriptionFeatureKeys].sort());
  });

  it('does not offer an upgrade for a planned Premium feature', () => {
    expect(resolveFeatureAccess(featureCatalog.advancedStatistics, {
      planType: 'free',
      role: 'owner',
    })).toMatchObject({
      state: 'notYetAvailable',
      upgradeEligible: false,
    });
  });

  it('prioritizes role restrictions over Premium entitlement', () => {
    expect(resolveFeatureAccess(featureCatalog.aiSummary, {
      planType: 'free',
      role: 'viewer',
    })).toMatchObject({
      state: 'roleRestricted',
      upgradeEligible: false,
    });
  });

  it('keeps agreement reminders available for free workspaces', () => {
    expect(resolveFeatureAccessMap({
      planType: 'free',
      role: 'adult_member',
    }).agreementReminders).toMatchObject({ state: 'available' });
  });

  it('unlocks available Premium features only for eligible members', () => {
    expect(resolveFeatureAccessMap({
      planType: 'premium',
      role: 'adult_member',
    }).aiSummary.state).toBe('available');
    expect(resolveFeatureAccessMap({
      planType: 'premium',
      role: 'viewer',
    }).googleCalendarSync.state).toBe('roleRestricted');
  });
});
