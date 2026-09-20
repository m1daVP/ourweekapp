// @vitest-environment happy-dom
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MeetingItemCard from '../MeetingItemCard.vue';

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('MeetingItemCard', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('uses an overflow trigger and emits the selected note action', async () => {
    const wrapper = mount(MeetingItemCard, {
      attachTo: document.body,
      props: {
        editable: true,
        type: 'note',
        item: {
          id: 'note-1',
          sectionId: 'reflect',
          text: 'We made time for a walk.',
          createdAt: '2026-09-14T10:00:00.000Z',
          updatedAt: '2026-09-14T10:00:00.000Z',
        },
      },
    });

    expect(
      wrapper.find('[aria-label="meeting.itemActionsAria"]').exists()
    ).toBe(true);

    await wrapper
      .get('[aria-label="meeting.itemActionsAria"]')
      .trigger('click');
    document
      .querySelector<HTMLButtonElement>('[aria-label="common.edit"]')
      ?.click();
    await nextTick();

    expect(wrapper.emitted('edit')).toEqual([['note-1']]);
    expect(wrapper.find('.meeting-item-card__actions').exists()).toBe(false);
    wrapper.unmount();
  });

  it('emits deletion when selected from a task overflow menu', async () => {
    const wrapper = mount(MeetingItemCard, {
      attachTo: document.body,
      props: {
        editable: true,
        type: 'task',
        item: {
          id: 'task-1',
          sectionId: 'tasks',
          title: 'Buy fruit',
          responsibilityType: 'needsDiscussion',
          responsibleParticipantIds: [],
          status: 'open',
          createdAt: '2026-09-14T10:00:00.000Z',
          updatedAt: '2026-09-14T10:00:00.000Z',
        },
      },
    });

    await wrapper
      .get('[aria-label="meeting.itemActionsAria"]')
      .trigger('click');
    document
      .querySelector<HTMLButtonElement>('[aria-label="common.delete"]')
      ?.click();
    await nextTick();

    expect(wrapper.emitted('delete')).toEqual([['task-1']]);
    expect(wrapper.find('.meeting-item-card__responsibility').exists()).toBe(
      false
    );
    wrapper.unmount();
  });

  it('shows an enriched task responsibility label', () => {
    const wrapper = mount(MeetingItemCard, {
      props: {
        editable: false,
        type: 'task',
        item: {
          id: 'task-1',
          sectionId: 'tasks',
          title: 'Buy fruit',
          responsibilityType: 'participant',
          responsibleParticipantIds: ['participant-1'],
          responsibilityLabel: 'Rita',
          status: 'open',
          createdAt: '2026-09-14T10:00:00.000Z',
          updatedAt: '2026-09-14T10:00:00.000Z',
        },
      },
    });

    expect(wrapper.get('.meeting-item-card__responsibility').text()).toBe(
      'Rita'
    );
    wrapper.unmount();
  });
});
