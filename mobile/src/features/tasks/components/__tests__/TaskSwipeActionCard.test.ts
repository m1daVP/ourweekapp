// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const haptics = vi.hoisted(() => ({ refreshReady: vi.fn() }));

vi.mock('@/shared/services/hapticsService', () => ({ haptics }));

import TaskSwipeActionCard from '../TaskSwipeActionCard.vue';

function mountCard(
  props: Partial<InstanceType<typeof TaskSwipeActionCard>['$props']> = {}
) {
  return mount(TaskSwipeActionCard, {
    props: {
      title: 'Buy fruit',
      status: 'open',
      metadataIcon: 'calendar_today',
      metadataText: 'Today',
      metadataTone: 'default',
      participants: [],
      accessory: 'none',
      canToggle: true,
      canFinish: true,
      canRemove: true,
      isCompleting: false,
      toggleLabel: 'Done Buy fruit',
      finishLabel: 'Finish',
      removeLabel: 'Remove',
      ...props,
    },
    global: {
      stubs: {
        ParticipantAvatar: true,
      },
    },
  });
}

function getSurface(wrapper: ReturnType<typeof mountCard>) {
  const surface = wrapper.get('.task-swipe-card__surface');
  const element = surface.element as HTMLElement;
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width: 200,
  } as DOMRect);

  return surface;
}

async function startSwipe(
  wrapper: ReturnType<typeof mountCard>,
  startX: number
) {
  const surface = getSurface(wrapper);

  await surface.trigger('pointerdown', {
    button: 0,
    clientX: startX,
    clientY: 0,
    pointerId: 1,
  });
}

async function moveSwipe(
  wrapper: ReturnType<typeof mountCard>,
  clientX: number,
  clientY = 0
) {
  await wrapper.get('.task-swipe-card__surface').trigger('pointermove', {
    clientX,
    clientY,
    pointerId: 1,
  });
}

async function endSwipe(
  wrapper: ReturnType<typeof mountCard>,
  clientX: number,
  clientY = 0
) {
  await wrapper.get('.task-swipe-card__surface').trigger('pointerup', {
    clientX,
    clientY,
    pointerId: 1,
  });
}

async function cancelSwipe(wrapper: ReturnType<typeof mountCard>) {
  await wrapper.get('.task-swipe-card__surface').trigger('pointercancel', {
    pointerId: 1,
  });
}

async function swipe(
  wrapper: ReturnType<typeof mountCard>,
  startX: number,
  endX: number
) {
  await startSwipe(wrapper, startX);
  await moveSwipe(wrapper, endX);
  await endSwipe(wrapper, endX);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TaskSwipeActionCard', () => {
  it('emits finish after a 25% right swipe for an open task', async () => {
    const wrapper = mountCard();

    await swipe(wrapper, 0, 50);

    expect(wrapper.emitted('finish')).toHaveLength(1);
  });

  it('requests deletion after a 25% left swipe without finishing', async () => {
    const wrapper = mountCard({ status: 'done', canFinish: false });

    await swipe(wrapper, 100, 50);

    expect(wrapper.emitted('requestDelete')).toHaveLength(1);
    expect(wrapper.emitted('finish')).toBeUndefined();
  });

  it('does not act below the threshold or when a finish swipe is unavailable', async () => {
    const wrapper = mountCard({ status: 'done', canFinish: false });

    await swipe(wrapper, 0, 49);

    expect(wrapper.emitted('finish')).toBeUndefined();
    expect(wrapper.emitted('requestDelete')).toBeUndefined();
  });

  it('provides a focusable remove action outside the gesture path', async () => {
    const wrapper = mountCard();

    await wrapper.get('.task-swipe-card__remove-accessible').trigger('click');

    expect(wrapper.emitted('requestDelete')).toHaveLength(1);
  });

  it('pulses again when a finish swipe re-crosses its threshold', async () => {
    const wrapper = mountCard();

    await startSwipe(wrapper, 0);
    await moveSwipe(wrapper, 50);
    await moveSwipe(wrapper, 90);
    await moveSwipe(wrapper, 49);
    await moveSwipe(wrapper, 50);

    expect(haptics.refreshReady).toHaveBeenCalledTimes(2);
  });

  it('pulses again when a delete swipe re-crosses its threshold', async () => {
    const wrapper = mountCard();

    await startSwipe(wrapper, 200);
    await moveSwipe(wrapper, 150);
    await moveSwipe(wrapper, 110);
    await moveSwipe(wrapper, 151);
    await moveSwipe(wrapper, 150);

    expect(haptics.refreshReady).toHaveBeenCalledTimes(2);
  });

  it('keeps below-threshold and vertical gestures silent', async () => {
    const belowThreshold = mountCard();

    await startSwipe(belowThreshold, 0);
    await moveSwipe(belowThreshold, 49);
    await endSwipe(belowThreshold, 49);

    const vertical = mountCard();

    await startSwipe(vertical, 0);
    await moveSwipe(vertical, 4, 12);

    expect(haptics.refreshReady).not.toHaveBeenCalled();
  });

  it('clears the readiness latch when a swipe is cancelled', async () => {
    const wrapper = mountCard();

    await startSwipe(wrapper, 0);
    await moveSwipe(wrapper, 50);
    await cancelSwipe(wrapper);
    await startSwipe(wrapper, 0);
    await moveSwipe(wrapper, 50);

    expect(haptics.refreshReady).toHaveBeenCalledTimes(2);
  });
});
