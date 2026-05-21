import { defineStore } from 'pinia'
import type { PlanType, UserRole } from '@/features/access/types'

interface UserAccessState {
  planType: PlanType
  userRole: UserRole
}

export const useUserAccessStore = defineStore('userAccess', {
  state: (): UserAccessState => ({
    planType: 'free',
    userRole: 'owner',
  }),
  getters: {
    isPremium: (state) => state.planType === 'premium',
  },
  actions: {
    setMockPlan(planType: PlanType) {
      this.planType = planType
    },
    setAccountPlan(planType: PlanType) {
      this.planType = planType
    },
    setMockRole(userRole: UserRole) {
      this.userRole = userRole
    },
  },
})
