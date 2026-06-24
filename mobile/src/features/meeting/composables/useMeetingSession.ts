import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
import { generateMeetingSummary } from '@/features/meeting/aiSummaryService';
import {
  agreementSectionIds,
  getMeetingSectionPrompt,
  getMeetingSectionTitle,
  getMeetingTemplateName,
  taskSectionIds,
} from '@/features/meeting/meetingTemplates';
import type {
  Agreement,
  Meeting,
  MeetingNote,
  MeetingSectionId,
  MeetingTask,
  MeetingTaskStatus,
} from '@/features/meeting/types';
import type { Participant } from '@/features/participants/types';
import type { Task, TaskResponsibilityType } from '@/features/tasks/types';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';

export const maxCheckInParticipants = 10;

export type TaskReviewAction = 'keep' | 'done' | 'skipped' | 'move';

export interface TaskDraftState {
  title: string;
  description: string;
  responsibilityChoice: string;
  dueDate: string;
}

export interface EnrichedMeetingNote extends MeetingNote {
  sectionTitle: string;
  participantName: string;
}

export interface EnrichedMeetingTask extends MeetingTask {
  sectionTitle: string;
  responsibilityLabel: string;
}

export interface EnrichedAgreement extends Agreement {
  sectionTitle: string;
  participantLabel: string;
}

export interface EnrichedTaskReviewItem extends Task {
  responsibilityLabel: string;
}

export interface MeetingReviewCounts {
  notes: number;
  tasks: number;
  agreements: number;
  hasContent: boolean;
}

export type MeetingRouteDecision =
  | { type: 'readonly' }
  | { type: 'resume'; meetingId: string }
  | { type: 'templates' };

export function getMeetingRouteDecision(
  canCreateMeeting: boolean,
  activeMeeting: Meeting | null,
  meetings: Meeting[]
): MeetingRouteDecision {
  if (!canCreateMeeting && !activeMeeting) {
    return { type: 'readonly' };
  }

  const existingMeeting =
    activeMeeting && activeMeeting.status !== 'completed'
      ? activeMeeting
      : meetings.find(
          (meeting) => meeting.status !== 'completed' && !meeting.deletedAt
        );

  return existingMeeting
    ? { type: 'resume', meetingId: existingMeeting.id }
    : { type: 'templates' };
}

export function normalizeCheckedInParticipantIds(
  availableParticipantIds: string[],
  selectedParticipantIds: string[],
  limit = maxCheckInParticipants
) {
  const availableIds = new Set(availableParticipantIds);
  const selectedIds = selectedParticipantIds.filter((participantId) =>
    availableIds.has(participantId)
  );

  return (selectedIds.length ? selectedIds : availableParticipantIds).slice(
    0,
    limit
  );
}

export function chooseSelectedParticipantId(
  currentParticipantId: string,
  activeParticipantIds: string[]
) {
  return activeParticipantIds.includes(currentParticipantId)
    ? currentParticipantId
    : (activeParticipantIds[0] ?? '');
}

export function resolveTaskResponsibility(
  responsibilityChoice: string,
  activeParticipantIds: string[]
): {
  responsibilityType: TaskResponsibilityType;
  responsibleParticipantIds: string[];
} {
  if (responsibilityChoice === 'shared') {
    return {
      responsibilityType: 'shared',
      responsibleParticipantIds: activeParticipantIds,
    };
  }

  if (
    responsibilityChoice === 'needsDiscussion' ||
    !activeParticipantIds.includes(responsibilityChoice)
  ) {
    return {
      responsibilityType: 'needsDiscussion',
      responsibleParticipantIds: [],
    };
  }

  return {
    responsibilityType: 'participant',
    responsibleParticipantIds: [responsibilityChoice],
  };
}

export function getMeetingReviewTasks(meeting: Meeting | null): MeetingTask[] {
  if (!meeting) {
    return [];
  }

  return meeting.sections
    .flatMap((section) => section.tasks)
    .filter((task) => !task.carriedFromTaskId);
}

