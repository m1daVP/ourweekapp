import { featureAccessConfig } from './featureAccess.config';
import type {
  FeatureAccessDto,
  FeatureAccessMap,
  FeatureKey,
  PlanType,
} from './types';

const premiumFeatureKeys = new Set<FeatureKey>([
  'aiSummary',
  'additionalTemplates',
  'privateNotes',
  'googleCalendarSync',
  'export',
  'advancedStatistics',
]);

const featureKeys = Object.keys(featureAccessConfig) as FeatureKey[];

export function createLegacyFeatureAccessMap(input: {
  planType: PlanType;
  enabledFeatures?: readonly FeatureKey[];
}): FeatureAccessMap {
  const enabledFeatures = new Set(input.enabledFeatures ?? []);

  return Object.fromEntries(featureKeys.map((key) => {
    const tier = premiumFeatureKeys.has(key) ? 'premium' : 'free';
    const lifecycle = 'available';
    const enabled = lifecycle === 'available' && (
      tier === 'free' ||
      enabledFeatures.has(key) ||
      (enabledFeatures.size === 0 && input.planType === 'premium')
    );
    const state: FeatureAccessDto['state'] = lifecycle === 'planned'
      ? 'notYetAvailable'
      : enabled
        ? 'available'
        : tier === 'premium'
          ? 'upgradeRequired'
          : 'unavailable';

    return [key, {
      key,
      tier,
      lifecycle,
      state,
      roleEligible: true,
      upgradeEligible: state === 'upgradeRequired',
    }];
  })) as FeatureAccessMap;
}
