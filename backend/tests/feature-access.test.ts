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

  it('makes advanced statistics available to Premium adults and owners only', () => {
    expect(resolveFeatureAccess(featureCatalog.advancedStatistics, {
      planType: 'premium',
      role: 'adult_member',
    })).toMatchObject({
      lifecycle: 'available',
      state: 'available',
      upgradeEligible: false,
    });
    expect(resolveFeatureAccess(featureCatalog.advancedStatistics, {
      planType: 'premium',
      role: 'viewer',
    })).toMatchObject({
      lifecycle: 'available',
      state: 'roleRestricted',
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

  it.each(['owner', 'adult_member', 'viewer'] as const)(
    'keeps complete meeting history available for a free %s',
    (role) => {
      const access = resolveFeatureAccessMap({ planType: 'free', role });

      expect(access.meetingHistory).toMatchObject({
        tier: 'free',
        state: 'available',
        upgradeEligible: false,
      });
      expect(access.limitedHistory.state).toBe('available');
      expect(access.unlimitedHistory).toMatchObject({
        tier: 'free',
        state: 'available',
      });
    },
  );

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
