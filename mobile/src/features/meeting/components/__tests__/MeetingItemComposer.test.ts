// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import MeetingItemComposer from '../MeetingItemComposer.vue';
import DatePickerField from '@/shared/components/DatePickerField.vue';

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('MeetingItemComposer', () => {
  it('keeps an invalid note open and shows its inline error', async () => {
    const wrapper = mount(MeetingItemComposer, {
      props: {
        open: true,
        participants: [],
        scope: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
          meetingId: 'meeting-1',
          sectionId: 'goodThings',
          type: 'note',
        },
        submitItem: vi.fn(),
      },
      global: {
        stubs: { BaseBottomSheet: { template: '<div><slot /></div>' } },
      },
    });

    await wrapper.get('form').trigger('submit');

    expect(wrapper.text()).toContain('meetingStore.addShortNote');
    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('uses card selectors and a summary date picker for task details', async () => {
    const wrapper = mount(MeetingItemComposer, {
      props: {
        open: true,
        participants: [
          {
            id: 'rita',
            name: 'Rita',
            initials: 'R',
            avatarColor: '#456349',
            type: 'adult',
            isActive: true,
            createdAt: '2026-09-14T10:00:00.000Z',
            updatedAt: '2026-09-14T10:00:00.000Z',
          },
        ],
        scope: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
          meetingId: 'meeting-1',
          sectionId: 'tasks',
          type: 'task',
        },
        submitItem: vi.fn(),
      },
      global: {
        stubs: { BaseBottomSheet: { template: '<div><slot /></div>' } },
      },
    });

    await wrapper
      .get('.meeting-item-composer__details-toggle')
      .trigger('click');

    expect(
      wrapper.get('.meeting-item-composer__task-details').classes()
    ).toContain('is-open');
    expect(wrapper.get('[data-responsibility="rita"]').exists()).toBe(true);
    await wrapper.get('[data-responsibility="rita"]').trigger('click');
    expect(wrapper.get('[data-responsibility="rita"]').classes()).toContain(
      'is-selected'
    );
    expect(wrapper.findComponent(DatePickerField).exists()).toBe(true);
    expect(wrapper.findComponent(DatePickerField).props('presentation')).toBe(
      'summary'
    );
    expect(wrapper.find('input[type="date"]').exists()).toBe(false);
    expect(
      wrapper.find('.meeting-item-composer__actions .secondary-button').exists()
    ).toBe(false);
    expect(
      wrapper
        .get('.meeting-item-composer__actions button[type="submit"]')
        .classes()
    ).toContain('meeting-primary');
  });

  it('preloads the selected task when opened for editing', () => {
    const wrapper = mount(MeetingItemComposer, {
      props: {
        open: true,
        participants: [],
        scope: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
          meetingId: 'meeting-1',
          sectionId: 'tasks',
          type: 'task',
          itemId: 'task-1',
        },
        editItem: {
          type: 'task',
          fields: {
            title: 'Book the appointment',
            description: 'Call after lunch.',
            responsibilityChoice: 'shared',
            dueDate: '2026-09-22',
          },
        },
        submitEditedItem: vi.fn(),
        submitItem: vi.fn(),
      },
      global: {
        stubs: {
          BaseBottomSheet: { template: '<div><slot /></div>' },
          DatePickerField: { template: '<div />' },
        },
      },
    });

    expect(wrapper.get('#meeting-composer-primary').element.value).toBe(
      'Book the appointment'
    );
  });

  it.each([
    ['note', 'Remember the school meeting.'],
    ['agreement', 'We will prepare lunches the night before.'],
  ] as const)(
    'preloads the selected %s when opened for editing',
    (type, text) => {
      const wrapper = mount(MeetingItemComposer, {
        props: {
          open: true,
          participants: [],
          scope: {
            userId: 'user-1',
            workspaceId: 'workspace-1',
            meetingId: 'meeting-1',
            sectionId: 'tasks',
            type,
            itemId: `${type}-1`,
          },
          editItem: { type, fields: { text } },
          submitEditedItem: vi.fn(),
          submitItem: vi.fn(),
        },
        global: {
          stubs: { BaseBottomSheet: { template: '<div><slot /></div>' } },
        },
      });

      expect(wrapper.get('#meeting-composer-primary').element.value).toBe(text);
    }
  );
});
