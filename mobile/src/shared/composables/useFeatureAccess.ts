import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { featureAccessConfig } from '@/features/access/featureAccess.config';
import { canUseFeatureAccess } from '@/features/access/featureAccessPolicy';
import type { FeatureKey } from '@/features/access/types';

export function useFeatureAccess() {
  const { t, te } = useI18n();
  const subscriptionStore = useSubscriptionStore();
  const workspaceStore = useWorkspaceStore();

  const planType = computed(() => subscriptionStore.currentPlan);
  const userRole = computed(() => workspaceStore.currentUserRole);
  const isPremium = computed(() => subscriptionStore.hasPremiumEntitlement);

  function canUseFeature(featureKey: FeatureKey) {
    return canUseFeatureAccess(subscriptionStore.getFeatureAccess(featureKey));
  }

  function getFeatureAccessState(featureKey: FeatureKey) {
    return subscriptionStore.getFeatureAccess(featureKey).state;
  }

  function getFeatureAccess(featureKey: FeatureKey) {
    const feature = featureAccessConfig[featureKey];

    return {
      ...feature,
      label: te(`features.${featureKey}.label`)
        ? t(`features.${featureKey}.label`)
        : feature.label,
      description: te(`features.${featureKey}.description`)
        ? t(`features.${featureKey}.description`)
        : feature.description,
      lockedReason: te(`features.${featureKey}.lockedReason`)
        ? t(`features.${featureKey}.lockedReason`)
        : feature.lockedReason,
    };
  }

  return {
    planType,
    userRole,
    isPremium,
    canUseFeature,
    getFeatureAccessState,
    getFeatureAccess,
  };
}
