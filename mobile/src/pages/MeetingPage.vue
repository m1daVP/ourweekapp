<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
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
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';

const meetingsStore = useMeetingsStore();
const { t, locale } = useI18n();
const participantsStore = useParticipantsStore();
const tasksStore = useTasksStore();
const router = useRouter();
const { can } = useWorkspacePermissions();

const noteText = ref('');
const agreementText = ref('');
const participantName = ref('');
const selectedParticipantId = ref('');
const agreementParticipantIds = ref<string[]>([]);
const formError = ref('');
const statusMessage = ref('');

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
const currentSection = computed(() => {
  const meeting = activeMeeting.value;
  return meeting?.sections[meeting.currentSectionIndex] ?? null;
});
const currentStepNumber = computed(
  () => (activeMeeting.value?.currentSectionIndex ?? 0) + 1
);
const totalSteps = computed(() => activeMeeting.value?.sections.length ?? 0);
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
const isCompleted = computed(() => activeMeeting.value?.status === 'completed');
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
});

watch(
  () =>
    participantsStore.activeParticipants.map((participant) => participant.id),
  () => {
    meetingsStore.syncActiveMeetingParticipants();
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
    resetTaskForm();
  }
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

function addParticipant() {
  clearMessages();

  if (!canEditMeeting.value) {
    formError.value = t('meeting.roleCannotEditMeetings');
    return;
  }

  const participant = participantsStore.createParticipant({
    name: participantName.value,
    type: 'adult',
  });

  if (!participant) {
    formError.value = t('meeting.addNameFirst');
    return;
  }

  meetingsStore.syncActiveMeetingParticipants();
  selectedParticipantId.value = participant.id;
  participantName.value = '';
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

  meetingsStore.setCurrentSection(meeting.currentSectionIndex - 1);
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

function saveDraft() {
  clearMessages();

  if (!canEditMeeting.value) {
    formError.value = t('meeting.roleCannotEditMeetings');
    return;
  }

  meetingsStore.saveDraft();
  statusMessage.value = t('meeting.draftSaved');
}

function finishMeeting() {
  clearMessages();

  if (!canEditMeeting.value) {
    formError.value = t('meeting.roleCannotEditMeetings');
    return;
  }

  const error = meetingsStore.finishMeeting();

  if (error) {
    formError.value = error;
    return;
  }

  statusMessage.value = t('meeting.meetingFinished');
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
  <section v-if="activeMeeting && currentSection" class="meeting-page">
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
      <div v-if="activeMeetingParticipants.length" class="meeting-avatar-stack">
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
          <h1>{{ sectionTitle(currentSection.id, currentSection.title) }}</h1>
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
      class="meeting-panel meeting-people"
      aria-labelledby="meeting-people-title"
    >
      <h2 id="meeting-people-title">{{ t('meeting.peopleHere') }}</h2>
      <div class="meeting-chip-row">
        <span
          v-for="participant in meetingParticipants"
          :key="participant.id"
          :class="['meeting-chip', { 'is-disabled': !participant.isActive }]"
        >
          <span
            class="participant-avatar"
            :style="{ backgroundColor: participant.avatarColor }"
          >
            {{ participant.initials }}
          </span>
          {{ participant.name }}
        </span>
      </div>
      <form
        v-if="canEditMeeting"
        class="meeting-inline-form"
        @submit.prevent="addParticipant"
      >
        <label class="sr-only" for="participant-name">
          {{ t('meeting.addPerson') }}
        </label>
        <input
          id="participant-name"
          v-model="participantName"
          type="text"
          :placeholder="t('meeting.addPerson')"
        />
        <button type="submit">{{ t('common.add') }}</button>
      </form>
    </section>

    <section
      v-if="showNotes"
      class="meeting-panel"
      aria-labelledby="meeting-notes-title"
    >
      <h2 id="meeting-notes-title">{{ t('meeting.notes') }}</h2>
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
      <h2 id="meeting-tasks-title">{{ t('meeting.tasks') }}</h2>
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
            {{ task.status === 'done' ? t('common.done') : t('common.open') }}
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
      <h2 id="meeting-agreements-title">{{ t('meeting.agreements') }}</h2>
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
        <li v-for="agreement in currentSection.agreements" :key="agreement.id">
          <span>{{
            agreement.participantIds.map(getParticipantName).join(', ')
          }}</span>
          <p>{{ agreement.text }}</p>
        </li>
      </ul>
      <p v-else class="meeting-empty">{{ t('meeting.noAgreementsYet') }}</p>
    </section>

    <section
      v-if="isFinalSection"
      class="meeting-panel meeting-summary"
      aria-labelledby="meeting-summary-title"
    >
      <h2 id="meeting-summary-title">{{ t('meeting.reviewTogether') }}</h2>
      <p class="meeting-summary__intro">
        {{ t('meeting.reviewIntro') }}
      </p>

      <div class="meeting-summary__group">
        <h3>{{ t('meeting.agreements') }}</h3>
        <ul v-if="allAgreements.length" class="meeting-list">
          <li v-for="agreement in allAgreements" :key="agreement.id">
            <span
              >{{ agreement.sectionTitle }} -
              {{ agreement.participantLabel }}</span
            >
            <p>{{ agreement.text }}</p>
          </li>
        </ul>
        <p v-else class="meeting-empty">{{ t('meeting.noAgreementsYet') }}</p>
      </div>

      <div class="meeting-summary__group">
        <h3>{{ t('meeting.tasksAndResponsibilities') }}</h3>
        <ul v-if="allTasks.length" class="meeting-list meeting-task-list">
          <li v-for="task in allTasks" :key="task.id">
            <div>
              <span>{{ task.responsibilityLabel }}</span>
              <p>{{ task.title }}</p>
              <small>{{ task.sectionTitle }}</small>
              <small v-if="task.dueDate">
                {{ t('common.due') }} {{ task.dueDate }}
              </small>
            </div>
            <button
              v-if="canEditTasks"
              type="button"
              @click="toggleTask(task.id, task.status)"
            >
              {{ task.status === 'done' ? t('common.done') : t('common.open') }}
            </button>
          </li>
        </ul>
        <p v-else class="meeting-empty">{{ t('meeting.noTasksYet') }}</p>
      </div>

      <div class="meeting-summary__group">
        <h3>{{ t('meeting.notes') }}</h3>
        <ul v-if="allNotes.length" class="meeting-list">
          <li v-for="note in allNotes" :key="note.id">
            <span>{{ note.sectionTitle }} - {{ note.participantName }}</span>
            <p>{{ note.text }}</p>
          </li>
        </ul>
        <p v-else class="meeting-empty">{{ t('meeting.noNotesYet') }}</p>
      </div>

      <p v-if="!hasMeetingContent" class="meeting-help">
        {{ t('meeting.atLeastOne') }}
      </p>
      <p v-if="isCompleted" class="meeting-complete">
        {{ t('meeting.finished') }}
      </p>
    </section>

    <p v-if="formError" class="meeting-error" role="alert">{{ formError }}</p>
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
        @click="finishMeeting"
      >
        {{ t('common.finish') }}
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
</template>
