// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import * as storageService from '@/shared/services/storageService';

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
  readStorageSlice: vi.fn(
    (key: string, fallback: { participants?: unknown[] }) => {
      if (key === 'participants') {
        return {
          participants: fallback.participants ?? [],
        };
      }

      return fallback;
    }
  ),
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

  it('moves the shared in-app notification with a short upward drag', async () => {
    showNotification();
    const wrapper = mountAppShell();
    const notification = wrapper.get('.in-app-notification');

    expect(notification.text()).toContain('Account export downloaded.');
    await notification.trigger('pointerdown', {
      clientX: 20,
      clientY: 180,
      pointerId: 1,
    });
    await notification.trigger('pointermove', {
      clientX: 20,
      clientY: 171,
      pointerId: 1,
    });

    expect(
      notification.element.style.getPropertyValue(
        '--in-app-notification-drag-offset'
      )
    ).toBe('-9px');
    expect(notification.classes()).toContain('in-app-notification--dragging');

    await notification.trigger('pointerup', {
      clientX: 20,
      clientY: 171,
      pointerId: 1,
    });

    expect(
      notification.element.style.getPropertyValue(
        '--in-app-notification-drag-offset'
      )
    ).toBe('0px');
    expect(notification.classes()).not.toContain(
      'in-app-notification--dragging'
    );
    expect(state.dismissInAppNotification).not.toHaveBeenCalled();
  });

  it('dismisses the notification as soon as an upward drag reaches 15px', async () => {
    showNotification();
    const wrapper = mountAppShell();
    const notification = wrapper.get('.in-app-notification');

    await notification.trigger('pointerdown', {
      clientX: 20,
      clientY: 180,
      pointerId: 1,
    });
    await notification.trigger('pointermove', {
      clientX: 20,
      clientY: 165,
      pointerId: 1,
    });

    expect(state.dismissInAppNotification).toHaveBeenCalledOnce();
  });

  it('keeps the notification at rest for downward and sideways drags', async () => {
    showNotification();
    const wrapper = mountAppShell();
    const notification = wrapper.get('.in-app-notification');

    await notification.trigger('pointerdown', { clientX: 20, clientY: 180 });
    await notification.trigger('pointermove', { clientX: 20, clientY: 210 });
    await notification.trigger('pointermove', { clientX: 100, clientY: 150 });

    expect(state.dismissInAppNotification).not.toHaveBeenCalled();
    expect(
      notification.element.style.getPropertyValue(
        '--in-app-notification-drag-offset'
      )
    ).toBe('0px');
  });

  it('resets the notification after cancellation or lost pointer capture', async () => {
    showNotification();
    const wrapper = mountAppShell();
    const notification = wrapper.get('.in-app-notification');

    await notification.trigger('pointerdown', { clientX: 20, clientY: 180 });
    await notification.trigger('pointermove', { clientX: 20, clientY: 171 });
    await notification.trigger('pointercancel');
    expect(
      notification.element.style.getPropertyValue(
        '--in-app-notification-drag-offset'
      )
    ).toBe('0px');

    await notification.trigger('pointerdown', { clientX: 20, clientY: 180 });
    await notification.trigger('pointermove', { clientX: 20, clientY: 171 });
    await notification.trigger('lostpointercapture');

    expect(state.dismissInAppNotification).not.toHaveBeenCalled();
    expect(
      notification.element.style.getPropertyValue(
        '--in-app-notification-drag-offset'
      )
    ).toBe('0px');
  });

  it('renders the signed-in participant avatar instead of the first household avatar', () => {
    const avatar = mountAppShell().find('.app-top-bar__avatar span');

    expect(avatar.text()).toBe('AL');
    expect(avatar.attributes('style')).toContain('background-color: #6b8f71');
  });

  it('uses persisted participant data when the store has not hydrated yet', () => {
    state.activeParticipants = [];
    vi.mocked(storageService.readStorageSlice).mockReturnValue({
      participants: [
        {
          id: 'alex',
          email: 'alex@example.com',
          initials: 'AL',
          avatarColor: '#6b8f71',
        },
      ],
    });

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
