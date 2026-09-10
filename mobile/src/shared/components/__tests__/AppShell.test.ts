// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  dismissInAppNotification: vi.fn(),
  notificationState: {
    __v_isRef: true,
    value: null as null | Record<string, unknown>,
  },
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

vi.mock('@/shared/composables/useInAppNotification', () => ({
  useInAppNotification: () => ({
    dismissInAppNotification: state.dismissInAppNotification,
    notificationState: state.notificationState,
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

function showNotification() {
  state.notificationState.value = {
    id: 1,
    message: 'Account export downloaded.',
    tone: 'status',
  };
}

function getNotificationSwipeHandlers(
  wrapper: ReturnType<typeof mountAppShell>
) {
  return wrapper.vm.$.setupState as unknown as {
    handleInAppNotificationPointerDown: (event: PointerEvent) => void;
    handleInAppNotificationPointerUp: (event: PointerEvent) => void;
  };
}

beforeEach(() => {
  state.dismissInAppNotification.mockReset();
  state.notificationState.value = null;
});

describe('AppShell Premium profile ring', () => {
  it('dismisses the shared in-app notification after an upward swipe', async () => {
    showNotification();
    const wrapper = mountAppShell();
    const notification = wrapper.get('.in-app-notification');

    expect(notification.text()).toContain('Account export downloaded.');
    const swipeHandlers = getNotificationSwipeHandlers(wrapper);
    swipeHandlers.handleInAppNotificationPointerDown({
      clientY: 180,
    } as PointerEvent);
    swipeHandlers.handleInAppNotificationPointerUp({
      clientY: 120,
    } as PointerEvent);
    expect(state.dismissInAppNotification).toHaveBeenCalledOnce();
  });

  it('keeps the notification for a short upward movement', async () => {
    showNotification();
    const wrapper = mountAppShell();
    const swipeHandlers = getNotificationSwipeHandlers(wrapper);

    swipeHandlers.handleInAppNotificationPointerDown({
      clientY: 180,
    } as PointerEvent);
    swipeHandlers.handleInAppNotificationPointerUp({
      clientY: 150,
    } as PointerEvent);

    expect(state.dismissInAppNotification).not.toHaveBeenCalled();
    expect(wrapper.find('.in-app-notification__dismiss').exists()).toBe(false);
  });

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
