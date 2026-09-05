// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
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

async function swipe(
  wrapper: ReturnType<typeof mountCard>,
  startX: number,
  endX: number
) {
  const surface = wrapper.get('.task-swipe-card__surface');
  const element = surface.element as HTMLElement;
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width: 200,
  } as DOMRect);

  await surface.trigger('pointerdown', {
    button: 0,
    clientX: startX,
    clientY: 0,
    pointerId: 1,
  });
  await surface.trigger('pointermove', {
    clientX: endX,
    clientY: 0,
    pointerId: 1,
  });
  await surface.trigger('pointerup', {
    clientX: endX,
    clientY: 0,
    pointerId: 1,
  });
}

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
});
