// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

const state = vi.hoisted(() => ({
  hasPremiumEntitlement: false,
  user: { email: 'alex@example.com' },
  activeParticipants: [
    {
      id: 'rita',
      email: 'rita@example.com',
      initials: 'RI',
      avatarColor: '#496a8f',
    },
    {
      id: 'alex',
      email: 'alex@example.com',
      initials: 'AL',
      avatarColor: '#6b8f71',
    },
  ],
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'home', fullPath: '/' }),
}));

vi.mock('@/app/stores/participants', () => ({
  useParticipantsStore: () => ({
    activeParticipants: state.activeParticipants,
  }),
}));

vi.mock('@/app/stores/auth', () => ({
  useAuthStore: () => ({ user: state.user }),
}));

vi.mock('@/app/stores/subscription', () => ({
  useSubscriptionStore: () => state,
}));

vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({
    dismissToast: vi.fn(),
    showToast: vi.fn(),
    toastState: null,
  }),
}));

vi.mock('@/shared/composables/usePullToRefresh', () => ({
  usePullToRefresh: () => ({
    phase: { value: 'idle' },
    pullDistance: { value: 0 },
  }),
}));

vi.mock('@/shared/services/storageService', () => ({
  clearStorageRecoveryMessages: vi.fn(),
  storageRecoveryState: { value: { messages: [] } },
}));

vi.mock('@/shared/services/pageRefreshService', () => ({
  PageRefreshError: class PageRefreshError extends Error {},
  isPullToRefreshRoute: () => false,
  refreshPageData: vi.fn(),
}));

import AppShell from '../AppShell.vue';

function mountAppShell() {
  return shallowMount(AppShell, {
    global: {
      stubs: {
        BottomNavigation: true,
        RouterLink: { template: '<a><slot /></a>' },
        ParticipantAvatar: {
          props: ['participant'],
          template:
            '<span :style="{ backgroundColor: participant.avatarColor }">{{ participant.initials }}</span>',
        },
      },
    },
  });
}

describe('AppShell Premium profile ring', () => {
  it('renders the signed-in participant avatar instead of the first household avatar', () => {
    const avatar = mountAppShell().find('.app-top-bar__avatar span');

    expect(avatar.text()).toBe('AL');
    expect(avatar.attributes('style')).toContain('background-color: #6b8f71');
  });

  it('adds the Premium modifier only with an active entitlement', () => {
    state.hasPremiumEntitlement = true;
    expect(mountAppShell().find('.app-top-bar__avatar').classes()).toContain(
      'app-top-bar__avatar--premium'
    );

    state.hasPremiumEntitlement = false;
    expect(
      mountAppShell().find('.app-top-bar__avatar').classes()
    ).not.toContain('app-top-bar__avatar--premium');
  });
});
