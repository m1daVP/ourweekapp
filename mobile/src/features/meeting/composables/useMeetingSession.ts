import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import type {
  DeletedMeetingAgreementSnapshot,
  DeletedMeetingNoteSnapshot,
  DeletedMeetingTaskSnapshot,
} from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
import { useSubscriptionStore } from '@/app/stores/subscription';
import {
  generateMeetingSummary,
  parseAiQuotaError,
  type GenerateMeetingSummaryOptions,
} from '@/features/meeting/aiSummaryService';
import { getAiRecapContentReadiness } from '@/features/meeting/aiRecapContentReadiness';
import {
  acknowledgeAiRecapDisclosure,
  hasAcknowledgedAiRecapDisclosure,
} from '@/features/meeting/aiRecapDisclosure';
import {
  agreementSectionIds,
  getMeetingSectionPrompt,
  getMeetingSectionTitle,
  getMeetingTemplateName,
  taskSectionIds,
} from '@/features/meeting/meetingTemplates';
import { getSectionPresentation } from '@/features/meeting/meetingPresentation';
import type {
  MeetingComposerDraftFields,
  MeetingComposerDraftType,
} from '@/features/meeting/meetingComposerDrafts';
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
import { useToast } from '@/shared/composables/useToast';
import { useInAppNotification } from '@/shared/composables/useInAppNotification';
import { haptics } from '@/shared/services/hapticsService';
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { discardMeetingComposerDraftsForMeeting } from '@/features/meeting/meetingComposerDrafts';

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

