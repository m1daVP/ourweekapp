<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { usePrivateNotesStore } from '@/app/stores/privateNotes';
import { useTasksStore } from '@/app/stores/tasks';
import { generateMeetingSummary } from '@/features/meeting/aiSummaryService';
import {
  agreementSectionIds,
  getMeetingSectionPrompt,
  getMeetingSectionTitle,
  getMeetingTemplateName,
  taskSectionIds,
} from '@/features/meeting/meetingTemplates';
import type { MeetingSectionId } from '@/features/meeting/types';
import type { Participant } from '@/features/participants/types';
import type { TaskResponsibilityType } from '@/features/tasks/types';
import ActionMenuPopup from '@/shared/components/ActionMenuPopup.vue';
import type { ActionMenuItem } from '@/shared/components/ActionMenuPopup.vue';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';
import ConfirmationDialog from '@/shared/components/ConfirmationDialog.vue';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';

const meetingsStore = useMeetingsStore();
const { t, locale } = useI18n();
const participantsStore = useParticipantsStore();
const privateNotesStore = usePrivateNotesStore();
const tasksStore = useTasksStore();
const router = useRouter();
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
const maxCheckInParticipants = 10;

type GroupMoodId = 'tired' | 'good' | 'reflective' | 'energized';

const selectedMood = ref<GroupMoodId>('good');
const checkedInParticipantIds = ref<string[]>([]);
const moodOptions: Array<{
  id: GroupMoodId;
  label: string;
  emoji: string;
}> = [
  { id: 'tired', label: 'Tired', emoji: '\u{1F634}' },
  { id: 'good', label: 'Good', emoji: '\u{1F60A}' },
  { id: 'reflective', label: 'Reflective', emoji: '\u{1F914}' },
  { id: 'energized', label: 'Energized', emoji: '\u{1F680}' },
];

