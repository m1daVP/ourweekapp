import { createRouter, createWebHistory } from 'vue-router'
import { featureAccessConfig } from '@/features/access/featureAccess.config'
import { useUserAccessStore } from '@/app/stores/userAccess'
import HomePage from '@/pages/HomePage.vue'
import MeetingPage from '@/pages/MeetingPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'
import TasksPage from '@/pages/TasksPage.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/meeting',
      name: 'meeting',
      component: MeetingPage,
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: TasksPage,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsPage,
    },
  ],
})

router.beforeEach((to) => {
  const accessStore = useUserAccessStore()
  const requiredFeature = to.meta.requiresFeature
  const requiresPremium = to.meta.requiresPremium

  if (!requiredFeature && !requiresPremium) {
    return true
  }

  const featureAccess = requiredFeature ? featureAccessConfig[requiredFeature] : undefined
  const hasRequiredFeature = featureAccess
    ? featureAccess.plans.includes(accessStore.planType) &&
      (!featureAccess.roles || featureAccess.roles.includes(accessStore.userRole))
    : true
  const hasPremiumPlan = requiresPremium ? accessStore.planType === 'premium' : true

  if (hasRequiredFeature && hasPremiumPlan) {
    return true
  }

  return {
    name: to.meta.lockedRedirectName ?? 'settings',
    query: requiredFeature ? { lockedFeature: requiredFeature } : { upgrade: 'premium' },
  }
})
