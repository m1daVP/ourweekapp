// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import MeetingItemCard from '../MeetingItemCard.vue';

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('MeetingItemCard', () => {
  it('keeps a task toggle and edit controls accessible', async () => {
    const wrapper = mount(MeetingItemCard, {
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

    await wrapper.get('.meeting-item-card__toggle').trigger('click');
    expect(wrapper.emitted('toggle-task')).toEqual([['task-1', 'open']]);
  });
});
