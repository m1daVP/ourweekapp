// @vitest-environment happy-dom

import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type NotificationActionListener = () => Promise<void>;

const mocks = vi.hoisted(() => {
  let actionListener: NotificationActionListener | null = null;

  const listenerHandle = {
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const capacitor = {
    isNativePlatform: vi.fn(),
    isPluginAvailable: vi.fn(),
  };
  const router = {
    isReady: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
  };
  const localNotifications = {
    addListener: vi.fn(
      (_eventName: string, listener: NotificationActionListener) => {
        actionListener = listener;
        return Promise.resolve(listenerHandle);
      }
    ),
  };

  return {
    capacitor,
    getActionListener: () => actionListener,
    listenerHandle,
    localNotifications,
    resetActionListener: () => {
      actionListener = null;
    },
    router,
  };
});

vi.mock('@capacitor/core', () => ({
  Capacitor: mocks.capacitor,
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: mocks.localNotifications,
}));

vi.mock('vue-router', () => ({
  useRouter: () => mocks.router,
}));

async function mountHarness() {
  const { useNotificationActions } =
    await import('@/app/composables/useNotificationActions');

  return mount(
    defineComponent({
      setup() {
        useNotificationActions();
        return () => null;
      },
    })
  );
}

async function waitForListener() {
  await vi.waitFor(() => {
    expect(mocks.localNotifications.addListener).toHaveBeenCalledOnce();
  });

  const actionListener = mocks.getActionListener();

  if (!actionListener) {
    throw new Error('Expected notification action listener to be registered.');
  }

  return actionListener;
}

describe('useNotificationActions', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.resetActionListener();
    mocks.capacitor.isNativePlatform.mockReset();
    mocks.capacitor.isPluginAvailable.mockReset();
    mocks.listenerHandle.remove.mockClear();
    mocks.localNotifications.addListener.mockClear();
    mocks.router.isReady.mockClear();
    mocks.router.push.mockClear();
    mocks.capacitor.isNativePlatform.mockReturnValue(true);
    mocks.capacitor.isPluginAvailable.mockReturnValue(true);
  });

  it('opens meeting templates after a notification tap', async () => {
    const wrapper = await mountHarness();
    const actionListener = await waitForListener();

    await actionListener();

    expect(mocks.router.isReady).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({
      name: 'meeting-templates',
    });

    wrapper.unmount();
  });

  it('contains routing failures from the native callback', async () => {
    mocks.router.push.mockRejectedValueOnce(
      new Error('Navigation unavailable')
    );
    const wrapper = await mountHarness();
    const actionListener = await waitForListener();

    await expect(actionListener()).resolves.toBeUndefined();

    wrapper.unmount();
  });

  it('does not register in browser development', async () => {
    mocks.capacitor.isNativePlatform.mockReturnValue(false);

    const wrapper = await mountHarness();

    await Promise.resolve();

    expect(mocks.localNotifications.addListener).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('does not register when local notifications are unavailable', async () => {
    mocks.capacitor.isPluginAvailable.mockReturnValue(false);

    const wrapper = await mountHarness();

    await Promise.resolve();

    expect(mocks.localNotifications.addListener).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('removes the listener when the app shell unmounts', async () => {
    const wrapper = await mountHarness();

    await waitForListener();
    wrapper.unmount();

    expect(mocks.listenerHandle.remove).toHaveBeenCalledOnce();
  });
});
