import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/app/stores/auth';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { createBackgroundAuthVerificationCoordinator } from '@/app/router/backgroundAuthVerification';
import { legacySettingsRoutes } from '@/app/router/legacySettingsRoutes';
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
import ResetPasswordPage from '@/pages/ResetPasswordPage.vue';
import SettingsPage from '@/pages/SettingsPage.vue';
import SignInPage from '@/pages/SignInPage.vue';
import SignUpPage from '@/pages/SignUpPage.vue';
import SupportDiagnosticsPage from '@/pages/SupportDiagnosticsPage.vue';
import TasksPage from '@/pages/TasksPage.vue';
import TermsPage from '@/pages/TermsPage.vue';
import UpgradePage from '@/pages/UpgradePage.vue';
import WelcomePage from '@/pages/WelcomePage.vue';

const unauthenticatedRouteNames = new Set([
  'welcome',
  'sign-in',
  'sign-up',
  'forgot-password',
  'reset-password',
]);

function isUnauthenticatedRouteName(routeName: unknown) {
  return (
    typeof routeName === 'string' && unauthenticatedRouteNames.has(routeName)
  );
}

function getSignedOutRedirect(routeName: unknown, fullPath: string) {
  if (routeName === 'home') {
    return { name: 'welcome' };
  }

  return {
    name: 'sign-in',
    query: { redirect: fullPath },
  };
}

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
      meta: { hideNavigation: true, guestOnly: true },
    },
    {
      path: '/sign-up',
      name: 'sign-up',
      component: SignUpPage,
      meta: { hideNavigation: true, guestOnly: true },
    },
    {
      path: '/sign-in',
      name: 'sign-in',
      component: SignInPage,
      meta: { hideNavigation: true, guestOnly: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPasswordPage,
      meta: { hideNavigation: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: ResetPasswordPage,
      meta: { hideNavigation: true },
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
      meta: { requiresFeature: 'meetingHistory' },
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
      meta: { requiresFeature: 'meetingHistory' },
    },
    {
      path: '/meeting-summary/:meetingId',
      name: 'meeting-summary',
      component: MeetingSummaryPage,
      meta: {
        hideNavigation: true,
        requiresFeature: 'meetingHistory',
      },
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
    ...legacySettingsRoutes,
    {
      path: '/settings/privacy',
      name: 'privacy',
      component: PrivacyPolicyPage,
    },
    {
      path: '/settings/terms',
      name: 'terms',
      component: TermsPage,
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
      path: '/settings/account',
      name: 'account',
      component: AccountPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/support',
      name: 'support-diagnostics',
      component: SupportDiagnosticsPage,
      meta: { hideNavigation: true },
    },
    {
      path: '/logout',
      name: 'logout',
      component: LogoutConfirmationPage,
      meta: { requiresAuth: true, hideNavigation: true },
    },
  ],
});

const backgroundAuthVerification = createBackgroundAuthVerificationCoordinator({
  getAuthStore: useAuthStore,
  getCurrentRoute: () => router.currentRoute.value,
  getSignedOutRedirect,
  isUnauthenticatedRouteName,
  replace: (target) => router.replace(target),
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const subscriptionStore = useSubscriptionStore();
  const isUnauthenticatedRoute = isUnauthenticatedRouteName(to.name);

  await authStore.hydrateSecureTokens();

  if (authStore.authStatus === 'authenticated') {
    void backgroundAuthVerification.requestVerification();
  }

  if (!authStore.isAuthenticated && !isUnauthenticatedRoute) {
    return getSignedOutRedirect(to.name, to.fullPath);
  }

  if (
    to.meta.guestOnly &&
    authStore.isAuthenticated &&
    authStore.sessionCheckStatus === 'verified'
  ) {
    return { name: 'home' };
  }

  const requiredFeature = to.meta.requiresFeature;
  const requiresPremium = to.meta.requiresPremium;

  if (!requiredFeature && !requiresPremium) {
    return true;
  }

  const effectivePlan = subscriptionStore.currentPlan;
  const hasRequiredFeature = requiredFeature
    ? subscriptionStore.getFeatureAccess(requiredFeature).state === 'available'
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
