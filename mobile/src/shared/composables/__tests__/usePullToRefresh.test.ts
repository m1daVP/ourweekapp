// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { computed, defineComponent, ref } from 'vue';
import {
  PULL_ACTIVATION_PX,
  PULL_MAX_DISTANCE_PX,
  PULL_THRESHOLD_PX,
  calculatePullDistance,
  classifyPullGesture,
  getPullToRefreshPhase,
  shouldPulseOnPullReadyTransition,
  usePullToRefresh,
} from '@/shared/composables/usePullToRefresh';

const haptics = vi.hoisted(() => ({
  refreshReady: vi.fn(),
}));

vi.mock('@/shared/services/hapticsService', () => ({ haptics }));

describe('pull-to-refresh gesture helpers', () => {
  it('adds resistance and caps visible distance', () => {
    expect(calculatePullDistance(0)).toBe(0);
    expect(calculatePullDistance(40)).toBeLessThan(40);
    expect(calculatePullDistance(1000)).toBe(PULL_MAX_DISTANCE_PX);
  });

  it('accepts only activated downward vertical movement', () => {
    expect(classifyPullGesture(1, PULL_ACTIVATION_PX - 1)).toBe('pending');
    expect(classifyPullGesture(3, PULL_ACTIVATION_PX + 4)).toBe('pulling');
    expect(classifyPullGesture(20, 8)).toBe('cancelled');
    expect(classifyPullGesture(0, -10)).toBe('cancelled');
  });

  it('maps state to presentation phases', () => {
    expect(getPullToRefreshPhase(0, false)).toBe('idle');
    expect(getPullToRefreshPhase(PULL_THRESHOLD_PX - 1, false)).toBe('pulling');
    expect(getPullToRefreshPhase(PULL_THRESHOLD_PX, false)).toBe('ready');
    expect(getPullToRefreshPhase(0, true)).toBe('refreshing');
  });

  it('pulses only when entering the ready phase', () => {
    expect(shouldPulseOnPullReadyTransition('pulling', 'ready')).toBe(true);
    expect(shouldPulseOnPullReadyTransition('ready', 'ready')).toBe(false);
    expect(shouldPulseOnPullReadyTransition('ready', 'pulling')).toBe(false);
    expect(shouldPulseOnPullReadyTransition('idle', 'ready')).toBe(true);
    expect(shouldPulseOnPullReadyTransition('refreshing', 'ready')).toBe(false);
  });

  it('pulses again after pulling below the threshold and crossing it again', async () => {
    haptics.refreshReady.mockReset();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const wrapper = mount(
      defineComponent({
        setup() {
          const container = ref<HTMLElement | null>(null);

          usePullToRefresh({
            container,
            enabled: computed(() => true),
            onRefresh,
          });

          return { container };
        },
        template: '<div ref="container" />',
      })
    );
    const container = wrapper.element as HTMLElement;

    container.dispatchEvent(createTouchEvent('touchstart', 0));
    container.dispatchEvent(createTouchEvent('touchmove', 140));
    container.dispatchEvent(createTouchEvent('touchmove', 100));
    container.dispatchEvent(createTouchEvent('touchmove', 140));
    container.dispatchEvent(createTouchEvent('touchend', 140, false));

    await flushPromises();

    expect(haptics.refreshReady).toHaveBeenCalledTimes(2);
    expect(onRefresh).toHaveBeenCalledOnce();

    wrapper.unmount();
  });

  it('resets threshold feedback after cancellation', () => {
    haptics.refreshReady.mockReset();
    const wrapper = mount(
      defineComponent({
        setup() {
          const container = ref<HTMLElement | null>(null);

          usePullToRefresh({
            container,
            enabled: computed(() => true),
            onRefresh: vi.fn().mockResolvedValue(undefined),
          });

          return { container };
        },
        template: '<div ref="container" />',
      })
    );
    const container = wrapper.element as HTMLElement;

    container.dispatchEvent(createTouchEvent('touchstart', 0));
    container.dispatchEvent(createTouchEvent('touchmove', 140));
    container.dispatchEvent(createTouchEvent('touchcancel', 140, false));
    container.dispatchEvent(createTouchEvent('touchstart', 0));
    container.dispatchEvent(createTouchEvent('touchmove', 140));

    expect(haptics.refreshReady).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });
});

function createTouchEvent(type: string, clientY: number, oneTouch = true) {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'touches', {
    configurable: true,
    value: oneTouch ? [{ clientX: 0, clientY }] : [],
  });

  return event;
}
