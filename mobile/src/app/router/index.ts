import { createRouter, createWebHistory } from 'vue-router';
import { featureAccessConfig } from '@/features/access/featureAccess.config';
import { useAuthStore } from '@/app/stores/auth';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { appConfig } from '@/shared/config/env';
import AccountPage from '@/pages/AccountPage.vue';
import CalendarSyncPage from '@/pages/CalendarSyncPage.vue';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage.vue';
import HomePage from '@/pages/HomePage.vue';
import HistoryPage from '@/pages/HistoryPage.vue';
import LogoutConfirmationPage from '@/pages/LogoutConfirmationPage.vue';
import MeetingDetailsPage from '@/pages/MeetingDetailsPage.vue';
import MeetingPage from '@/pages/MeetingPage.vue';
import MeetingSummaryPage from '@/pages/MeetingSummaryPage.vue';
import MeetingTemplatesPage from '@/pages/MeetingTemplatesPage.vue';
import PrivateNotesPage from '@/pages/PrivateNotesPage.vue';
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage.vue';
import SettingsPage from '@/pages/SettingsPage.vue';
import SignInPage from '@/pages/SignInPage.vue';
import SignUpPage from '@/pages/SignUpPage.vue';
import TasksPage from '@/pages/TasksPage.vue';
import TermsPage from '@/pages/TermsPage.vue';
import UpgradePage from '@/pages/UpgradePage.vue';
import WelcomePage from '@/pages/WelcomePage.vue';
import WorkspaceSettingsPage from '@/pages/WorkspaceSettingsPage.vue';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    return { top: 0, left: 0 };
  },
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
      path: '/meeting/templates',
      name: 'meeting-templates',
      component: MeetingTemplatesPage,
    },
    {
      path: '/meeting',
      name: 'meeting',
      component: MeetingPage,
      meta: { hideNavigation: true },
    },
    {
      path: '/history',
      name: 'history',
      component: HistoryPage,
      meta: { requiresFeature: 'limitedHistory' },
    },
    {
      path: '/history/private-notes',
      name: 'private-notes',
      component: PrivateNotesPage,
    },
    {
      path: '/history/:meetingId',
      name: 'meeting-details',
      component: MeetingDetailsPage,
      meta: { requiresFeature: 'limitedHistory' },
    },
    {
      path: '/meeting-summary/:meetingId',
      name: 'meeting-summary',
      component: MeetingSummaryPage,
      meta: { hideNavigation: true, requiresFeature: 'limitedHistory' },
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
    {
      path: '/settings/privacy',
      name: 'privacy',
      component: PrivacyPolicyPage,
      meta: { isPublicEntry: true },
    },
    {
      path: '/settings/terms',
      name: 'terms',
      component: TermsPage,
      meta: { isPublicEntry: true },
    },
    {
      path: '/settings/calendar-sync',
      name: 'calendar-sync',
      component: CalendarSyncPage,
    },
    {
      path: '/settings/upgrade',
      name: 'upgrade',
      component: UpgradePage,
    },
    {
      path: '/settings/workspace',
      name: 'workspace-settings',
      component: WorkspaceSettingsPage,
    },
    {
      path: '/settings/account',
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

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const subscriptionStore = useSubscriptionStore();
  const workspaceStore = useWorkspaceStore();

  await authStore.hydrateSecureTokens();

  if (authStore.authStatus === 'authenticated') {
    await authStore.verifyCurrentUser();
  }

  authStore.syncAccessState();

  if (
    appConfig.isBackendApiEnabled &&
    authStore.isLocalOnly &&
    !to.meta.isPublicEntry
  ) {
    return { name: 'welcome' };
  }

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

  if (to.name === 'calendar-sync' && !appConfig.isGoogleCalendarSyncEnabled) {
    return { name: 'settings' };
  }

  const requiredFeature = to.meta.requiresFeature;
  const requiresPremium = to.meta.requiresPremium;

  if (!requiredFeature && !requiresPremium) {
    return true;
  }

  const featureAccess = requiredFeature
    ? featureAccessConfig[requiredFeature]
    : undefined;
  const effectivePlan = subscriptionStore.currentPlan;
  const hasRequiredFeature = featureAccess
    ? featureAccess.plans.includes(effectivePlan) &&
      (effectivePlan !== 'premium' ||
        subscriptionStore.hasPremiumEntitlement) &&
      (!featureAccess.roles ||
        featureAccess.roles.includes(workspaceStore.currentUserRole))
    : true;
  const hasPremiumPlan = requiresPremium
    ? effectivePlan === 'premium' && subscriptionStore.hasPremiumEntitlement
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
