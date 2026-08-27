// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

const state = vi.hoisted(() => ({
  user: {
    email: 'member@example.com',
    displayName: 'Member',
    createdAt: '2026-08-01T00:00:00.000Z',
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
  }),
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

vi.mock('@/app/stores/subscription', () => ({
  useSubscriptionStore: () => ({
    currentPlan: 'free',
    hasPremiumEntitlement: false,
    premiumEntitlement: null,
    canManageSubscription: false,
    isRestoring: false,
    statusMessage: '',
    restorePurchases: vi.fn(),
    $reset: vi.fn(),
  }),
}));

vi.mock('@/shared/config/env', () => ({
  appConfig: { isRevenueCatEnabled: false },
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

describe('AccountPage', () => {
  it('shows the public deletion fallback without changing the in-app action', () => {
    const wrapper = shallowMount(AccountPage, {
      global: {
        stubs: {
          ConfirmationDialog: true,
          PremiumBadge: true,
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    const fallback = wrapper.get('[data-testid="external-delete-account"]');

    expect(fallback.attributes('href')).toBe(
      'https://ourweekapp.com/delete-account'
    );
    expect(fallback.text()).toContain('Delete account online');
    expect(wrapper.find('button.history-item__delete').exists()).toBe(true);
  });
});
