// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { MeetingSection } from '@/features/meeting/types';
import MeetingSectionStep from '../MeetingSectionStep.vue';

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const section: MeetingSection = {
  id: 'tasks',
  title: 'Tasks',
  prompt: 'What needs attention?',
  notes: [],
  tasks: [],
  agreements: [],
};

function mountStep() {
  return mount(MeetingSectionStep, {
    props: {
      activeCaptureType: null,
      canEditMeeting: true,
      canEditTasks: true,
      currentAgreements: [],
      currentNotes: [],
      currentSection: section,
      currentStepNumber: 2,
      currentTasks: [],
      formError: '',
      isFirstStep: false,
      presentation: {
        sectionId: 'tasks',
        phase: 'plan',
        screenKind: 'conversation',
        promptKey: 'templates.sections',
        allowedItemTypes: ['note', 'task', 'agreement'],
        primaryCaptureType: 'task',
        addActionLabelKey: 'meeting.presentation.addTask',
        exampleKeys: ['meeting.presentation.goodThingsExample'],
        attributionMode: 'shared',
      },
      previousCompletedMeetingLabel: '',
      previousUnfinishedTasks: [],
      progressPercent: '25%',
      sectionPrompt: section.prompt,
      sectionTitle: section.title,
      showTaskReview: false,
      statusMessage: '',
      totalSteps: 4,
    },
  });
}

describe('MeetingSectionStep', () => {
  it('uses contextual capture instead of persistent input forms', () => {
    const wrapper = mountStep();
    expect(wrapper.text()).toContain('meeting.presentation.addTask');
    expect(wrapper.find('textarea').exists()).toBe(false);
    expect(wrapper.find('input').exists()).toBe(false);
  });

  it('emits the selected contextual capture type', async () => {
    const wrapper = mountStep();
    await wrapper.get('.meeting-primary').trigger('click');
    expect(wrapper.emitted('capture')).toEqual([['task']]);
  });

  it('uses styled disclosure controls for examples and alternative capture', async () => {
    const wrapper = mountStep();
    const toggles = () => wrapper.findAll('button[aria-controls]');

    expect(wrapper.find('details').exists()).toBe(false);
    expect(wrapper.find('summary').exists()).toBe(false);
    expect(toggles()).toHaveLength(2);
    expect(toggles()[0]!.attributes('aria-expanded')).toBe('false');
    expect(toggles()[1]!.attributes('aria-expanded')).toBe('false');

    await toggles()[0]!.trigger('click');

    expect(wrapper.get('.meeting-conversation__example-panel').exists()).toBe(
      true
    );
    expect(toggles()[0]!.attributes('aria-expanded')).toBe('true');
    expect(toggles()[1]!.attributes('aria-expanded')).toBe('false');

    await toggles()[1]!.trigger('click');

    expect(
      wrapper.get('.meeting-conversation__alternative-actions').exists()
    ).toBe(true);
    expect(
      wrapper.get('.meeting-conversation__alternative-actions button').classes()
    ).toContain('meeting-conversation__alternative-card');

    await wrapper
      .get('.meeting-conversation__alternative-actions button')
      .trigger('click');

    expect(wrapper.emitted('capture')).toEqual([['note']]);
  });
});