export function isMeetingCheckInStep(meeting: Meeting | null) {
  return Boolean(
    meeting &&
    meeting.status !== 'completed' &&
    meeting.currentSectionIndex === 0 &&
    !meeting.checkInCompleted
  );
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
  const subscriptionStore = useSubscriptionStore();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { can } = useWorkspacePermissions();
  const workspaceStore = useWorkspaceStore();
  const { showToast } = useToast();
  const { showInAppNotification } = useInAppNotification();

  const noteText = ref('');
  const agreementText = ref('');
  const selectedParticipantId = ref('');
  const agreementParticipantIds = ref<string[]>([]);
  const formError = ref('');
  const statusMessage = ref('');
  const isFinishingMeeting = ref(false);

  watch(statusMessage, (message) => {
    if (!message) {
      return;
    }

    showInAppNotification(message);
    statusMessage.value = '';
  });
  const isGuestDrawerOpen = ref(false);
  const isRitualMenuOpen = ref(false);
  const isDeleteRitualDialogOpen = ref(false);
  const isAiRecapDisclosureOpen = ref(false);
  const pendingAiRecapDisclosureMeetingId = ref<string | null>(null);
  const isAiRecapLowContentOpen = ref(false);
  const pendingAiRecapLowContentMeetingId = ref<string | null>(null);
  const pendingAiRecapLowContentOverride = ref(false);
  const drawerSelectedParticipantId = ref('');
  const guestName = ref('');
  const checkedInParticipantIds = ref<string[]>([]);
  const editingNoteId = ref('');
  const editingNoteParticipantId = ref('');
  const editingNoteText = ref('');
  const noteEditorError = ref('');
  const editingTaskId = ref('');
  const taskEditorError = ref('');
  const editingAgreementId = ref('');
  const editingAgreementText = ref('');
  const editingAgreementParticipantIds = ref<string[]>([]);
  const agreementEditorError = ref('');
  const latestDeletedNote = ref<DeletedMeetingNoteSnapshot | null>(null);
  const latestDeletedTask = ref<DeletedMeetingTaskSnapshot | null>(null);
  const latestDeletedAgreement = ref<DeletedMeetingAgreementSnapshot | null>(
    null
  );

  const taskDraft = reactive<TaskDraftState>({
    title: '',
    description: '',
    responsibilityChoice: 'needsDiscussion',
    dueDate: '',
  });
  const editingTaskDraft = reactive<TaskDraftState>({
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
  const isParticipantCheckInStep = computed(() =>
    isMeetingCheckInStep(activeMeeting.value)
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
  const currentPresentation = computed(() => {
    const meeting = activeMeeting.value;
    const section = currentSection.value;

    return meeting && section
      ? getSectionPresentation(
          meeting.templateId,
          section.id,
          meeting.currentSectionIndex,
          meeting.sections.length
        )
      : null;
  });
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
  const isTaskEditorOpen = computed(() => Boolean(editingTaskId.value));
  const isAgreementEditorOpen = computed(() =>
    Boolean(editingAgreementId.value)
  );
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
      syncCheckedInParticipants();
      ensureSelectedParticipants();
    },
    { immediate: true }
  );

  watch(
    () => currentSection.value?.id,
    () => {
      closeNoteEditor();
      closeTaskEditor();
      closeAgreementEditor();
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

  function getParticipantName(participantId?: string) {
    if (!participantId) {
      return t('meeting.shared');
    }

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

  function resetEditingTaskForm() {
    editingTaskDraft.title = '';
    editingTaskDraft.description = '';
    editingTaskDraft.dueDate = '';
    editingTaskDraft.responsibilityChoice = 'needsDiscussion';
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
    editingNoteParticipantId.value = note.participantId ?? '';
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

  function openTaskEditor(task: EnrichedMeetingTask) {
    if (!canEditTasks.value || isCompleted.value) {
      return;
    }

    clearMessages();
    editingTaskId.value = task.id;
    editingTaskDraft.title = task.title;
    editingTaskDraft.description = task.description ?? '';
    editingTaskDraft.dueDate = task.dueDate ?? '';
    editingTaskDraft.responsibilityChoice =
      task.responsibilityType === 'participant'
        ? (task.responsibleParticipantIds[0] ?? 'needsDiscussion')
        : task.responsibilityType;
    taskEditorError.value = '';
  }

  function closeTaskEditor() {
    editingTaskId.value = '';
    taskEditorError.value = '';
    resetEditingTaskForm();
  }

  function saveTaskEdit() {
    if (!editingTaskId.value) {
      return;
    }

    taskEditorError.value = '';

    if (!canEditTasks.value || isCompleted.value) {
      taskEditorError.value = t('meeting.roleCannotEditTasks');
      return;
    }

    const error = meetingsStore.updateTaskDetails(editingTaskId.value, {
      title: editingTaskDraft.title,
      description: editingTaskDraft.description,
      dueDate: editingTaskDraft.dueDate,
      ...resolveTaskResponsibility(
        editingTaskDraft.responsibilityChoice,
        activeMeetingParticipants.value.map((participant) => participant.id)
      ),
    });

    if (error) {
      taskEditorError.value = error;
      return;
    }

    closeTaskEditor();
    statusMessage.value = t('meeting.taskUpdated');
  }

  function openAgreementEditor(agreement: EnrichedAgreement) {
    if (!canEditMeeting.value || isCompleted.value) {
      return;
    }

    clearMessages();
    editingAgreementId.value = agreement.id;
    editingAgreementText.value = agreement.text;
    editingAgreementParticipantIds.value = [...agreement.participantIds];
    agreementEditorError.value = '';
  }

  function closeAgreementEditor() {
    editingAgreementId.value = '';
    editingAgreementText.value = '';
    editingAgreementParticipantIds.value = [];
    agreementEditorError.value = '';
  }

  function saveAgreementEdit() {
    if (!editingAgreementId.value) {
      return;
    }

    agreementEditorError.value = '';

    if (!canEditMeeting.value || isCompleted.value) {
      agreementEditorError.value = t('meeting.roleCannotEditAgreements');
      return;
    }

    const error = meetingsStore.updateAgreement(
      editingAgreementId.value,
      editingAgreementText.value,
      editingAgreementParticipantIds.value
    );

    if (error) {
      agreementEditorError.value = error;
      return;
    }

    closeAgreementEditor();
    statusMessage.value = t('meeting.agreementUpdated');
  }

  function restoreDeletedNote() {
    const snapshot = latestDeletedNote.value;

    if (!snapshot) {
      return;
    }

    latestDeletedNote.value = null;
    meetingsStore.restoreNote(snapshot);
  }

  function deleteNote(noteId: string) {
    clearMessages();

    if (!canEditMeeting.value || isCompleted.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    const snapshot = meetingsStore.deleteNote(noteId);

    if (!snapshot) {
      formError.value = t('meetingStore.noteNotFound');
      return;
    }

    latestDeletedNote.value = snapshot;
    void showToast(t('meeting.noteDeleted'), {
      action: {
        label: t('common.undo'),
        onClick: restoreDeletedNote,
      },
      durationMs: 5200,
    });
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
    void haptics.confirm();
  }

  function restoreDeletedTask() {
    const snapshot = latestDeletedTask.value;

    if (!snapshot) {
      return;
    }

    latestDeletedTask.value = null;
    meetingsStore.restoreTask(snapshot);
  }

  function deleteTask(taskId: string) {
    clearMessages();

    if (!canEditTasks.value || isCompleted.value) {
      formError.value = t('meeting.roleCannotEditTasks');
      return;
    }

    const snapshot = meetingsStore.deleteTask(taskId);

    if (!snapshot) {
      formError.value = t('meetingStore.taskNotFound');
      return;
    }

    latestDeletedTask.value = snapshot;
    void showToast(t('meeting.taskDeleted'), {
      action: {
        label: t('common.undo'),
        onClick: restoreDeletedTask,
      },
      durationMs: 5200,
    });
  }

  function restoreDeletedAgreement() {
    const snapshot = latestDeletedAgreement.value;

    if (!snapshot) {
      return;
    }

    latestDeletedAgreement.value = null;
    meetingsStore.restoreAgreement(snapshot);
  }

  function deleteAgreement(agreementId: string) {
    clearMessages();

    if (!canEditMeeting.value || isCompleted.value) {
      formError.value = t('meeting.roleCannotEditAgreements');
      return;
    }

    const snapshot = meetingsStore.deleteAgreement(agreementId);

    if (!snapshot) {
      formError.value = t('meetingStore.agreementNotFound');
      return;
    }

    latestDeletedAgreement.value = snapshot;
    void showToast(t('meeting.agreementDeleted'), {
      action: {
        label: t('common.undo'),
        onClick: restoreDeletedAgreement,
      },
      durationMs: 5200,
    });
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
    void haptics.confirm();
  }

  async function submitCapturedItem(
    type: MeetingComposerDraftType,
    fields: MeetingComposerDraftFields
  ): Promise<{ ok: true; itemId: string } | { ok: false; message: string }> {
    const meeting = activeMeeting.value;
    const section = currentSection.value;

    if (!meeting || !section || !canEditMeeting.value) {
      return { ok: false, message: t('meeting.roleCannotEditMeetings') };
    }

    let error: string | null;
    if (type === 'note') {
      error = meetingsStore.addNote(
        section.id,
        undefined,
        String(fields.text ?? '')
      );
    } else if (type === 'task') {
      error = meetingsStore.addTask(section.id, {
        title: String(fields.title ?? ''),
        description: String(fields.description ?? '') || undefined,
        dueDate: String(fields.dueDate ?? '') || undefined,
        ...resolveTaskResponsibility(
          String(fields.responsibilityChoice ?? 'needsDiscussion'),
          activeMeetingParticipants.value.map((participant) => participant.id)
        ),
      });
    } else {
      error = meetingsStore.addAgreement(
        section.id,
        String(fields.text ?? ''),
        activeMeetingParticipants.value.map((participant) => participant.id)
      );
    }

    if (error) {
      return { ok: false, message: error };
    }

    // Store mutations update memory first. A second, observable write is the
    // acknowledgement used by the composer before it removes its local draft.
    const write = meetingsStore.persist();
    if (!write.ok) {
      return { ok: false, message: t('meeting.presentation.saveFailed') };
    }

    const savedSection = meeting.sections.find(
      (item) => item.id === section.id
    );
    const item =
      type === 'note'
        ? savedSection?.notes.at(-1)
        : type === 'task'
          ? savedSection?.tasks.at(-1)
          : savedSection?.agreements.at(-1);

    if (!item) {
      return { ok: false, message: t('meeting.presentation.saveFailed') };
    }

    statusMessage.value = t('meeting.presentation.savedOnDevice');
    void haptics.confirm();
    return { ok: true, itemId: item.id };
  }

  function toggleTask(taskId: string, status: MeetingTaskStatus) {
    if (!canEditTasks.value || isCompleted.value) {
      formError.value = t('meeting.roleCannotEditTasks');
      return;
    }

    const nextStatus = status === 'open' ? 'done' : 'open';
    meetingsStore.updateTaskStatus(taskId, nextStatus);

    if (nextStatus === 'done') {
      void haptics.confirm();
    }
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

      if (action === 'done') {
        void haptics.confirm();
      }
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
      meetingsStore.setCheckInCompleted(false);
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
    if (!isCompleted.value && canEditMeeting.value) {
      clearMessages();

      if (!meetingsStore.pauseMeeting() || !meetingsStore.persist().ok) {
        formError.value = t('meeting.presentation.saveFailed');
        return;
      }

      statusMessage.value = t('meeting.presentation.savedOnDevice');
    }

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
    meetingsStore.setCheckInCompleted(true);
    void haptics.confirm();
  }

  function saveDraft() {
    clearMessages();

    if (!canEditMeeting.value) {
      formError.value = t('meeting.roleCannotEditMeetings');
      return;
    }

    meetingsStore.saveDraft();
    const write = meetingsStore.persist();

    if (!write.ok) {
      formError.value = t('meeting.presentation.saveFailed');
      return false;
    }

    statusMessage.value = t('meeting.draftSaved');
    return true;
  }

  function saveDraftAndExit() {
    if (!canEditMeeting.value) {
      saveDraft();
      return;
    }

    if (saveDraft()) {
      exitMeeting();
    }
  }

  async function finishMeeting() {
    if (
      isFinishingMeeting.value ||
      isAiRecapDisclosureOpen.value ||
      isAiRecapLowContentOpen.value
    ) {
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

    const draftCleanup = discardMeetingComposerDraftsForMeeting(
      workspaceStore.currentUserId,
      workspaceStore.workspace.id,
      meetingId
    );

    if (!draftCleanup.ok) {
      formError.value = t('meeting.presentation.saveFailed');
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
      void haptics.completeMeeting();
      await router.push({
        name: 'meeting-summary',
        params: { meetingId },
      });
    } finally {
      isFinishingMeeting.value = false;
    }
  }

  async function confirmAiRecapDisclosure() {
    const meetingId = pendingAiRecapDisclosureMeetingId.value;
    const allowLowContent = pendingAiRecapLowContentOverride.value;

    if (!meetingId || isFinishingMeeting.value) {
      return;
    }

    acknowledgeAiRecapDisclosure();
    pendingAiRecapDisclosureMeetingId.value = null;
    pendingAiRecapLowContentOverride.value = false;
    isAiRecapDisclosureOpen.value = false;
    isFinishingMeeting.value = true;

    try {
      await continueCompletedMeeting(meetingId, true, { allowLowContent });
    } finally {
      isFinishingMeeting.value = false;
    }
  }

  async function deferAiRecapDisclosure() {
    const meetingId = pendingAiRecapDisclosureMeetingId.value;

    if (!meetingId || isFinishingMeeting.value) {
      return;
    }

    pendingAiRecapDisclosureMeetingId.value = null;
    pendingAiRecapLowContentOverride.value = false;
    isAiRecapDisclosureOpen.value = false;
    isFinishingMeeting.value = true;

    try {
      await continueCompletedMeeting(meetingId, false);
    } finally {
      isFinishingMeeting.value = false;
    }
  }

  async function confirmAiRecapLowContent() {
    const meetingId = pendingAiRecapLowContentMeetingId.value;

    if (!meetingId || isFinishingMeeting.value) {
      return;
    }

    pendingAiRecapLowContentMeetingId.value = null;
    isAiRecapLowContentOpen.value = false;
    isFinishingMeeting.value = true;

    try {
      if (!hasAcknowledgedAiRecapDisclosure()) {
        pendingAiRecapLowContentOverride.value = true;
        pendingAiRecapDisclosureMeetingId.value = meetingId;
        isAiRecapDisclosureOpen.value = true;
        return;
      }

      await continueCompletedMeeting(meetingId, true, {
        allowLowContent: true,
      });
    } finally {
      isFinishingMeeting.value = false;
    }
  }

  async function deferAiRecapLowContent() {
    const meetingId = pendingAiRecapLowContentMeetingId.value;

    if (!meetingId || isFinishingMeeting.value) {
      return;
    }

    pendingAiRecapLowContentMeetingId.value = null;
    isAiRecapLowContentOpen.value = false;
    pendingAiRecapLowContentOverride.value = false;
    isFinishingMeeting.value = true;

    try {
      await continueCompletedMeeting(meetingId, false);
    } finally {
      isFinishingMeeting.value = false;
    }
  }

  async function continueCompletedMeeting(
    meetingId: string,
    shouldGenerateRecap: boolean,
    generationOptions: GenerateMeetingSummaryOptions = {}
  ) {
    let aiSummaryFailed = false;
    let aiQuotaInfo: ReturnType<typeof parseAiQuotaError> = null;

    if (shouldGenerateRecap) {
      const completedMeeting = meetingsStore.meetings.find(
        (meeting) => meeting.id === meetingId
      );

      if (completedMeeting) {
        try {
          await generateMeetingSummary(completedMeeting, generationOptions);
        } catch (error) {
          aiSummaryFailed = true;
          aiQuotaInfo = parseAiQuotaError(error);
        }
      }
    }

    await router.push({
      name: 'meeting-summary',
      params: { meetingId },
      query: aiSummaryFailed
        ? {
            aiSummary: 'failed',
            ...(aiQuotaInfo
              ? {
                  aiSummaryScope: aiQuotaInfo.scope,
                  aiSummaryLimit: String(aiQuotaInfo.limit),
                  aiSummaryReset: aiQuotaInfo.resetAt,
                }
              : {}),
          }
        : {},
    });
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
    void haptics.impact();
    router.push({ name: 'home' });
  }

  function handleRitualMenuSelect(actionId: string) {
    switch (actionId) {
      case 'save-draft-exit':
        saveDraftAndExit();
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
    confirmAiRecapDisclosure,
    confirmAiRecapLowContent,
    checkInParticipants,
    checkedInParticipantIds,
    clearDrawerParticipantSelection,
    closeGuestDrawer,
    closeNoteEditor,
    closeTaskEditor,
    closeAgreementEditor,
    closeMeeting,
    currentAgreements,
    currentNotes,
    currentPresentation,
    currentSection,
    currentStepNumber,
    currentTasks,
    deleteNote,
    deleteRitual,
    deleteTask,
    deleteAgreement,
    drawerFamilyMembers,
    drawerSelectedParticipantId,
    editingNoteParticipantId,
    editingNoteText,
    editingTaskDraft,
    editingAgreementParticipantIds,
    editingAgreementText,
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
    isAiRecapDisclosureOpen,
    isAiRecapLowContentOpen,
    isDeleteRitualDialogOpen,
    isFinalSection,
    isFinishingMeeting,
    isFirstStep,
    isGuestDrawerOpen,
    isNoteEditorOpen,
    isTaskEditorOpen,
    isAgreementEditorOpen,
    isParticipantCheckInStep,
    isRitualMenuOpen,
    meetingDurationLabel,
    meetingDurationMinutes,
    neutralHint,
    noteEditorError,
    taskEditorError,
    agreementEditorError,
    noteEditorNeutralHint,
    notePlaceholder,
    noteText,
    openGuestDrawer,
    openNoteEditor,
    openTaskEditor,
    openAgreementEditor,
    participantIsCheckedIn,
    previousCompletedMeeting,
    previousCompletedMeetingLabel,
    previousUnfinishedTasks,
    progressPercent,
    reviewCounts,
    reviewTasks,
    deferAiRecapDisclosure,
    deferAiRecapLowContent,
    restoreDeletedNote,
    restoreDeletedTask,
    sectionPrompt,
    sectionTitle,
    selectDrawerParticipant,
    selectedParticipantId,
    showNotes,
    showTaskReview,
    startNewMeeting,
    submitCapturedItem,
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
    saveDraft,
    saveNoteEdit,
    saveTaskEdit,
    saveAgreementEdit,
  };
}