const taskDraft = reactive({
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
    .map((participantId) => participantsStore.getParticipantById(participantId))
    .filter((participant): participant is Participant => Boolean(participant));
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
const isCompleted = computed(() => activeMeeting.value?.status === 'completed');
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
const previousUnfinishedTasks = computed(() => {
  const previousMeeting = previousCompletedMeeting.value;

  if (!previousMeeting) {
    return [];
  }

  return tasksStore.tasks.filter(
    (task) =>
      task.status === 'open' && task.sourceMeetingId === previousMeeting.id
  );
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

const allNotes = computed(() =>
  activeMeeting.value
    ? activeMeeting.value.sections.flatMap((section) =>
        section.notes.map((note) => ({
          ...note,
          sectionTitle: getMeetingSectionTitle(section.id, section.title),
          participantName: getParticipantName(note.participantId),
        }))
      )
    : []
);
const allTasks = computed(() =>
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
const latestPrivateMeetingNote = computed(() => {
  const meetingId = activeMeeting.value?.id;

  if (!meetingId) {
    return null;
  }

  return (
    privateNotesStore.sortedNotes.find(
      (note) => note.relatedMeetingId === meetingId
    ) ?? null
  );
});
const allAgreements = computed(() =>
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
const hasMeetingContent = computed(
  () =>
    allNotes.value.length > 0 ||
    allTasks.value.length > 0 ||
    allAgreements.value.length > 0
);

const neutralHint = computed(() => {
  if (currentSection.value?.id !== 'tensions' || !noteText.value.trim()) {
    return '';
  }

  const loadedWords = ['always', 'never', 'lazy', 'stupid', 'fault', 'blame'];
  const lowerText = noteText.value.toLowerCase();

  return loadedWords.some((word) => lowerText.includes(word))
    ? t('meeting.neutralHint')
    : '';
});

const ritualMenuItems = computed<ActionMenuItem[]>(() => [
  {
    id: isPaused.value ? 'resume-ritual' : 'pause-ritual',
    label: isPaused.value
      ? t('meeting.menu.resumeRitual')
      : t('meeting.menu.pauseRitual'),
    icon: isPaused.value ? 'play_arrow' : 'pause',
    disabled: !canEditMeeting.value,
  },
  {
    id: 'save-draft-exit',
    label: t('meeting.menu.saveDraftExit'),
    icon: 'draft',
    disabled: !canEditMeeting.value,
  },
  {
    id: 'end-session',
    label: t('meeting.menu.endSession'),
    icon: 'logout',
    variant: 'destructive',
    dividerBefore: true,
    disabled: !canEditMeeting.value || isCompleted.value,
  },
  {
    id: 'delete-ritual',
    label: t('meeting.menu.deleteRitual'),
    icon: 'delete',
    variant: 'destructive',
    disabled: !canEditMeeting.value || isCompleted.value,
  },
]);

onMounted(() => {
  participantsStore.ensureDefaultParticipants();
  tasksStore.syncFromMeetings(meetingsStore.meetings);

  if (!canCreateMeeting.value && !meetingsStore.activeMeeting) {
    return;
  }

  const existingMeeting =
    activeMeeting.value && activeMeeting.value.status !== 'completed'
      ? activeMeeting.value
      : meetingsStore.meetings.find(
          (meeting) => meeting.status !== 'completed'
        );

  if (!existingMeeting) {
    router.replace({ name: 'meeting-templates' });
    return;
  }

  const meeting = meetingsStore.resumeMeeting(existingMeeting.id);

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

  if (!activeIds.includes(selectedParticipantId.value)) {
    selectedParticipantId.value = activeIds[0] ?? '';
  }

  if (!agreementParticipantIds.value.length) {
    agreementParticipantIds.value = [...activeIds];
  }
}

function syncCheckedInParticipants() {
  const availableIds = participantsStore.activeParticipants.map(
    (participant) => participant.id
  );
  const selectedIds =
    activeMeeting.value?.participantIds.filter((participantId) =>
      availableIds.includes(participantId)
    ) ?? [];

  checkedInParticipantIds.value = selectedIds.length
    ? selectedIds.slice(0, maxCheckInParticipants)
    : availableIds.slice(0, maxCheckInParticipants);
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

  checkedInParticipantIds.value = nextParticipantIds;
  setCheckedInParticipants(nextParticipantIds);
}

function setCheckedInParticipants(participantIds: string[]) {
  checkedInParticipantIds.value = participantIds.slice(
    0,
    maxCheckInParticipants
  );
  meetingsStore.setActiveMeetingParticipants(checkedInParticipantIds.value);
}

function avatarStyle(participant: Participant) {
  const isAlexStyle =
    participant.name.trim().toLowerCase() === 'alex' ||
    participant.initials.toUpperCase() === 'A';

  return {
    backgroundColor: isAlexStyle
      ? 'var(--color-secondary-container)'
      : participant.avatarColor,
    color: isAlexStyle ? 'var(--color-secondary)' : 'var(--color-on-primary)',
  };
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

function resolveTaskResponsibility() {
  if (taskDraft.responsibilityChoice === 'shared') {
    return {
      responsibilityType: 'shared' as const,
      responsibleParticipantIds: activeMeetingParticipants.value.map(
        (participant) => participant.id
      ),
    };
  }

  if (taskDraft.responsibilityChoice === 'needsDiscussion') {
    return {
      responsibilityType: 'needsDiscussion' as const,
      responsibleParticipantIds: [],
    };
  }

  return {
    responsibilityType: 'participant' as const,
    responsibleParticipantIds: [taskDraft.responsibilityChoice],
  };
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

  setCheckedInParticipants([...checkedInParticipantIds.value, participant.id]);
  selectedParticipantId.value = participant.id;
  closeGuestDrawer();
  statusMessage.value = t('meeting.personAdded');
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
    ...resolveTaskResponsibility(),
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

function toggleTask(taskId: string, status: 'open' | 'done' | 'skipped') {
  if (!canEditTasks.value) {
    formError.value = t('meeting.roleCannotEditTasks');
    return;
  }

  meetingsStore.updateTaskStatus(taskId, status === 'open' ? 'done' : 'open');
}

function handleUnfinishedTasks(action: 'keep' | 'done' | 'skipped' | 'move') {
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
      action === 'done' ? t('meeting.markedDone') : t('meeting.skippedForNow');
  }

  if (action === 'move') {
    const movedTasks = tasksStore.moveOpenTasksToMeeting(
      previousMeeting.id,
      meeting.id
    );
    meetingsStore.addMovedTasksToMeeting(
      previousMeeting.id,
      meeting.id,
      movedTasks
    );
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
</script>

<template>
  <section
    v-if="activeMeeting && currentSection"
    :class="[
      'meeting-page',
      { 'meeting-page--check-in': isParticipantCheckInStep },
    ]"
  >
    <ActionMenuPopup
      v-model="isRitualMenuOpen"
      :items="ritualMenuItems"
      :aria-label="t('meeting.menu.label')"
      :close-label="t('common.close')"
      @select="handleRitualMenuSelect"
    />

    <template v-if="isParticipantCheckInStep">
      <header class="ritual-check-in__top-bar">
        <button
          class="ritual-check-in__icon material-symbols-outlined"
          type="button"
          :aria-label="t('meeting.closeMeeting')"
          @click="exitMeeting"
        >
          close
        </button>
        <h1>Weekly Ritual</h1>
        <button
          class="ritual-check-in__icon material-symbols-outlined"
          type="button"
          :aria-label="t('meeting.menu.open')"
          @click="isRitualMenuOpen = true"
        >
          more_vert
        </button>
      </header>

      <main class="ritual-check-in__content">
        <div
          class="ritual-progress"
          :aria-label="
            t('meeting.stepOf', {
              current: currentStepNumber,
              total: totalSteps,
            })
          "
        >
          <span>
            {{
              t('meeting.stepOf', {
                current: currentStepNumber,
                total: totalSteps,
              })
            }}
          </span>
          <div class="ritual-progress__track">
            <div
              class="ritual-progress__bar"
              :style="{ width: progressPercent }"
            />
          </div>
        </div>

        <header class="ritual-check-in__hero">
          <h2>Who's here?</h2>
          <p>Tap to check in members joining the ritual today.</p>
        </header>

        <div class="ritual-member-grid">
          <button
            v-for="participant in checkInParticipants"
            :key="participant.id"
            type="button"
            :class="[
              'ritual-member-card',
              { 'is-selected': participantIsCheckedIn(participant.id) },
            ]"
            :aria-pressed="participantIsCheckedIn(participant.id)"
            @click="toggleCheckInParticipant(participant.id)"
          >
            <span
              v-if="participantIsCheckedIn(participant.id)"
              class="ritual-member-card__check material-symbols-outlined"
              aria-hidden="true"
            >
              check_circle
            </span>
            <span
              class="ritual-member-card__avatar"
              :style="avatarStyle(participant)"
            >
              {{ participant.initials }}
            </span>
            <span class="ritual-member-card__name">
              {{ participant.name }}
            </span>
          </button>

          <button
            type="button"
            class="ritual-member-card ritual-member-card--add"
            :disabled="!canAddGuestParticipant || !canEditMeeting"
            @click="openGuestDrawer"
          >
            <span
              class="ritual-member-card__add-icon material-symbols-outlined"
              aria-hidden="true"
            >
              add
            </span>
            <span class="ritual-member-card__name">Add Guest</span>
          </button>
        </div>

        <BaseBottomSheet :open="isGuestDrawerOpen" @close="closeGuestDrawer">
          <div class="ritual-guest-drawer">
            <span class="ritual-guest-drawer__handle" aria-hidden="true" />
            <h2>Add to Session</h2>
            <section
              class="ritual-guest-drawer__section"
              aria-labelledby="existing-family-title"
            >
              <h3 id="existing-family-title" class="sr-only">
                Choose from family
              </h3>
              <div v-if="drawerFamilyMembers.length" class="ritual-guest-list">
                <button
                  v-for="participant in drawerFamilyMembers"
                  :key="participant.id"
                  type="button"
                  :class="[
                    'ritual-guest-list__item',
                    {
                      'is-selected': participantIsCheckedIn(participant.id),
                      'is-pending':
                        drawerSelectedParticipantId === participant.id,
                    },
                  ]"
                  :disabled="participantIsCheckedIn(participant.id)"
                  @click="selectDrawerParticipant(participant.id)"
                >
                  <span
                    class="ritual-guest-list__avatar"
                    :style="avatarStyle(participant)"
                  >
                    {{ participant.initials }}
                  </span>
                  <span>{{ participant.name }}</span>
                </button>
              </div>
              <p v-else class="ritual-guest-drawer__empty">
                Everyone active is already here.
              </p>
            </section>

            <section
              class="ritual-guest-drawer__section"
              aria-labelledby="guest-name-title"
            >
              <h3 id="guest-name-title">New Guest</h3>
              <form
                class="ritual-guest-form"
                @submit.prevent="addSelectedDrawerParticipant"
              >
                <label class="sr-only" for="guest-name">Guest name</label>
                <input
                  id="guest-name"
                  v-model="guestName"
                  type="text"
                  autocomplete="off"
                  placeholder="Enter name..."
                  @input="drawerSelectedParticipantId = ''"
                />
                <button
                  class="meeting-primary"
                  type="submit"
                  :disabled="!canSubmitGuestDrawer"
                >
                  Add to Ritual
                </button>
              </form>
            </section>
          </div>
        </BaseBottomSheet>

        <section class="ritual-mood-card" aria-labelledby="group-mood-title">
          <h3 id="group-mood-title">How is the group feeling?</h3>
          <div class="ritual-mood-options">
            <button
              v-for="mood in moodOptions"
              :key="mood.id"
              type="button"
              :class="[
                'ritual-mood-option',
                { 'is-selected': selectedMood === mood.id },
              ]"
              :aria-pressed="selectedMood === mood.id"
              @click="selectedMood = mood.id"
            >
              <span class="ritual-mood-option__emoji">
                {{ mood.emoji }}
              </span>
              <span>{{ mood.label }}</span>
            </button>
          </div>
        </section>
      </main>

      <footer class="ritual-check-in__actions">
        <button
          type="button"
          class="ritual-action ritual-action--back"
          @click="exitMeeting"
        >
          Back
        </button>
        <button
          type="button"
          class="ritual-action ritual-action--start"
          :disabled="!checkedInParticipantIds.length || !canEditMeeting"
          @click="startRitual"
        >
          Start Ritual
        </button>
      </footer>
    </template>

    <template v-else>
      <template v-if="isFinalSection">
        <article class="meeting-page--review-close">
          <header class="review-close-top-bar">
            <button
              class="review-close-icon material-symbols-outlined"
              type="button"
              :aria-label="t('meeting.closeMeeting')"
              @click="router.push({ name: 'home' })"
            >
              close
            </button>
            <h1>Review &amp; Close</h1>
            <button
              class="review-close-icon material-symbols-outlined"
              type="button"
              :aria-label="t('meeting.menu.open')"
              :disabled="isCompleted || !canEditMeeting"
              @click="isRitualMenuOpen = true"
            >
              more_vert
            </button>
          </header>

          <main class="review-close-content">
            <section
              class="review-close-progress"
              aria-label="Meeting Progress 100%"
            >
              <div class="review-close-progress__labels">
                <span>Meeting Progress</span>
                <strong>100%</strong>
              </div>
              <div class="review-close-progress__track">
                <div class="review-close-progress__bar" />
              </div>
            </section>

            <section
              class="review-close-hero"
              aria-labelledby="review-close-title"
            >
              <span
                class="review-close-hero__icon material-symbols-outlined"
                aria-hidden="true"
              >
                check_circle
              </span>
              <h2 id="review-close-title">Great Session!</h2>
              <p>
                You've covered all topics and set clear actions for the week
                ahead.
              </p>
            </section>

            <section
              class="review-close-card review-close-actions-card"
              aria-labelledby="review-close-actions-title"
            >
              <header class="review-close-card__header">
                <span
                  class="review-close-card__title-icon material-symbols-outlined"
                  aria-hidden="true"
                >
                  task_alt
                </span>
                <h3 id="review-close-actions-title">Agreed Actions</h3>
                <span class="review-close-badge">
                  {{ allTasks.length }} New
                </span>
              </header>

              <ul v-if="allTasks.length" class="review-close-action-list">
                <li v-for="task in allTasks" :key="task.id">
                  <button
                    type="button"
                    class="review-close-task-toggle"
                    :aria-label="
                      task.status === 'done'
                        ? `Mark ${task.title} open`
                        : `Mark ${task.title} done`
                    "
                    :disabled="!canEditTasks"
                    @click="toggleTask(task.id, task.status)"
                  >
                    <span class="material-symbols-outlined" aria-hidden="true">
                      {{
                        task.status === 'done'
                          ? 'check_circle'
                          : 'radio_button_unchecked'
                      }}
                    </span>
                  </button>
                  <span>{{ task.title }}</span>
                </li>
              </ul>
              <p v-else class="review-close-empty">No agreed actions yet.</p>

              <button
                type="button"
                class="review-close-edit"
                :disabled="!canEditMeeting"
                @click="editActions"
              >
                <span>Edit Actions</span>
                <span class="material-symbols-outlined" aria-hidden="true">
                  edit
                </span>
              </button>
            </section>

            <section class="review-close-stats" aria-label="Meeting summary">
              <article class="review-close-stat-card">
                <span
                  class="review-close-stat-card__icon review-close-stat-card__icon--heart material-symbols-outlined"
                  aria-hidden="true"
                >
                  favorite
                </span>
                <h3>Connection</h3>
                <p>Felt strong today</p>
              </article>
              <article class="review-close-stat-card">
                <span
                  class="review-close-stat-card__icon material-symbols-outlined"
                  aria-hidden="true"
                >
                  schedule
                </span>
                <h3>Time Spent</h3>
                <p>45 minutes</p>
              </article>
            </section>

            <section
              class="review-close-private-note"
              aria-labelledby="review-close-private-note-title"
            >
              <header>
                <span class="material-symbols-outlined" aria-hidden="true">
                  notes
                </span>
                <h3 id="review-close-private-note-title">Private Notes</h3>
              </header>
              <p v-if="latestPrivateMeetingNote">
                "{{ latestPrivateMeetingNote.content }}"
              </p>
              <p v-else>"No private note is linked to this meeting yet."</p>
            </section>

            <p v-if="!hasMeetingContent" class="meeting-help">
              {{ t('meeting.atLeastOne') }}
            </p>
            <p v-if="formError" class="meeting-error" role="alert">
              {{ formError }}
            </p>
            <p v-if="statusMessage" class="meeting-status" role="status">
              {{ statusMessage }}
            </p>
          </main>

          <footer class="review-close-bottom-actions">
            <button
              v-if="!isCompleted && canEditMeeting"
              class="review-close-finish"
              type="button"
              :disabled="isFinishingMeeting"
              @click="finishMeeting"
            >
              <span class="material-symbols-outlined" aria-hidden="true">
                done_all
              </span>
              <span>
                {{
                  isFinishingMeeting
                    ? `${t('common.finish')}...`
                    : t('common.finish')
                }}
              </span>
            </button>
            <button
              v-else-if="canCreateMeeting"
              class="review-close-finish"
              type="button"
              @click="startNewMeeting"
            >
              <span class="material-symbols-outlined" aria-hidden="true">
                add_circle
              </span>
              <span>{{ t('meeting.newMeeting') }}</span>
            </button>
            <button
              class="review-close-back"
              type="button"
              :disabled="!canEditMeeting"
              @click="goBack"
            >
              Go Back &amp; Edit
            </button>
          </footer>
        </article>
      </template>

      <template v-else>
        <header class="meeting-focus-bar">
          <button
            class="meeting-focus-bar__icon material-symbols-outlined"
            type="button"
            :aria-label="t('meeting.closeMeeting')"
            @click="router.push({ name: 'home' })"
          >
            close
          </button>
          <div class="meeting-focus-bar__progress">
            <span>{{
              t('meeting.stepOf', {
                current: currentStepNumber,
                total: totalSteps,
              })
            }}</span>
            <div class="meeting-progress__track">
              <div
                class="meeting-progress__bar"
                :style="{ width: progressPercent }"
              />
            </div>
          </div>
          <button
            v-if="!isCompleted && canEditMeeting"
            class="meeting-focus-bar__save"
            type="button"
            @click="saveDraft"
          >
            {{ t('common.save') }}
          </button>
          <span v-else />
        </header>

        <header class="meeting-header">
          <div
            v-if="activeMeetingParticipants.length"
            class="meeting-avatar-stack"
          >
            <span
              v-for="participant in activeMeetingParticipants.slice(0, 3)"
              :key="participant.id"
              :style="{ backgroundColor: participant.avatarColor }"
            >
              {{ participant.initials }}
            </span>
          </div>
          <div class="meeting-header__row">
            <div>
              <h1>
                {{ sectionTitle(currentSection.id, currentSection.title) }}
              </h1>
              <p class="meeting-prompt">
                {{ sectionPrompt(currentSection.id, currentSection.prompt) }}
              </p>
            </div>
          </div>
        </header>

        <section
          v-if="showTaskReview"
          class="meeting-panel meeting-review"
          aria-labelledby="task-review-title"
        >
          <div>
            <p class="meeting-review__eyebrow">
              {{
                t('meeting.fromMeeting', {
                  title: previousCompletedMeeting
                    ? getMeetingTemplateName(
                        previousCompletedMeeting.templateId,
                        previousCompletedMeeting.title
                      )
                    : '',
                  date: formatMeetingDate(
                    previousCompletedMeeting?.completedAt ??
                      previousCompletedMeeting?.updatedAt
                  ),
                })
              }}
            </p>
            <h2 id="task-review-title">{{ t('meeting.unfinishedTitle') }}</h2>
          </div>

          <ul class="meeting-list meeting-review__list">
            <li v-for="task in previousUnfinishedTasks" :key="task.id">
              <div>
                <span>
                  {{
                    getResponsibilityLabel(
                      task.responsibilityType,
                      task.responsibleParticipantIds
                    )
                  }}
                </span>
                <p>{{ task.title }}</p>
                <small v-if="task.dueDate">{{
                  t('meeting.stillRelevant', { date: task.dueDate })
                }}</small>
              </div>
            </li>
          </ul>

          <div
            v-if="canEditTasks"
            class="meeting-review__actions"
            :aria-label="t('meeting.unfinishedChoices')"
          >
            <button type="button" @click="handleUnfinishedTasks('keep')">
              {{ t('meeting.keep') }}
            </button>
            <button type="button" @click="handleUnfinishedTasks('done')">
              {{ t('meeting.markDone') }}
            </button>
            <button type="button" @click="handleUnfinishedTasks('skipped')">
              {{ t('meeting.skip') }}
            </button>
            <button
              type="button"
              class="meeting-primary"
              @click="handleUnfinishedTasks('move')"
            >
              {{ t('meeting.moveToThisWeek') }}
            </button>
          </div>
        </section>

        <section
          v-if="showNotes"
          class="meeting-panel"
          aria-labelledby="meeting-notes-title"
        >
          <h2 id="meeting-notes-title" class="meeting-panel-title">
            <span
              class="meeting-panel-title__icon meeting-panel-title__icon--notes material-symbols-outlined"
              aria-hidden="true"
            >
              edit_note
            </span>
            <span>{{ t('meeting.notes') }}</span>
          </h2>
          <label class="meeting-label" for="note-person">
            {{ t('meeting.author') }}
          </label>
          <select
            id="note-person"
            v-model="selectedParticipantId"
            :disabled="!canEditMeeting"
          >
            <option
              v-for="participant in activeMeetingParticipants"
              :key="participant.id"
              :value="participant.id"
            >
              {{ participant.name }}
            </option>
          </select>

          <label class="meeting-label" for="meeting-note">
            {{ t('meeting.note') }}
          </label>
          <textarea
            id="meeting-note"
            v-model="noteText"
            rows="4"
            :placeholder="notePlaceholder(currentSection.id)"
            :disabled="!canEditMeeting"
          />
          <p v-if="neutralHint" class="meeting-help">{{ neutralHint }}</p>
          <button
            v-if="canEditMeeting"
            class="meeting-primary"
            type="button"
            @click="addNote"
          >
            {{ t('meeting.addNote') }}
          </button>

          <ul v-if="currentSection.notes.length" class="meeting-list">
            <li v-for="note in currentSection.notes" :key="note.id">
              <span>{{ getParticipantName(note.participantId) }}</span>
              <p>{{ note.text }}</p>
            </li>
          </ul>
          <p v-else class="meeting-empty">{{ t('meeting.noNotesYet') }}</p>
        </section>

        <section
          v-if="canAddTasks"
          class="meeting-panel"
          aria-labelledby="meeting-tasks-title"
        >
          <h2 id="meeting-tasks-title" class="meeting-panel-title">
            <span
              class="meeting-panel-title__icon meeting-panel-title__icon--tasks material-symbols-outlined"
              aria-hidden="true"
            >
              task_alt
            </span>
            <span>{{ t('meeting.tasks') }}</span>
          </h2>
          <template v-if="canCreateTasks">
            <label class="meeting-label" for="task-title">
              {{ t('meeting.taskTitle') }}
            </label>
            <input
              id="task-title"
              v-model="taskDraft.title"
              type="text"
              :placeholder="t('meeting.taskTitlePlaceholder')"
            />

            <label class="meeting-label" for="task-description">{{
              t('meeting.optionalDetail')
            }}</label>
            <textarea
              id="task-description"
              v-model="taskDraft.description"
              rows="3"
              :placeholder="t('meeting.taskDetailPlaceholder')"
            />

            <label class="meeting-label" for="task-person">
              {{ t('meeting.responsible') }}
            </label>
            <select id="task-person" v-model="taskDraft.responsibilityChoice">
              <option value="needsDiscussion">
                {{ t('meeting.needsDiscussion') }}
              </option>
              <option value="shared">{{ t('meeting.shared') }}</option>
              <option
                v-for="participant in activeMeetingParticipants"
                :key="participant.id"
                :value="participant.id"
              >
                {{ participant.name }}
              </option>
            </select>

            <label class="meeting-label" for="task-due-date">
              {{ t('meeting.dueDate') }}
            </label>
            <input id="task-due-date" v-model="taskDraft.dueDate" type="date" />
            <button class="meeting-primary" type="button" @click="addTask">
              {{ t('meeting.addTask') }}
            </button>
          </template>

          <ul
            v-if="currentSection.tasks.length"
            class="meeting-list meeting-task-list"
          >
            <li v-for="task in currentSection.tasks" :key="task.id">
              <div>
                <span>
                  {{
                    getResponsibilityLabel(
                      task.responsibilityType,
                      task.responsibleParticipantIds
                    )
                  }}
                </span>
                <p>{{ task.title }}</p>
                <small v-if="task.description">{{ task.description }}</small>
                <small v-if="task.dueDate">
                  {{ t('common.due') }} {{ task.dueDate }}
                </small>
              </div>
              <button
                v-if="canEditTasks"
                type="button"
                @click="toggleTask(task.id, task.status)"
              >
                {{
                  task.status === 'done' ? t('common.done') : t('common.open')
                }}
              </button>
            </li>
          </ul>
          <p v-else class="meeting-empty">{{ t('meeting.noTasksYet') }}</p>
        </section>

        <section
          v-if="canAddAgreements"
          class="meeting-panel"
          aria-labelledby="meeting-agreements-title"
        >
          <h2 id="meeting-agreements-title" class="meeting-panel-title">
            <span
              class="meeting-panel-title__icon meeting-panel-title__icon--agreements material-symbols-outlined"
              aria-hidden="true"
            >
              handshake
            </span>
            <span>{{ t('meeting.agreements') }}</span>
          </h2>
          <label class="meeting-label" for="agreement-text">{{
            t('meeting.decisionOrAgreement')
          }}</label>
          <textarea
            id="agreement-text"
            v-model="agreementText"
            rows="3"
            :placeholder="t('meeting.agreementPlaceholder')"
            :disabled="!canEditMeeting"
          />
          <fieldset class="participant-selector">
            <legend>{{ t('meeting.participants') }}</legend>
            <label
              v-for="participant in activeMeetingParticipants"
              :key="participant.id"
            >
              <input
                v-model="agreementParticipantIds"
                type="checkbox"
                :value="participant.id"
                :disabled="!canEditMeeting"
              />
              <span>{{ participant.name }}</span>
            </label>
          </fieldset>
          <button
            v-if="canEditMeeting"
            class="meeting-primary"
            type="button"
            @click="addAgreement"
          >
            {{ t('meeting.addAgreement') }}
          </button>

          <ul v-if="currentSection.agreements.length" class="meeting-list">
            <li
              v-for="agreement in currentSection.agreements"
              :key="agreement.id"
            >
              <span>{{
                agreement.participantIds.map(getParticipantName).join(', ')
              }}</span>
              <p>{{ agreement.text }}</p>
            </li>
          </ul>
          <p v-else class="meeting-empty">{{ t('meeting.noAgreementsYet') }}</p>
        </section>

        <p v-if="formError" class="meeting-error" role="alert">
          {{ formError }}
        </p>
        <p v-if="statusMessage" class="meeting-status" role="status">
          {{ statusMessage }}
        </p>

        <footer class="meeting-actions">
          <button
            type="button"
            :disabled="!isFirstStep && !canEditMeeting"
            @click="isFirstStep ? exitMeeting() : goBack()"
          >
            {{ isFirstStep ? t('common.exit') : t('common.back') }}
          </button>
          <button
            v-if="!isCompleted && canEditMeeting"
            type="button"
            @click="saveDraft"
          >
            {{ t('meeting.saveDraft') }}
          </button>
          <button
            v-if="!isFinalSection && !isCompleted && canEditMeeting"
            class="meeting-primary"
            type="button"
            @click="goNext"
          >
            {{ t('common.next') }}
          </button>
          <button
            v-else-if="!isCompleted && canEditMeeting"
            class="meeting-primary"
            type="button"
            :disabled="isFinishingMeeting"
            @click="finishMeeting"
          >
            {{
              isFinishingMeeting
                ? `${t('common.finish')}...`
                : t('common.finish')
            }}
          </button>
          <button
            v-else-if="canCreateMeeting"
            class="meeting-primary"
            type="button"
            @click="startNewMeeting"
          >
            {{ t('meeting.newMeeting') }}
          </button>
        </footer>
      </template>
    </template>
  </section>
  <section v-else class="page-stack">
    <div>
      <p class="page-kicker">{{ t('meeting.weeklyMeeting') }}</p>
      <h1>{{ t('meeting.readOnlyTitle') }}</h1>
      <p class="page-copy">{{ t('meeting.readOnlyText') }}</p>
    </div>
    <RouterLink class="secondary-button link-button" :to="{ name: 'history' }">
      {{ t('meeting.viewHistory') }}
    </RouterLink>
  </section>
  <ConfirmationDialog
    :open="isEndSessionDialogOpen"
    :title="t('meeting.confirmEndSessionTitle')"
    :message="t('meeting.confirmEndSessionText')"
    :confirm-label="t('common.finish')"
    @close="isEndSessionDialogOpen = false"
    @confirm="confirmEndSessionIncomplete"
  />
  <ConfirmationDialog
    :open="isDeleteRitualDialogOpen"
    :title="t('meeting.confirmDeleteRitualTitle')"
    :message="t('meeting.confirmDeleteRitualText')"
    :confirm-label="t('common.delete')"
    destructive
    @close="isDeleteRitualDialogOpen = false"
    @confirm="confirmDeleteRitual"
  />
</template>
