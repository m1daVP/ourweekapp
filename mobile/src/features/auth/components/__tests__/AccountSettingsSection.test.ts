// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

type TestUser = {
  email: string;
  displayName: string;
  createdAt: string;
  signInMethods: Array<'password' | 'google'>;
};

const state = vi.hoisted(() => ({
  user: {
    email: 'member@example.com',
    displayName: 'Member',
    createdAt: '2026-08-01T00:00:00.000Z',
    signInMethods: ['password'] as Array<'password' | 'google'>,
  } as TestUser | null,
  googleSupported: true,
  linkGoogleAccount: vi.fn(),
  clearGoogleLinkErrorMessage: vi.fn(),
  googleLinkErrorMessage: '',
  showInAppNotification: vi.fn(),
  subscription: {
    currentPlan: 'free' as const,
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
    clearSessionAfterUnauthorized: vi.fn(),
    linkGoogleAccount: state.linkGoogleAccount,
    clearGoogleLinkErrorMessage: state.clearGoogleLinkErrorMessage,
    isLinkingGoogle: false,
    get googleLinkErrorMessage() {
      return state.googleLinkErrorMessage;
    },
  }),
}));

vi.mock('@/app/stores/subscription', () => ({
  useSubscriptionStore: () => ({
    ...state.subscription,
    $reset: vi.fn(),
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
  useWorkspaceStore: () => ({ $reset: vi.fn() }),
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

vi.mock('@/shared/composables/useInAppNotification', () => ({
  useInAppNotification: () => ({
    showInAppNotification: state.showInAppNotification,
  }),
}));

import AccountSettingsSection from '../AccountSettingsSection.vue';

function mountAccountSettingsSection() {
  return shallowMount(AccountSettingsSection, {
    global: {
      stubs: {
        ConfirmationDialog: true,
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  });
}

function resetUser() {
  state.user = {
    email: 'member@example.com',
    displayName: 'Member',
    createdAt: '2026-08-01T00:00:00.000Z',
    signInMethods: ['password'],
  };
}

beforeEach(() => {
  resetUser();
  state.googleSupported = true;
  state.linkGoogleAccount.mockReset();
  state.linkGoogleAccount.mockResolvedValue('linked');
  state.clearGoogleLinkErrorMessage.mockReset();
  state.googleLinkErrorMessage = '';
  state.showInAppNotification.mockReset();
});

describe('AccountSettingsSection', () => {
  it('lets a password user link Google from Settings', async () => {
    const wrapper = mountAccountSettingsSection();

    await wrapper.get('[data-testid="link-google-account"]').trigger('click');

    expect(state.linkGoogleAccount).toHaveBeenCalledOnce();
    expect(state.showInAppNotification).toHaveBeenCalledWith(
      'account.googleLinked'
    );
  });

  it('shows connected Google access without another link action', () => {
    state.user!.signInMethods = ['password', 'google'];

    const wrapper = mountAccountSettingsSection();

    expect(wrapper.text()).toContain('account.googleSignIn');
    expect(wrapper.find('[data-testid="link-google-account"]').exists()).toBe(
      false
    );
  });

  it('shows a failed Google link as a top error notification', async () => {
    state.linkGoogleAccount.mockResolvedValue('failed');
    state.googleLinkErrorMessage = 'account.googleEmailMismatch';
    const wrapper = mountAccountSettingsSection();

    await wrapper.get('[data-testid="link-google-account"]').trigger('click');

    expect(state.showInAppNotification).toHaveBeenCalledWith(
      'account.googleEmailMismatch',
      { tone: 'error' }
    );
    expect(state.clearGoogleLinkErrorMessage).toHaveBeenCalledOnce();
    expect(wrapper.find('.meeting-error').exists()).toBe(false);
  });

  it('keeps account deletion inside Settings', () => {
    const wrapper = mountAccountSettingsSection();

    expect(
      wrapper.find('[data-testid="external-delete-account"]').exists()
    ).toBe(false);
    expect(wrapper.find('button.history-item__delete').exists()).toBe(true);
  });

  it('renders nothing when there is no signed-in account', () => {
    state.user = null;

    expect(mountAccountSettingsSection().find('section').exists()).toBe(false);
  });
});