export function getMeetingReviewCounts(
  meeting: Meeting | null,
  reviewTasks?: MeetingTask[]
) {
  const counts: MeetingReviewCounts = {
    notes: 0,
    tasks: 0,
    agreements: 0,
    hasContent: false,
  };

  if (!meeting) {
    return counts;
  }

  for (const section of meeting.sections) {
    counts.notes += section.notes.length;
    counts.agreements += section.agreements.length;
  }

  counts.tasks =
    reviewTasks?.length ??
    meeting.sections.reduce(
      (total, section) => total + section.tasks.length,
      0
    );

  counts.hasContent =
    counts.notes > 0 || counts.tasks > 0 || counts.agreements > 0;

  return counts;
}

export function getMeetingNotes(meeting: Meeting | null): MeetingNote[] {
  if (!meeting) {
    return [];
  }

  return meeting.sections.flatMap((section) =>
    section.notes.map((note) => ({
      ...note,
      sectionId: section.id,
    }))
  );
}

export function getMeetingDurationMinutes(
  meeting: Meeting | null,
  now = Date.now()
) {
  if (!meeting) {
    return 0;
  }

  const startedAt = new Date(meeting.createdAt).getTime();
  const endedAt = meeting.completedAt
    ? new Date(meeting.completedAt).getTime()
    : now;

  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
    return 0;
  }

  return Math.max(Math.round((endedAt - startedAt) / 60000), 0);
}

export function createAvatarStyle(participant: Participant) {
  return {
    backgroundColor: participant.avatarColor,
    color: 'var(--color-on-primary)',
  };
}

