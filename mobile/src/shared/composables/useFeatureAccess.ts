import { computed } from 'vue'
import { featureAccessConfig } from '@/features/access/featureAccess.config'
import type { FeatureKey, PlanType, UserRole } from '@/features/access/types'
import { useUserAccessStore } from '@/app/stores/userAccess'

export function useFeatureAccess() {
  const accessStore = useUserAccessStore()

  const planType = computed(() => accessStore.planType)
  const userRole = computed(() => accessStore.userRole)
  const isPremium = computed(() => accessStore.isPremium)

  function canUseFeature(featureKey: FeatureKey) {
    const access = featureAccessConfig[featureKey]

    if (!access.plans.includes(accessStore.planType)) {
      return false
    }

    if (access.roles && !access.roles.includes(accessStore.userRole)) {
      return false
    }

    return true
  }

  function getFeatureAccess(featureKey: FeatureKey) {
    return featureAccessConfig[featureKey]
  }

  function getFreeLimit(featureKey: FeatureKey) {
    return featureAccessConfig[featureKey].freeLimit
  }

  function setMockPlan(nextPlan: PlanType) {
    accessStore.setMockPlan(nextPlan)
  }

  function setMockRole(nextRole: UserRole) {
    accessStore.setMockRole(nextRole)
  }

  return {
    planType,
    userRole,
    isPremium,
    canUseFeature,
    getFeatureAccess,
    getFreeLimit,
    setMockPlan,
    setMockRole,
  }
}
