import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { featureAccessConfig } from '@/features/access/featureAccess.config';
import type { FeatureKey, UserRole } from '@/features/access/types';
import type { Meeting } from '@/features/meeting/types';
import { useUserAccessStore } from '@/app/stores/userAccess';

export function useFeatureAccess() {
  const { t, te } = useI18n();
  const accessStore = useUserAccessStore();
  const subscriptionStore = useSubscriptionStore();
  const workspaceStore = useWorkspaceStore();

  const planType = computed(() => subscriptionStore.currentPlan);
  const userRole = computed(() => workspaceStore.currentUserRole);
  const isPremium = computed(() => subscriptionStore.hasPremiumEntitlement);

  function canUseFeature(featureKey: FeatureKey) {
    const access = featureAccessConfig[featureKey];
    const effectivePlan = subscriptionStore.currentPlan;

    if (!access.plans.includes(effectivePlan)) {
      return false;
    }

    if (
      effectivePlan === 'premium' &&
      access.plans.length === 1 &&
      !subscriptionStore.hasPremiumEntitlement
    ) {
      return false;
    }

    if (
      access.roles &&
      !access.roles.includes(workspaceStore.currentUserRole)
    ) {
      return false;
    }

    return true;
  }

  function canAccessMeetingHistoryItem(
    meeting: Pick<Meeting, 'status'>,
    completedMeetingIndex: number
  ) {
    if (meeting.status !== 'completed') {
      return true;
    }

    if (canUseFeature('unlimitedHistory')) {
      return true;
    }

    const freeLimit = getFreeLimit('limitedHistory') ?? 3;
    return completedMeetingIndex >= 0 && completedMeetingIndex < freeLimit;
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

  function getFreeLimit(featureKey: FeatureKey) {
    return featureAccessConfig[featureKey].freeLimit;
  }

  function setMockRole(nextRole: UserRole) {
    workspaceStore.setCurrentMemberRole(nextRole);
    accessStore.setMockRole(nextRole);
  }

  return {
    planType,
    userRole,
    isPremium,
    canUseFeature,
    canAccessMeetingHistoryItem,
    getFeatureAccess,
    getFreeLimit,
    setMockRole,
  };
}
