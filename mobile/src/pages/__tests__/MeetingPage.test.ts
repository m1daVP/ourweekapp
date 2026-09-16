// @vitest-environment happy-dom
import { nextTick, reactive, ref } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConfirmationDialog from '@/shared/components/ConfirmationDialog.vue';
import MeetingPage from '../MeetingPage.vue';

const meetingSession = vi.hoisted(() => ({
  value: null as Record<string, unknown> | null,
}));

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();

  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  };
});

vi.mock('@/app/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    currentUserId: 'user-1',
    workspace: { id: 'workspace-1' },
  }),
}));

vi.mock('@/features/meeting/composables/useMeetingSession', () => ({
  useMeetingSession: () => meetingSession.value,
}));

const actionNames = [
  'addAgreement',
  'addNote',
  'addSelectedDrawerParticipant',
  'addTask',
  'clearDrawerParticipantSelection',
  'closeAgreementEditor',
  'closeGuestDrawer',
  'closeMeeting',
  'closeNoteEditor',
  'closeTaskEditor',
  'confirmAiRecapDisclosure',
  'confirmAiRecapLowContent',
  'confirmDeleteRitual',
  'deferAiRecapDisclosure',
  'deferAiRecapLowContent',
  'deleteAgreement',
  'deleteNote',
  'deleteTask',
  'editActions',
  'exitMeeting',
  'finishMeeting',
  'goBack',
  'goNext',
  'handleRitualMenuSelect',
  'handleUnfinishedTasks',
  'openAgreementEditor',
  'openGuestDrawer',
  'openNoteEditor',
  'openTaskEditor',
  'saveAgreementEdit',
  'saveDraft',
  'saveNoteEdit',
  'saveTaskEdit',
  'selectDrawerParticipant',
  'startNewMeeting',
  'startRitual',
  'submitCapturedItem',
  'toggleCheckInParticipant',
  'toggleTask',
] as const;

function createMeetingSession() {
  const session: Record<string, unknown> = {
    activeMeeting: ref({ id: 'meeting-1' }),
    activeMeetingParticipants: ref([]),
    agreementParticipantIds: ref([]),
    agreementText: ref(''),
    allAgreements: ref([]),
    allNotes: ref([]),
    canAddAgreements: ref(true),
    canAddGuestParticipant: ref(true),
    canAddTasks: ref(true),
    canCreateMeeting: ref(true),
    canCreateTasks: ref(true),
    canEditMeeting: ref(true),
    canEditTasks: ref(true),
    canSubmitGuestDrawer: ref(false),
    checkInParticipants: ref([]),
    checkedInParticipantIds: ref([]),
    currentAgreements: ref([]),
    currentNotes: ref([]),
    currentPresentation: ref(null),
    currentSection: ref({ id: 'review', title: 'Review' }),
    currentStepNumber: ref(1),
    currentTasks: ref([]),
    drawerFamilyMembers: ref([]),
    drawerSelectedParticipantId: ref(''),
    editingAgreementText: ref(''),
    editingNoteText: ref(''),
    editingTaskDraft: reactive({
      title: '',
      description: '',
      responsibilityChoice: '',
      dueDate: '',
    }),
    editActions: vi.fn(),
    formError: ref(''),
    guestName: ref(''),
    hasMeetingContent: ref(false),
    isAiRecapDisclosureOpen: ref(false),
    isAiRecapLowContentOpen: ref(false),
    isCompleted: ref(false),
    isDeleteRitualDialogOpen: ref(false),
    isFinalSection: ref(true),
    isFinishingMeeting: ref(false),
    isFirstStep: ref(false),
    isGuestDrawerOpen: ref(false),
    isNoteEditorOpen: ref(false),
    isTaskEditorOpen: ref(false),
    isAgreementEditorOpen: ref(false),
    isParticipantCheckInStep: ref(false),
    isRitualMenuOpen: ref(false),
    meetingDurationLabel: ref('15 min'),
    neutralHint: ref(''),
    previousCompletedMeeting: ref(null),
    previousCompletedMeetingLabel: vi.fn(() => ''),
    previousUnfinishedTasks: ref([]),
    progressPercent: ref('100%'),
    reviewCounts: ref({
      tasks: 0,
      agreements: 0,
      notes: 0,
      hasContent: false,
    }),
    reviewTasks: ref([]),
    sectionPrompt: vi.fn(() => ''),
    sectionTitle: vi.fn(() => ''),
    selectedParticipantId: ref(''),
    showNotes: ref(false),
    showTaskReview: ref(false),
    statusMessage: ref(''),
    taskDraft: reactive({
      title: '',
      description: '',
      responsibilityChoice: '',
      dueDate: '',
    }),
    totalSteps: ref(1),
  };

  for (const actionName of actionNames) {
    session[actionName] ??= vi.fn();
  }

  return session;
}

describe('MeetingPage', () => {
  beforeEach(() => {
    meetingSession.value = createMeetingSession();
  });

  it('marks only the final review state for its safe-area layout', async () => {
    const wrapper = shallowMount(MeetingPage, {
      global: {
        stubs: { RouterLink: true },
      },
    });
    const isFinalSection = meetingSession.value?.isFinalSection;

    expect(wrapper.get('.meeting-page').classes()).toContain(
      'meeting-page--review-close'
    );

    if (!isFinalSection || typeof isFinalSection !== 'object') {
      throw new Error('Expected the final-section test ref to exist.');
    }

    (isFinalSection as { value: boolean }).value = false;
    await nextTick();

    expect(wrapper.get('.meeting-page').classes()).not.toContain(
      'meeting-page--review-close'
    );
  });

  it('does not render a temporary draft confirmation', () => {
    const wrapper = shallowMount(MeetingPage, {
      global: {
        stubs: { RouterLink: true },
      },
    });

    const draftDialog = wrapper
      .findAllComponents(ConfirmationDialog)
      .find((dialog) => dialog.props('title') === 'meeting.resolveDraftsTitle');

    expect(draftDialog).toBeUndefined();
  });
});
