import { computed } from 'vue';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { featureAccessConfig } from '@/features/access/featureAccess.config';
import type { FeatureKey, PlanType, UserRole } from '@/features/access/types';
import type { Meeting } from '@/features/meeting/types';
import { useUserAccessStore } from '@/app/stores/userAccess';

export function useFeatureAccess() {
  const accessStore = useUserAccessStore();
  const workspaceStore = useWorkspaceStore();

  const planType = computed(() => accessStore.planType);
  const userRole = computed(() => workspaceStore.currentUserRole);
  const isPremium = computed(() => accessStore.isPremium);

  function canUseFeature(featureKey: FeatureKey) {
    const access = featureAccessConfig[featureKey];

    if (!access.plans.includes(accessStore.planType)) {
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
    return featureAccessConfig[featureKey];
  }

  function getFreeLimit(featureKey: FeatureKey) {
    return featureAccessConfig[featureKey].freeLimit;
  }

  function setMockPlan(nextPlan: PlanType) {
    accessStore.setMockPlan(nextPlan);
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
    setMockPlan,
    setMockRole,
  };
}
