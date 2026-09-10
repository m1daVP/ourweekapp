// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type {
  EnrichedAgreement,
  EnrichedMeetingNote,
  EnrichedMeetingTask,
} from '@/features/meeting/composables/useMeetingSession';
import type { MeetingSection } from '@/features/meeting/types';
import type { Participant } from '@/features/participants/types';
import MeetingSectionStep from '../MeetingSectionStep.vue';

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/shared/components/SelectPickerField.vue', () => ({
  default: { name: 'SelectPickerField' },
}));

vi.mock('@/shared/components/DatePickerField.vue', () => ({
  default: { name: 'DatePickerField' },
}));

const participant: Participant = {
  id: 'participant-1',
  name: 'Alex',
  initials: 'A',
  avatarColor: '#123456',
  type: 'adult',
  isActive: true,
  createdAt: '2026-09-07T09:00:00.000Z',
  updatedAt: '2026-09-07T09:00:00.000Z',
};

const currentSection: MeetingSection = {
  id: 'tasks',
  title: 'Tasks',
  prompt: 'What should we agree on?',
  notes: [],
  tasks: [],
  agreements: [],
};

const currentTask: EnrichedMeetingTask = {
  id: 'task-1',
  sectionId: 'tasks',
  title: 'Task first',
  responsibilityType: 'participant',
  responsibleParticipantIds: [participant.id],
  status: 'open',
  createdAt: '2026-09-07T09:00:00.000Z',
  updatedAt: '2026-09-07T09:00:00.000Z',
  sectionTitle: 'Tasks',
  responsibilityLabel: 'Alex',
};

const currentAgreement: EnrichedAgreement = {
  id: 'agreement-1',
  sectionId: 'tasks',
  text: 'Agreement second',
  participantIds: [participant.id],
  createdAt: '2026-09-07T09:00:00.000Z',
  sectionTitle: 'Tasks',
  participantLabel: 'Alex',
};

const currentNote: EnrichedMeetingNote = {
  id: 'note-1',
  sectionId: 'tasks',
  participantId: participant.id,
  text: 'Note last',
  createdAt: '2026-09-07T09:00:00.000Z',
  sectionTitle: 'Tasks',
  participantName: 'Alex',
};

describe('MeetingSectionStep', () => {
  it('shows tasks and agreements before notes', () => {
    const wrapper = mount(MeetingSectionStep, {
      props: {
        activeMeetingParticipants: [participant],
        agreementParticipantIds: [participant.id],
        agreementText: '',
        canAddAgreements: true,
        canAddTasks: true,
        canCreateMeeting: true,
        canCreateTasks: true,
        canEditMeeting: true,
        canEditTasks: true,
        currentAgreements: [currentAgreement],
        currentNotes: [currentNote],
        currentSection,
        currentStepNumber: 1,
        currentTasks: [currentTask],
        formError: '',
        isCompleted: false,
        isFinalSection: false,
        isFinishingMeeting: false,
        isFirstStep: true,
        neutralHint: '',
        notePlaceholder: '',
        noteText: '',
        previousCompletedMeeting: null,
        previousCompletedMeetingLabel: '',
        previousUnfinishedTasks: [],
        progressPercent: '25%',
        sectionPrompt: currentSection.prompt,
        sectionTitle: currentSection.title,
        selectedParticipantId: participant.id,
        showNotes: true,
        showTaskReview: false,
        statusMessage: '',
        taskDescription: '',
        taskDueDate: '',
        taskResponsibilityChoice: participant.id,
        taskTitle: '',
        totalSteps: 4,
      },
      global: {
        stubs: { ParticipantAvatar: true },
      },
    });

    const headings = wrapper
      .findAll('.meeting-panel-title > span:last-child')
      .map((node) => node.text());

    expect(headings).toEqual([
      'meeting.tasks',
      'meeting.agreements',
      'meeting.notes',
    ]);
  });
});
