// @vitest-environment happy-dom
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import MeetingReviewCloseStep from '../MeetingReviewCloseStep.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      common: { delete: 'Delete', edit: 'Edit', finish: 'Finish' },
      meeting: {
        closeMeeting: 'Close',
        reviewCloseTitle: 'Review and finish',
        progressCompleteLabel: 'Meeting progress',
        meetingProgress: 'Meeting progress',
        menu: { open: 'Open menu' },
        reviewReadyTitle: 'Ready to finish',
        reviewReadyText: 'Review what you recorded before you finish.',
        agreedActions: 'Agreed actions',
        agreements: 'Agreements',
        notes: 'Notes',
        itemCount: '{count} saved',
        markTaskDone: 'Mark {title} done',
        markTaskOpen: 'Mark {title} open',
        editTaskAria: 'Edit {title}',
        deleteTaskAria: 'Delete {title}',
        editAgreementAria: 'Edit {text}',
        deleteAgreementAria: 'Delete {text}',
        editNoteAria: 'Edit {author}',
        deleteNoteAria: 'Delete {author}',
        editActions: 'Edit actions',
        itemActionsAria: 'Open actions for {item}',
        notesReviewIntro: 'Saved notes from the conversation.',
        showRecordedNotes: 'Show notes',
        hideRecordedNotes: 'Hide notes',
        addAgreement: 'Add agreement',
        addTask: 'Add task',
        addNote: 'Add note',
        goBackEdit: 'Go back and edit',
        finishingMeeting: 'Finishing',
        newMeeting: 'New meeting',
        reviewEmpty: 'Nothing was recorded.',
      },
    },
  },
});

function createProps() {
  return {
    allTasks: [
      {
        id: 'task-1',
        sectionId: 'tasks' as const,
        title: 'Move the operation',
        responsibilityType: 'shared' as const,
        responsibleParticipantIds: [],
        status: 'open' as const,
        createdAt: '2026-09-15T00:00:00.000Z',
        updatedAt: '2026-09-15T00:00:00.000Z',
        sectionTitle: 'Tasks',
        responsibilityLabel: 'Shared',
      },
    ],
    allAgreements: [
      {
        id: 'agreement-1',
        sectionId: 'tasks' as const,
        text: 'We will prepare the next day in the evening.',
        participantIds: [],
        createdAt: '2026-09-15T00:00:00.000Z',
        sectionTitle: 'Tasks',
        participantLabel: 'Alex, partner',
      },
    ],
    allNotes: [
      {
        id: 'note-1',
        sectionId: 'tasks' as const,
        text: 'A note from the conversation.',
        createdAt: '2026-09-15T00:00:00.000Z',
        sectionTitle: 'Tasks',
        participantName: 'Alex',
      },
    ],
    canCreateMeeting: true,
    canEditMeeting: true,
    canEditTasks: true,
    formError: '',
    hasMeetingContent: true,
    isCompleted: false,
    isFinishingMeeting: false,
    meetingDurationLabel: '15 min',
    progressPercent: '100%',
    reviewCounts: { tasks: 1, agreements: 1, notes: 1, hasContent: true },
    statusMessage: '',
  };
}

describe('MeetingReviewCloseStep', () => {
  it('keeps review overflow actions and notes visibility interactive', async () => {
    const wrapper = mount(MeetingReviewCloseStep, {
      attachTo: document.body,
      props: createProps(),
      global: {
        plugins: [i18n],
      },
    });

    await wrapper
      .get('[data-testid="review-task-toggle-task-1"]')
      .trigger('click');
    await wrapper
      .get('[aria-label="Open actions for Move the operation"]')
      .trigger('click');
    document.querySelector<HTMLButtonElement>('[aria-label="Edit"]')?.click();
    await nextTick();
    await wrapper
      .get('[aria-label="Open actions for Move the operation"]')
      .trigger('click');
    document.querySelector<HTMLButtonElement>('[aria-label="Delete"]')?.click();
    await nextTick();
    await wrapper
      .get(
        '[aria-label="Open actions for We will prepare the next day in the evening."]'
      )
      .trigger('click');
    document.querySelector<HTMLButtonElement>('[aria-label="Edit"]')?.click();
    await nextTick();
    await wrapper.get('[data-testid="review-capture-note"]').trigger('click');
    await wrapper
      .get('[data-testid="review-notes-picker"] button')
      .trigger('click');
    await wrapper
      .get('[aria-label="Open actions for A note from the conversation."]')
      .trigger('click');
    document.querySelector<HTMLButtonElement>('[aria-label="Delete"]')?.click();
    await nextTick();
    await wrapper.get('[data-testid="review-finish"]').trigger('click');

    expect(wrapper.emitted('toggle-task')).toEqual([['task-1', 'open']]);
    expect(wrapper.emitted('edit-task')).toHaveLength(1);
    expect(wrapper.emitted('delete-task')).toEqual([['task-1']]);
    expect(wrapper.emitted('edit-agreement')).toHaveLength(1);
    expect(wrapper.emitted('delete-note')).toEqual([['note-1']]);
    expect(wrapper.find('.review-close-item-actions').exists()).toBe(false);
    expect(wrapper.emitted('capture')).toEqual([['note']]);
    expect(wrapper.get('#review-close-notes-list').isVisible()).toBe(true);
    expect(wrapper.emitted('finish')).toEqual([[]]);
    wrapper.unmount();
  });
});
