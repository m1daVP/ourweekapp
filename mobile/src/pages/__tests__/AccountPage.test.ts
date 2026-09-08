// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

const state = vi.hoisted(() => ({
  user: {
    email: 'member@example.com',
    displayName: 'Member',
    createdAt: '2026-08-01T00:00:00.000Z',
    signInMethods: ['password'] as Array<'password' | 'google'>,
  },
  role: 'owner' as 'owner' | 'adult_member' | 'viewer',
  revenueCatEnabled: true,
  restorePurchases: vi.fn(),
  googleSupported: true,
  linkGoogleAccount: vi.fn(),
  subscription: {
    currentPlan: 'free' as const,
    hasPremiumEntitlement: false,
    premiumEntitlement: null,
    canManageSubscription: false,
    isRestoring: false,
    isManaging: false,
    statusMessage: '',
    errorMessage: '',
  },
}));

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal()),
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: 'en' },
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/app/stores/auth', () => ({
  useAuthStore: () => ({
    user: state.user,
    updateProfile: vi.fn(),
    clearSessionAfterUnauthorized: vi.fn(),
    linkGoogleAccount: state.linkGoogleAccount,
    isLinkingGoogle: false,
    googleLinkErrorMessage: '',
  }),
}));

vi.mock('@/features/auth/googleSignInService', () => ({
  isNativeGoogleSignInSupported: () => state.googleSupported,
}));

vi.mock('@/app/stores/calendarSync', () => ({
  useCalendarSyncStore: () => ({ $reset: vi.fn() }),
}));

vi.mock('@/app/stores/meetings', () => ({
  useMeetingsStore: () => ({ $reset: vi.fn() }),
}));

vi.mock('@/app/stores/participants', () => ({
  useParticipantsStore: () => ({ $reset: vi.fn() }),
}));

vi.mock('@/app/stores/privateNotes', () => ({
  usePrivateNotesStore: () => ({ $reset: vi.fn() }),
}));

vi.mock('@/app/stores/reminders', () => ({
  useRemindersStore: () => ({ $reset: vi.fn() }),
}));

vi.mock('@/app/stores/tasks', () => ({
  useTasksStore: () => ({ $reset: vi.fn() }),
}));

vi.mock('@/app/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    currentUserRole: state.role,
    $reset: vi.fn(),
  }),
}));

vi.mock('@/app/stores/subscription', () => ({
  useSubscriptionStore: () => ({
    ...state.subscription,
    restorePurchases: state.restorePurchases,
    $reset: vi.fn(),
  }),
}));

vi.mock('@/shared/config/env', () => ({
  appConfig: {
    get isRevenueCatEnabled() {
      return state.revenueCatEnabled;
    },
  },
}));

vi.mock('@/features/auth/accountDeletionLifecycle', () => ({
  AccountDeletionCleanupError: class AccountDeletionCleanupError extends Error {},
  deleteAccountAndClearLocalData: vi.fn(),
}));

vi.mock('@/shared/api/accountApi', () => ({
  deleteAccount: vi.fn(),
  exportAccountData: vi.fn(),
}));

vi.mock('@/features/reminders/reminderService', () => ({
  cancelReminderNotifications: vi.fn(),
}));

import AccountPage from '../AccountPage.vue';

function mountAccountPage() {
  return shallowMount(AccountPage, {
    global: {
      stubs: {
        ConfirmationDialog: true,
        PremiumBadge: true,
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  });
}

beforeEach(() => {
  state.role = 'owner';
  state.revenueCatEnabled = true;
  state.restorePurchases.mockReset();
  state.linkGoogleAccount.mockReset();
  state.linkGoogleAccount.mockResolvedValue('linked');
  state.googleSupported = true;
  state.user.signInMethods = ['password'];
  Object.assign(state.subscription, {
    currentPlan: 'free',
    hasPremiumEntitlement: false,
    premiumEntitlement: null,
    canManageSubscription: false,
    isRestoring: false,
    isManaging: false,
    statusMessage: '',
    errorMessage: '',
  });
});

describe('AccountPage', () => {
  it('lets a password user explicitly link Google from Account settings', async () => {
    const wrapper = mountAccountPage();

    await wrapper.get('[data-testid="link-google-account"]').trigger('click');

    expect(state.linkGoogleAccount).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('account.googleLinked');
  });

  it('shows connected Google access without another link action', () => {
    state.user.signInMethods = ['password', 'google'];

    const wrapper = mountAccountPage();

    expect(wrapper.text()).toContain('account.googleSignIn');
    expect(wrapper.find('[data-testid="link-google-account"]').exists()).toBe(
      false
    );
  });

  it('shows the public deletion fallback without changing the in-app action', () => {
    const wrapper = mountAccountPage();

    const fallback = wrapper.get('[data-testid="external-delete-account"]');

    expect(fallback.attributes('href')).toBe(
      'https://ourweekapp.com/delete-account'
    );
    expect(fallback.text()).toContain('Delete account online');
    expect(wrapper.find('button.history-item__delete').exists()).toBe(true);
  });

  it('shows Restore purchases to an owner and invokes the store action', async () => {
    const wrapper = mountAccountPage();

    await wrapper.get('[data-testid="restore-purchases"]').trigger('click');

    expect(state.restorePurchases).toHaveBeenCalledOnce();
  });

  it.each(['adult_member', 'viewer'] as const)(
    'keeps subscription details but hides billing actions from %s',
    (role) => {
      state.role = role;

      const wrapper = mountAccountPage();

      expect(wrapper.find('.subscription-status-list').exists()).toBe(true);
      expect(wrapper.find('[data-testid="restore-purchases"]').exists()).toBe(
        false
      );
    }
  );

  it.each([
    ['a restore is already running', { isRestoring: true }, true],
    ['native billing is unavailable', {}, false],
  ] as const)(
    'disables Restore purchases when %s',
    (_, subscription, configured) => {
      Object.assign(state.subscription, subscription);
      state.revenueCatEnabled = configured;

      expect(
        mountAccountPage()
          .get('[data-testid="restore-purchases"]')
          .attributes('disabled')
      ).toBeDefined();
    }
  );

  it('shows the store success and safe error result beside Account billing actions', () => {
    state.subscription.statusMessage = 'upgrade.premiumRestored';
    state.subscription.errorMessage = 'upgrade.restoreFailed';

    const wrapper = mountAccountPage();

    expect(wrapper.get('[role="status"]').text()).toContain(
      'upgrade.premiumRestored'
    );
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'upgrade.restoreFailed'
    );
  });
});
