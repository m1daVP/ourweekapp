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
  dismissToast: vi.fn(),
  dismissInAppNotification: vi.fn(),
  notificationState: {
    __v_isRef: true,
    value: null as null | Record<string, unknown>,
  },
  toastState: {
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
    dismissToast: state.dismissToast,
    showToast: vi.fn(),
    toastState: state.toastState,
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

beforeEach(() => {
  state.dismissToast.mockReset();
  state.dismissInAppNotification.mockReset();
  state.notificationState.value = null;
  state.toastState.value = null;
});

describe('AppShell Premium profile ring', () => {
  it('uses a labelled undo icon for a toast action', async () => {
    const undo = vi.fn();
    state.toastState.value = {
      action: { label: 'Undo deletion', onClick: undo },
      id: 1,
      loading: false,
      message: 'Note deleted.',
      persistent: false,
      tone: 'status',
    };

    const wrapper = mountAppShell();
    const action = wrapper.get('[aria-label="Undo deletion"]');

    expect(action.classes()).toContain('app-toast__action');
    expect(action.text()).toBe('undo');

    await action.trigger('click');

    expect(undo).toHaveBeenCalledOnce();
    expect(state.dismissToast).toHaveBeenCalledOnce();
  });

  it('dismisses the shared in-app notification after an upward swipe', async () => {
    showNotification();
    const wrapper = mountAppShell();
    const notification = wrapper.get('.in-app-notification');

    expect(notification.text()).toContain('Account export downloaded.');
    await notification.trigger('pointerdown', { clientY: 180 });
    await notification.trigger('pointerup', { clientY: 120 });

    expect(state.dismissInAppNotification).toHaveBeenCalledOnce();
  });

  it('keeps the notification for a short, downward, or sideways movement', async () => {
    showNotification();
    const wrapper = mountAppShell();
    const notification = wrapper.get('.in-app-notification');

    await notification.trigger('pointerdown', { clientX: 20, clientY: 180 });
    await notification.trigger('pointerup', { clientX: 20, clientY: 150 });
    await notification.trigger('pointerdown', { clientX: 20, clientY: 120 });
    await notification.trigger('pointerup', { clientX: 20, clientY: 180 });
    await notification.trigger('pointerdown', { clientX: 20, clientY: 180 });
    await notification.trigger('pointerup', { clientX: 100, clientY: 180 });
    await notification.trigger('pointerdown', { clientX: 20, clientY: 180 });
    await notification.trigger('pointerup', { clientX: 100, clientY: 120 });

    expect(state.dismissInAppNotification).not.toHaveBeenCalled();
    expect(wrapper.find('.in-app-notification__dismiss').exists()).toBe(false);
  });

  it('keeps the notification after a cancelled upward gesture', async () => {
    showNotification();
    const wrapper = mountAppShell();
    const notification = wrapper.get('.in-app-notification');

    await notification.trigger('pointerdown', { clientY: 180 });
    await notification.trigger('pointercancel');
    await notification.trigger('pointerup', { clientY: 120 });

    expect(state.dismissInAppNotification).not.toHaveBeenCalled();
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