export function useMeetingSession() {
  const meetingsStore = useMeetingsStore();
  const participantsStore = useParticipantsStore();
  const tasksStore = useTasksStore();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { can } = useWorkspacePermissions();
  const { canUseFeature } = useFeatureAccess();

  const noteText = ref('');
  const agreementText = ref('');
  const selectedParticipantId = ref('');
  const agreementParticipantIds = ref<string[]>([]);
  const formError = ref('');
  const statusMessage = ref('');
  const hasStartedRitual = ref(false);
  const isFinishingMeeting = ref(false);
  const isGuestDrawerOpen = ref(false);
  const isRitualMenuOpen = ref(false);
  const isEndSessionDialogOpen = ref(false);
  const isDeleteRitualDialogOpen = ref(false);
  const drawerSelectedParticipantId = ref('');
  const guestName = ref('');
  const checkedInParticipantIds = ref<string[]>([]);
  const editingNoteId = ref('');
  const editingNoteParticipantId = ref('');
  const editingNoteText = ref('');
  const noteEditorError = ref('');

  const taskDraft = reactive<TaskDraftState>({
    title: '',
    description: '',
    responsibilityChoice: 'needsDiscussion',
    dueDate: '',
  });

  const activeMeeting = computed(() => meetingsStore.activeMeeting);
  const canEditMeeting = computed(() => can('editMeetings'));
  const canCreateMeeting = computed(() => can('createMeetings'));
  const canEditTasks = computed(() => can('editTasks'));
  const canCreateTasks = computed(() => can('createTasks'));
  const meetingParticipants = computed(() => {
    const meeting = activeMeeting.value;

    if (!meeting) {
      return participantsStore.activeParticipants;
    }

    return meeting.participantIds
      .map((participantId) =>
        participantsStore.getParticipantById(participantId)
      )
      .filter((participant): participant is Participant =>
        Boolean(participant)
      );
  });
  const activeMeetingParticipants = computed(() =>
    meetingParticipants.value.filter((participant) => participant.isActive)
  );
  const checkInParticipants = computed(() =>
    participantsStore.activeParticipants.slice(0, maxCheckInParticipants)
  );
  const currentSection = computed(() => {
    const meeting = activeMeeting.value;
    return meeting?.sections[meeting.currentSectionIndex] ?? null;
  });
  const isCompleted = computed(
    () => activeMeeting.value?.status === 'completed'
  );
  const isPaused = computed(() => activeMeeting.value?.status === 'paused');
  const isParticipantCheckInStep = computed(
    () =>
      Boolean(activeMeeting.value) &&
      !isCompleted.value &&
      activeMeeting.value?.currentSectionIndex === 0 &&
      !hasStartedRitual.value
  );
  const totalSteps = computed(() =>
    activeMeeting.value ? activeMeeting.value.sections.length + 1 : 0
  );
  const currentStepNumber = computed(() =>
    isParticipantCheckInStep.value
      ? 1
      : (activeMeeting.value?.currentSectionIndex ?? 0) + 2
  );
  const isFirstStep = computed(() => currentStepNumber.value === 1);
  const progressPercent = computed(() =>
    totalSteps.value > 0
      ? `${(currentStepNumber.value / totalSteps.value) * 100}%`
      : '0%'
  );
  const isFinalSection = computed(() =>
    Boolean(
      activeMeeting.value &&
      activeMeeting.value.currentSectionIndex ===
        activeMeeting.value.sections.length - 1
    )
  );
  const canAddTasks = computed(() =>
    currentSection.value
      ? taskSectionIds.includes(currentSection.value.id)
      : false
  );
  const canAddAgreements = computed(() =>
    currentSection.value
      ? agreementSectionIds.includes(currentSection.value.id) ||
        isFinalSection.value
      : false
  );
  const showNotes = computed(() => !isFinalSection.value);
  const canAddGuestParticipant = computed(
    () => checkedInParticipantIds.value.length < maxCheckInParticipants
  );
  const drawerFamilyMembers = computed(
    () => participantsStore.activeParticipants
  );
  const canSubmitGuestDrawer = computed(
    () =>
      canEditMeeting.value &&
      canAddGuestParticipant.value &&
      (Boolean(drawerSelectedParticipantId.value) ||
        Boolean(guestName.value.trim()))
  );
  const previousCompletedMeeting = computed(() => {
    const currentMeetingId = activeMeeting.value?.id;

    return (
      [...meetingsStore.completedMeetings]
        .filter((meeting) => meeting.id !== currentMeetingId)
        .sort(
          (first, second) =>
            new Date(second.completedAt ?? second.updatedAt).getTime() -
            new Date(first.completedAt ?? first.updatedAt).getTime()
        )[0] ?? null
    );
  });
  const previousUnfinishedTasks = computed<EnrichedTaskReviewItem[]>(() => {
    const previousMeeting = previousCompletedMeeting.value;

    if (!previousMeeting) {
      return [];
    }

    return tasksStore.tasks
      .filter(
        (task) =>
          task.status === 'open' && task.sourceMeetingId === previousMeeting.id
      )
      .map((task) => ({
        ...task,
        responsibilityLabel: getResponsibilityLabel(
          task.responsibilityType,
          task.responsibleParticipantIds
        ),
      }));
  });
  const showTaskReview = computed(() => {
    const meeting = activeMeeting.value;
    const previousMeeting = previousCompletedMeeting.value;

    return Boolean(
      meeting &&
      previousMeeting &&
      !isCompleted.value &&
      meeting.currentSectionIndex === 0 &&
      previousUnfinishedTasks.value.length > 0 &&
      !tasksStore.wasReviewHandled(meeting.id, previousMeeting.id)
    );
  });

  const allNotes = computed<EnrichedMeetingNote[]>(() =>
    getMeetingNotes(activeMeeting.value).map((note) => {
      const section = activeMeeting.value?.sections.find(
        (candidate) => candidate.id === note.sectionId
      );

      return {
        ...note,
        sectionTitle: getMeetingSectionTitle(note.sectionId, section?.title),
        participantName: getParticipantName(note.participantId),
      };
    })
  );
  const allTasks = computed<EnrichedMeetingTask[]>(() =>
    activeMeeting.value
      ? activeMeeting.value.sections.flatMap((section) =>
          section.tasks.map((task) => ({
            ...task,
            sectionTitle: getMeetingSectionTitle(section.id, section.title),
            responsibilityLabel: getResponsibilityLabel(
              task.responsibilityType,
              task.responsibleParticipantIds
            ),
          }))
        )
      : []
  );
  const reviewTasks = computed<EnrichedMeetingTask[]>(() => {
    const reviewTaskIds = new Set(
      getMeetingReviewTasks(activeMeeting.value).map((task) => task.id)
    );

    return allTasks.value.filter((task) => reviewTaskIds.has(task.id));
  });
  const allAgreements = computed<EnrichedAgreement[]>(() =>
    activeMeeting.value
      ? activeMeeting.value.sections.flatMap((section) =>
          section.agreements.map((agreement) => ({
            ...agreement,
            sectionTitle: getMeetingSectionTitle(section.id, section.title),
            participantLabel: agreement.participantIds
              .map(getParticipantName)
              .join(', '),
          }))
        )
      : []
  );
  const reviewCounts = computed(() =>
    getMeetingReviewCounts(activeMeeting.value, reviewTasks.value)
  );
  const meetingDurationMinutes = computed(() =>
    getMeetingDurationMinutes(activeMeeting.value)
  );
  const meetingDurationLabel = computed(() =>
    meetingDurationMinutes.value > 0
      ? t('meeting.timeSpentMinutes', { count: meetingDurationMinutes.value })
      : t('meeting.timeSpentUnderMinute')
  );
  const hasMeetingContent = computed(() => reviewCounts.value.hasContent);
  const isNoteEditorOpen = computed(() => Boolean(editingNoteId.value));
  const currentNotes = computed(() =>
    allNotes.value.filter((note) => note.sectionId === currentSection.value?.id)
  );
  const currentTasks = computed(() =>
    allTasks.value.filter((task) => task.sectionId === currentSection.value?.id)
  );
  const currentAgreements = computed(() =>
    allAgreements.value.filter(
      (agreement) => agreement.sectionId === currentSection.value?.id
    )
  );

  function getNeutralHint(text: string) {
    if (currentSection.value?.id !== 'tensions' || !text.trim()) {
      return '';
    }

    const loadedWords = ['always', 'never', 'lazy', 'stupid', 'fault', 'blame'];
    const lowerText = text.toLowerCase();

    return loadedWords.some((word) => lowerText.includes(word))
      ? t('meeting.neutralHint')
      : '';
  }

  const neutralHint = computed(() => getNeutralHint(noteText.value));
  const noteEditorNeutralHint = computed(() =>
    getNeutralHint(editingNoteText.value)
  );

  onMounted(() => {
    participantsStore.ensureDefaultParticipants();
    tasksStore.syncFromMeetings(meetingsStore.meetings);

    const decision = getMeetingRouteDecision(
      canCreateMeeting.value,
      activeMeeting.value,
      meetingsStore.meetings
    );

    if (decision.type === 'readonly') {
      return;
    }

    if (decision.type === 'templates') {
      router.replace({ name: 'meeting-templates' });
      return;
    }

    const meeting = meetingsStore.resumeMeeting(decision.meetingId);

    if (!meeting) {
      router.replace({ name: 'meeting-templates' });
      return;
    }

    selectedParticipantId.value = firstActiveParticipantId();
    taskDraft.responsibilityChoice = 'needsDiscussion';
    agreementParticipantIds.value = [...meeting.participantIds];
    checkedInParticipantIds.value = [...meeting.participantIds];
  });

  watch(
    () =>
      participantsStore.activeParticipants.map((participant) => participant.id),
    () => {
      if (!isParticipantCheckInStep.value) {
        meetingsStore.syncActiveMeetingParticipants();
      }

      syncCheckedInParticipants();
      ensureSelectedParticipants();
    },
    { immediate: true }
  );

  watch(
    () => currentSection.value?.id,
    () => {
      closeNoteEditor();
      noteText.value = '';
      agreementText.value = '';
      formError.value = '';
      statusMessage.value = '';
      agreementParticipantIds.value = activeMeetingParticipants.value.map(
        (participant) => participant.id
      );
      syncCheckedInParticipants();
      resetTaskForm();
    }
  );

  watch(
    () => activeMeeting.value?.participantIds,
    () => {
      syncCheckedInParticipants();
    },
    { immediate: true }
  );

  function firstActiveParticipantId() {
    return activeMeetingParticipants.value[0]?.id ?? '';
  }

  function ensureSelectedParticipants() {
    const activeIds = activeMeetingParticipants.value.map(
      (participant) => participant.id
    );

    selectedParticipantId.value = chooseSelectedParticipantId(
      selectedParticipantId.value,
      activeIds
    );

    if (!agreementParticipantIds.value.length) {
      agreementParticipantIds.value = [...activeIds];
    }
  }

  function syncCheckedInParticipants() {
    const availableIds = participantsStore.activeParticipants.map(
      (participant) => participant.id
    );
    const selectedIds = activeMeeting.value?.participantIds ?? [];

    checkedInParticipantIds.value = normalizeCheckedInParticipantIds(
      availableIds,
      selectedIds
    );
  }

  function participantIsCheckedIn(participantId: string) {
    return checkedInParticipantIds.value.includes(participantId);
  }

  function toggleCheckInParticipant(participantId: string) {
    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    const isCheckedIn = participantIsCheckedIn(participantId);

    if (!isCheckedIn && !canAddGuestParticipant.value) {
      formError.value = t('meeting.guestLimitReached', {
        count: maxCheckInParticipants,
      });
      return;
    }

    const nextParticipantIds = isCheckedIn
      ? checkedInParticipantIds.value.filter((id) => id !== participantId)
      : [...checkedInParticipantIds.value, participantId];

    if (!nextParticipantIds.length) {
      return;
    }

    setCheckedInParticipants(nextParticipantIds);
  }

  function setCheckedInParticipants(participantIds: string[]) {
    checkedInParticipantIds.value = participantIds.slice(
      0,
      maxCheckInParticipants
    );
    meetingsStore.setActiveMeetingParticipants(checkedInParticipantIds.value);
  }

  function getParticipantName(participantId: string) {
    return (
      participantsStore.getParticipantById(participantId)?.name ??
      t('meeting.formerParticipant')
    );
  }

  function getResponsibilityLabel(
    responsibilityType: TaskResponsibilityType,
    participantIds: string[]
  ) {
    if (responsibilityType === 'shared') {
      return t('meeting.shared');
    }

    if (responsibilityType === 'needsDiscussion') {
      return t('meeting.needsDiscussion');
    }

    return (
      participantIds.map(getParticipantName).join(', ') ||
      t('meeting.formerParticipant')
    );
  }

  function formatMeetingDate(value?: string) {
    if (!value) {
      return t('meeting.recentMeeting');
    }

    return new Intl.DateTimeFormat(locale.value, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  }

  function previousCompletedMeetingLabel() {
    const meeting = previousCompletedMeeting.value;

    if (!meeting) {
      return '';
    }

    return t('meeting.fromMeeting', {
      title: getMeetingTemplateName(meeting.templateId, meeting.title),
      date: formatMeetingDate(meeting.completedAt ?? meeting.updatedAt),
    });
  }

  function notePlaceholder(sectionId: MeetingSectionId) {
    return (
      t(`meeting.notePlaceholders.${sectionId}`) ||
      t('meeting.notePlaceholders.default')
    );
  }

  function sectionTitle(sectionId: MeetingSectionId, fallback?: string) {
    return getMeetingSectionTitle(sectionId, fallback);
  }

  function sectionPrompt(sectionId: MeetingSectionId, fallback?: string) {
    return getMeetingSectionPrompt(sectionId, fallback);
  }

  function clearMessages() {
    formError.value = '';
    statusMessage.value = '';
  }

  function resetTaskForm() {
    taskDraft.title = '';
    taskDraft.description = '';
    taskDraft.dueDate = '';
    taskDraft.responsibilityChoice = 'needsDiscussion';
  }

  function openGuestDrawer() {
    clearMessages();

    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    if (!canAddGuestParticipant.value) {
      formError.value = t('meeting.guestLimitReached', {
        count: maxCheckInParticipants,
      });
      return;
    }

    isGuestDrawerOpen.value = true;
  }

  function closeGuestDrawer() {
    isGuestDrawerOpen.value = false;
    drawerSelectedParticipantId.value = '';
    guestName.value = '';
  }

  function selectDrawerParticipant(participantId: string) {
    if (participantIsCheckedIn(participantId)) {
      return;
    }

    drawerSelectedParticipantId.value = participantId;
    guestName.value = '';
  }

  function clearDrawerParticipantSelection() {
    drawerSelectedParticipantId.value = '';
  }

  function addSelectedDrawerParticipant() {
    clearMessages();

    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    if (!canAddGuestParticipant.value) {
      formError.value = t('meeting.guestLimitReached', {
        count: maxCheckInParticipants,
      });
      return;
    }

    if (drawerSelectedParticipantId.value) {
      setCheckedInParticipants([
        ...checkedInParticipantIds.value,
        drawerSelectedParticipantId.value,
      ]);
      selectedParticipantId.value = drawerSelectedParticipantId.value;
      closeGuestDrawer();

      return;
    }

    addNamedGuestParticipant();
  }

  function addNamedGuestParticipant() {
    clearMessages();

    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    if (!canAddGuestParticipant.value) {
      formError.value = t('meeting.guestLimitReached', {
        count: maxCheckInParticipants,
      });
      return;
    }

    const participant = participantsStore.createParticipant({
      name: guestName.value,
      type: 'other',
    });

    if (!participant) {
      formError.value = t('meeting.addNameFirst');
      return;
    }

    setCheckedInParticipants([
      ...checkedInParticipantIds.value,
      participant.id,
    ]);
    selectedParticipantId.value = participant.id;
    closeGuestDrawer();
    statusMessage.value = t('meeting.personAdded');
  }

  function openNoteEditor(note: EnrichedMeetingNote) {
    if (!canEditMeeting.value || isCompleted.value) {
      return;
    }

    clearMessages();
    editingNoteId.value = note.id;
    editingNoteParticipantId.value = note.participantId;
    editingNoteText.value = note.text;
    noteEditorError.value = '';
  }

  function closeNoteEditor() {
    editingNoteId.value = '';
    editingNoteParticipantId.value = '';
    editingNoteText.value = '';
    noteEditorError.value = '';
  }

  function saveNoteEdit() {
    if (!editingNoteId.value) {
      return;
    }

    noteEditorError.value = '';

    if (!canEditMeeting.value) {
      noteEditorError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    const error = meetingsStore.updateNote(
      editingNoteId.value,
      editingNoteParticipantId.value,
      editingNoteText.value
    );

    if (error) {
      noteEditorError.value = error;
      return;
    }

    closeNoteEditor();
    statusMessage.value = t('meeting.noteUpdated');
  }

  function addNote() {
    const section = currentSection.value;

    if (!section) {
      return;
    }

    clearMessages();

    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    const error = meetingsStore.addNote(
      section.id,
      selectedParticipantId.value,
      noteText.value
    );

    if (error) {
      formError.value = error;
      return;
    }

    noteText.value = '';
    statusMessage.value = t('meeting.noteAdded');
  }

  function addTask() {
    const section = currentSection.value;

    if (!section) {
      return;
    }

    clearMessages();

    if (!canCreateTasks.value) {
      formError.value = t('meeting.roleCannotEditTasks');
      return;
    }

    const error = meetingsStore.addTask(section.id, {
      title: taskDraft.title,
      description: taskDraft.description,
      dueDate: taskDraft.dueDate,
      ...resolveTaskResponsibility(
        taskDraft.responsibilityChoice,
        activeMeetingParticipants.value.map((participant) => participant.id)
      ),
    });

    if (error) {
      formError.value = error;
      return;
    }

    resetTaskForm();
    statusMessage.value = t('meeting.taskAdded');
  }

  function addAgreement() {
    const section = currentSection.value;

    if (!section) {
      return;
    }

    clearMessages();

    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditAgreements');
      return;
    }

    const error = meetingsStore.addAgreement(
      section.id,
      agreementText.value,
      agreementParticipantIds.value
    );

    if (error) {
      formError.value = error;
      return;
    }

    agreementText.value = '';
    agreementParticipantIds.value = activeMeetingParticipants.value.map(
      (participant) => participant.id
    );
    statusMessage.value = t('meeting.agreementAdded');
  }

  function toggleTask(taskId: string, status: MeetingTaskStatus) {
    if (!canEditTasks.value) {
      formError.value = t('meeting.roleCannotEditTasks');
      return;
    }

    meetingsStore.updateTaskStatus(taskId, status === 'open' ? 'done' : 'open');
  }

  function handleUnfinishedTasks(action: TaskReviewAction) {
    const meeting = activeMeeting.value;
    const previousMeeting = previousCompletedMeeting.value;

    if (!meeting || !previousMeeting) {
      return;
    }

    clearMessages();

    if (!canEditTasks.value) {
      formError.value = t('meeting.roleCannotEditTasks');
      return;
    }

    if (action === 'keep') {
      statusMessage.value = t('meeting.keptForNow');
    }

    if (action === 'done' || action === 'skipped') {
      tasksStore.updateTasksFromMeeting(previousMeeting.id, action);
      meetingsStore.updateTasksFromMeeting(previousMeeting.id, action);
      statusMessage.value =
        action === 'done'
          ? t('meeting.markedDone')
          : t('meeting.skippedForNow');
    }

    if (action === 'move') {
      tasksStore.moveOpenTasksToMeeting(previousMeeting.id, meeting.id);
      meetingsStore.updateTasksFromMeeting(previousMeeting.id, 'skipped');
      statusMessage.value = t('meeting.movedToThisWeek');
    }

    tasksStore.markReviewHandled(meeting.id, previousMeeting.id);
  }

  function goBack() {
    const meeting = activeMeeting.value;

    if (!meeting || !canEditMeeting.value || isFirstStep.value) {
      return;
    }

    if (meeting.currentSectionIndex === 0) {
      hasStartedRitual.value = false;
      return;
    }

    meetingsStore.setCurrentSection(meeting.currentSectionIndex - 1);
  }

  function editActions() {
    const meeting = activeMeeting.value;

    if (!meeting || !canEditMeeting.value) {
      return;
    }

    const actionSectionIndex = meeting.sections.findIndex((section) =>
      taskSectionIds.includes(section.id)
    );

    meetingsStore.setCurrentSection(
      actionSectionIndex >= 0
        ? actionSectionIndex
        : Math.max(meeting.currentSectionIndex - 1, 0)
    );
  }

  function exitMeeting() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push({ name: 'home' });
  }

  function closeMeeting() {
    router.push({ name: 'home' });
  }

  function goNext() {
    const meeting = activeMeeting.value;

    if (!meeting || !canEditMeeting.value) {
      return;
    }

    meetingsStore.setCurrentSection(meeting.currentSectionIndex + 1);
  }

  function startRitual() {
    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    if (!checkedInParticipantIds.value.length) {
      return;
    }

    clearMessages();
    setCheckedInParticipants(checkedInParticipantIds.value);
    hasStartedRitual.value = true;
  }

  function saveDraft() {
    clearMessages();

    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    meetingsStore.saveDraft();
    statusMessage.value = t('meeting.draftSaved');
  }

  function saveDraftAndExit() {
    if (!canEditMeeting.value) {
      saveDraft();
      return;
    }

    saveDraft();
    exitMeeting();
  }

  function pauseRitual() {
    clearMessages();

    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    if (!meetingsStore.pauseMeeting()) {
      formError.value = t('meeting.pauseRitualFailed');
      return;
    }

    statusMessage.value = t('meeting.ritualPaused');
  }

  function resumeRitual() {
    clearMessages();

    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    if (!meetingsStore.resumeActiveMeeting()) {
      formError.value = t('meeting.resumeRitualFailed');
      return;
    }

    statusMessage.value = t('meeting.ritualResumed');
  }

  async function finishMeeting() {
    if (isFinishingMeeting.value) {
      return;
    }

    clearMessages();

    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    const meetingId = activeMeeting.value?.id;

    if (!meetingId) {
      formError.value = t('meetingStore.openBeforeFinish');
      return;
    }

    if (!hasMeetingContent.value) {
      formError.value = t('meeting.atLeastOne');
      return;
    }

    isFinishingMeeting.value = true;

    const error = meetingsStore.finishMeeting();

    if (error) {
      formError.value = error;
      isFinishingMeeting.value = false;
      return;
    }

    try {
      let aiSummaryFailed = false;

      if (canUseFeature('aiSummary')) {
        const completedMeeting = meetingsStore.meetings.find(
          (meeting) => meeting.id === meetingId
        );

        if (completedMeeting) {
          try {
            const summary = await generateMeetingSummary(completedMeeting);
            meetingsStore.saveAiSummary(meetingId, summary);
          } catch {
            aiSummaryFailed = true;
          }
        }
      }

      await router.push({
        name: 'meeting-summary',
        params: { meetingId },
        query: aiSummaryFailed ? { aiSummary: 'failed' } : {},
      });
    } finally {
      isFinishingMeeting.value = false;
    }
  }

  function endSessionIncomplete() {
    clearMessages();

    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    isRitualMenuOpen.value = false;
    isEndSessionDialogOpen.value = true;
  }

  function confirmEndSessionIncomplete() {
    isEndSessionDialogOpen.value = false;

    if (!meetingsStore.endMeetingIncomplete()) {
      formError.value = t('meeting.endSessionFailed');
      return;
    }

    router.push({ name: 'home' });
  }

  function deleteRitual() {
    const meeting = activeMeeting.value;

    if (!meeting) {
      return;
    }

    clearMessages();

    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    isRitualMenuOpen.value = false;
    isDeleteRitualDialogOpen.value = true;
  }

  function confirmDeleteRitual() {
    const meeting = activeMeeting.value;

    if (!meeting) {
      isDeleteRitualDialogOpen.value = false;
      return;
    }

    isDeleteRitualDialogOpen.value = false;

    const wasDeleted = meetingsStore.deleteDraftMeeting(meeting.id);

    if (!wasDeleted) {
      formError.value = t('meeting.deleteRitualFailed');
      return;
    }

    statusMessage.value = t('meeting.ritualDeleted');
    router.push({ name: 'home' });
  }

  function handleRitualMenuSelect(actionId: string) {
    switch (actionId) {
      case 'pause-ritual':
        pauseRitual();
        break;
      case 'resume-ritual':
        resumeRitual();
        break;
      case 'save-draft-exit':
        saveDraftAndExit();
        break;
      case 'end-session':
        endSessionIncomplete();
        break;
      case 'delete-ritual':
        deleteRitual();
        break;
    }
  }

  function startNewMeeting() {
    if (!canCreateMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    router.push({ name: 'meeting-templates' });
  }

  return {
    activeMeeting,
    activeMeetingParticipants,
    agreementParticipantIds,
    agreementText,
    allAgreements,
    allNotes,
    allTasks,
    canAddAgreements,
    canAddGuestParticipant,
    canAddTasks,
    canCreateMeeting,
    canCreateTasks,
    canEditMeeting,
    canEditTasks,
    canSubmitGuestDrawer,
    checkInParticipants,
    checkedInParticipantIds,
    clearDrawerParticipantSelection,
    closeGuestDrawer,
    closeNoteEditor,
    closeMeeting,
    currentAgreements,
    currentNotes,
    currentSection,
    currentStepNumber,
    currentTasks,
    deleteRitual,
    drawerFamilyMembers,
    drawerSelectedParticipantId,
    editingNoteParticipantId,
    editingNoteText,
    editActions,
    exitMeeting,
    finishMeeting,
    formError,
    goBack,
    goNext,
    guestName,
    handleRitualMenuSelect,
    handleUnfinishedTasks,
    hasMeetingContent,
    isCompleted,
    isDeleteRitualDialogOpen,
    isEndSessionDialogOpen,
    isFinalSection,
    isFinishingMeeting,
    isFirstStep,
    isGuestDrawerOpen,
    isNoteEditorOpen,
    isParticipantCheckInStep,
    isPaused,
    isRitualMenuOpen,
    meetingDurationLabel,
    meetingDurationMinutes,
    neutralHint,
    noteEditorError,
    noteEditorNeutralHint,
    notePlaceholder,
    noteText,
    openGuestDrawer,
    openNoteEditor,
    participantIsCheckedIn,
    previousCompletedMeeting,
    previousCompletedMeetingLabel,
    previousUnfinishedTasks,
    progressPercent,
    reviewCounts,
    reviewTasks,
    sectionPrompt,
    sectionTitle,
    selectDrawerParticipant,
    selectedParticipantId,
    showNotes,
    showTaskReview,
    startNewMeeting,
    startRitual,
    statusMessage,
    taskDraft,
    toggleCheckInParticipant,
    toggleTask,
    totalSteps,
    addAgreement,
    addNote,
    addSelectedDrawerParticipant,
    addTask,
    confirmDeleteRitual,
    confirmEndSessionIncomplete,
    saveDraft,
    saveNoteEdit,
  };
}
