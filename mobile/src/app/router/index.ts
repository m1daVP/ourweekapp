import { createRouter, createWebHistory } from 'vue-router';
import { featureAccessConfig } from '@/features/access/featureAccess.config';
import { useAuthStore } from '@/app/stores/auth';
import { useUserAccessStore } from '@/app/stores/userAccess';
import AccountPage from '@/pages/AccountPage.vue';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage.vue';
import HomePage from '@/pages/HomePage.vue';
import HistoryPage from '@/pages/HistoryPage.vue';
import LogoutConfirmationPage from '@/pages/LogoutConfirmationPage.vue';
import MeetingDetailsPage from '@/pages/MeetingDetailsPage.vue';
import MeetingPage from '@/pages/MeetingPage.vue';
import PrivateNotesPage from '@/pages/PrivateNotesPage.vue';
import SettingsPage from '@/pages/SettingsPage.vue';
import SignInPage from '@/pages/SignInPage.vue';
import SignUpPage from '@/pages/SignUpPage.vue';
import TasksPage from '@/pages/TasksPage.vue';
import WelcomePage from '@/pages/WelcomePage.vue';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/welcome',
      name: 'welcome',
      component: WelcomePage,
      meta: { hideNavigation: true, isPublicEntry: true },
    },
    {
      path: '/sign-up',
      name: 'sign-up',
      component: SignUpPage,
      meta: { hideNavigation: true, guestOnly: true, isPublicEntry: true },
    },
    {
      path: '/sign-in',
      name: 'sign-in',
      component: SignInPage,
      meta: { hideNavigation: true, guestOnly: true, isPublicEntry: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPasswordPage,
      meta: { hideNavigation: true, guestOnly: true, isPublicEntry: true },
    },
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
      path: '/history',
      name: 'history',
      component: HistoryPage,
      meta: { requiresFeature: 'limitedHistory' },
    },
    {
      path: '/history/:meetingId',
      name: 'meeting-details',
      component: MeetingDetailsPage,
      meta: { requiresFeature: 'limitedHistory' },
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: TasksPage,
    },
    {
      path: '/private-notes',
      name: 'private-notes',
      component: PrivateNotesPage,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsPage,
    },
    {
      path: '/account',
      name: 'account',
      component: AccountPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/logout',
      name: 'logout',
      component: LogoutConfirmationPage,
      meta: { requiresAuth: true, hideNavigation: true },
    },
  ],
});

router.beforeEach((to) => {
  const authStore = useAuthStore();
  const accessStore = useUserAccessStore();

  authStore.syncAccessState();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return {
      name: 'sign-in',
      query: { redirect: to.fullPath },
    };
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'home' };
  }

  if (authStore.authStatus === 'idle' && !to.meta.isPublicEntry) {
    return { name: 'welcome' };
  }

  const requiredFeature = to.meta.requiresFeature;
  const requiresPremium = to.meta.requiresPremium;

  if (!requiredFeature && !requiresPremium) {
    return true;
  }

  const featureAccess = requiredFeature
    ? featureAccessConfig[requiredFeature]
    : undefined;
  const hasRequiredFeature = featureAccess
    ? featureAccess.plans.includes(accessStore.planType) &&
      (!featureAccess.roles ||
        featureAccess.roles.includes(accessStore.userRole))
    : true;
  const hasPremiumPlan = requiresPremium
    ? accessStore.planType === 'premium'
    : true;

  if (hasRequiredFeature && hasPremiumPlan) {
    return true;
  }

  return {
    name: to.meta.lockedRedirectName ?? 'settings',
    query: requiredFeature
      ? { lockedFeature: requiredFeature }
      : { upgrade: 'premium' },
  };
});
