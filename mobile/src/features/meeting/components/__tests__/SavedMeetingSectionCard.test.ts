// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import SavedMeetingSectionCard from '../SavedMeetingSectionCard.vue';
import type { SavedMeetingSectionViewModel } from '../../savedMeetingSummary';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      meeting: {
        notes: 'Notes',
        tasks: 'Tasks',
        agreements: 'Agreements',
        savedSummary: {
          filled: 'Filled',
          empty: 'Empty',
          sectionEmpty: 'No entries were saved in this section.',
        },
      },
    },
  },
});

const filledSection: SavedMeetingSectionViewModel = {
  id: 'finalAgreements',
  title: 'Final agreements',
  prompt: 'What should we agree before finishing?',
  status: 'filled',
  groups: [
    {
      kind: 'notes',
      rows: [
        {
          id: 'note-1',
          leadingMeta: 'Rita',
          trailingMeta: 'Sep 16, 19:04',
          title: 'A saved note',
        },
      ],
    },
    {
      kind: 'tasks',
      rows: [
        {
          id: 'task-1',
          title: 'Book the appointment',
          badge: 'Open • Needs discussion',
        },
      ],
    },
    {
      kind: 'agreements',
      rows: [
        {
          id: 'agreement-1',
          leadingMeta: 'Vadym, Rita',
          title: 'Plan Sunday together',
        },
      ],
    },
  ],
};

function render(
  section: SavedMeetingSectionViewModel,
  variant: 'regular' | 'final'
) {
  return mount(SavedMeetingSectionCard, {
    props: { section, variant },
    global: { plugins: [i18n] },
  });
}

describe('SavedMeetingSectionCard', () => {
  it('renders every saved item in the regular card', () => {
    const wrapper = render(filledSection, 'regular');

    expect(wrapper.get('[data-section-variant="regular"]').exists()).toBe(true);
    expect(wrapper.get('[data-section-status="filled"]').text()).toBe('Filled');
    expect(wrapper.findAll('.saved-meeting-item-row')).toHaveLength(3);
    expect(wrapper.text()).toContain('Rita');
    expect(wrapper.text()).toContain('Sep 16, 19:04');
    expect(wrapper.text()).toContain('Open • Needs discussion');
  });

  it('uses the shared item rows in the final card', () => {
    const wrapper = render(filledSection, 'final');

    expect(wrapper.get('[data-section-variant="final"]').exists()).toBe(true);
    expect(wrapper.findAll('.saved-meeting-item-row')).toHaveLength(3);
    expect(wrapper.findAll('.saved-meeting-item-group')).toHaveLength(3);
  });

  it('shows one message instead of empty item groups', () => {
    const wrapper = render(
      {
        ...filledSection,
        status: 'empty',
        groups: [],
      },
      'regular'
    );

    expect(wrapper.get('[data-section-status="empty"]').text()).toBe('Empty');
    expect(wrapper.find('.saved-meeting-item-group').exists()).toBe(false);
    expect(wrapper.text()).toContain('No entries were saved in this section.');
  });
});
