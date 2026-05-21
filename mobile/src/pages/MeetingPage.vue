<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
import type { MeetingSectionId } from '@/features/meeting/types';
import type { Participant } from '@/features/participants/types';
import type { TaskResponsibilityType } from '@/features/tasks/types';
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';

const meetingsStore = useMeetingsStore();
const participantsStore = useParticipantsStore();
const tasksStore = useTasksStore();
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
const progressPercent = computed(() =>
  totalSteps.value > 0
    ? `${(currentStepNumber.value / totalSteps.value) * 100}%`
    : '0%'
);
const isFinalSection = computed(
  () => currentSection.value?.id === 'finalAgreements'
);
const canAddTasks = computed(() =>
  currentSection.value
    ? ['tasks', 'familyCare'].includes(currentSection.value.id)
    : false
);
const canAddAgreements = computed(() =>
  currentSection.value
    ? ['money', 'finalAgreements'].includes(currentSection.value.id)
    : false
);
const showNotes = computed(
  () => currentSection.value?.id !== 'finalAgreements'
);
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
          sectionTitle: section.title,
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
          sectionTitle: section.title,
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
          sectionTitle: section.title,
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
    ? 'Try naming what happened and what would help, without labels or blame.'
    : '';
});

onMounted(() => {
  participantsStore.ensureDefaultParticipants();
  tasksStore.syncFromMeetings(meetingsStore.meetings);

  if (!canCreateMeeting.value && !meetingsStore.activeMeeting) {
    return;
  }

  const meeting = meetingsStore.ensureActiveMeeting();
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
    'Former participant'
  );
}

function getResponsibilityLabel(
  responsibilityType: TaskResponsibilityType,
  participantIds: string[]
) {
  if (responsibilityType === 'shared') {
    return 'Shared';
  }

  if (responsibilityType === 'needsDiscussion') {
    return 'Needs discussion';
  }

  return (
    participantIds.map(getParticipantName).join(', ') || 'Former participant'
  );
}

function formatMeetingDate(value?: string) {
  if (!value) {
    return 'Recent meeting';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function notePlaceholder(sectionId: MeetingSectionId) {
  const placeholders: Record<MeetingSectionId, string> = {
    goodThings: 'One thing I appreciated was...',
    tensions: 'I noticed this felt hard because...',
    tasks: 'A useful detail for this week is...',
    money: 'Something to buy or decide about money is...',
    familyCare: 'A family care note to remember is...',
    plans: 'Something coming up next week is...',
    finalAgreements: 'A decision we want to keep is...',
  };

  return placeholders[sectionId];
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
    formError.value = 'This workspace role can view meetings but cannot edit.';
    return;
  }

  const participant = participantsStore.createParticipant({
    name: participantName.value,
    type: 'adult',
  });

  if (!participant) {
    formError.value = 'Add a name first.';
    return;
  }

  meetingsStore.syncActiveMeetingParticipants();
  selectedParticipantId.value = participant.id;
  participantName.value = '';
  statusMessage.value = 'Person added.';
}

function addNote() {
  const section = currentSection.value;

  if (!section) {
    return;
  }

  clearMessages();

  if (!canEditMeeting.value) {
    formError.value = 'This workspace role can view meetings but cannot edit.';
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
  statusMessage.value = 'Note added.';
}

function addTask() {
  const section = currentSection.value;

  if (!section) {
    return;
  }

  clearMessages();

  if (!canCreateTasks.value) {
    formError.value = 'This workspace role can view tasks but cannot edit.';
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
  statusMessage.value = 'Task added.';
}

function addAgreement() {
  const section = currentSection.value;

  if (!section) {
    return;
  }

  clearMessages();

  if (!canEditMeeting.value) {
    formError.value =
      'This workspace role can view agreements but cannot edit.';
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
  statusMessage.value = 'Agreement added.';
}

function toggleTask(taskId: string, status: 'open' | 'done' | 'skipped') {
  if (!canEditTasks.value) {
    formError.value = 'This workspace role can view tasks but cannot edit.';
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
    formError.value = 'This workspace role can view tasks but cannot edit.';
    return;
  }

  if (action === 'keep') {
    statusMessage.value = 'Kept for now.';
  }

  if (action === 'done' || action === 'skipped') {
    tasksStore.updateTasksFromMeeting(previousMeeting.id, action);
    meetingsStore.updateTasksFromMeeting(previousMeeting.id, action);
    statusMessage.value =
      action === 'done' ? 'Marked as done.' : 'Skipped for now.';
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
    statusMessage.value = 'Moved to this week.';
  }

  tasksStore.markReviewHandled(meeting.id, previousMeeting.id);
}

function goBack() {
  const meeting = activeMeeting.value;

  if (!meeting || !canEditMeeting.value) {
    return;
  }

  meetingsStore.setCurrentSection(meeting.currentSectionIndex - 1);
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
    formError.value = 'This workspace role can view meetings but cannot edit.';
    return;
  }

  meetingsStore.saveDraft();
  statusMessage.value = 'Draft saved on this phone.';
}

function finishMeeting() {
  clearMessages();

  if (!canEditMeeting.value) {
    formError.value = 'This workspace role can view meetings but cannot edit.';
    return;
  }

  const error = meetingsStore.finishMeeting();

  if (error) {
    formError.value = error;
    return;
  }

  statusMessage.value = 'Meeting finished.';
}

function startNewMeeting() {
  if (!canCreateMeeting.value) {
    formError.value = 'This workspace role can view meetings but cannot edit.';
    return;
  }

  const meeting = meetingsStore.startNewMeeting();
  tasksStore.syncFromMeetings(meetingsStore.meetings);
  selectedParticipantId.value = firstActiveParticipantId();
  agreementParticipantIds.value = [...meeting.participantIds];
  resetTaskForm();
  clearMessages();
}
</script>

<template>
  <section v-if="activeMeeting && currentSection" class="meeting-page">
    <header class="meeting-header">
      <p class="page-kicker">Weekly Meeting</p>
      <div class="meeting-header__row">
        <div>
          <h1>{{ currentSection.title }}</h1>
          <p class="meeting-prompt">{{ currentSection.prompt }}</p>
        </div>
        <button
          v-if="!isCompleted && canEditMeeting"
          class="meeting-save"
          type="button"
          @click="saveDraft"
        >
          Save draft
        </button>
      </div>

      <div class="meeting-progress" aria-label="Meeting progress">
        <div class="meeting-progress__label">
          <span>Step {{ currentStepNumber }} of {{ totalSteps }}</span>
          <span>{{ Math.round((currentStepNumber / totalSteps) * 100) }}%</span>
        </div>
        <div class="meeting-progress__track">
          <div
            class="meeting-progress__bar"
            :style="{ width: progressPercent }"
          />
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
          From {{ previousCompletedMeeting?.title }} -
          {{
            formatMeetingDate(
              previousCompletedMeeting?.completedAt ??
                previousCompletedMeeting?.updatedAt
            )
          }}
        </p>
        <h2 id="task-review-title">What should we do with unfinished tasks?</h2>
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
            <small v-if="task.dueDate"
              >Still relevant? {{ task.dueDate }}</small
            >
          </div>
        </li>
      </ul>

      <div
        v-if="canEditTasks"
        class="meeting-review__actions"
        aria-label="Unfinished task choices"
      >
        <button type="button" @click="handleUnfinishedTasks('keep')">
          Keep
        </button>
        <button type="button" @click="handleUnfinishedTasks('done')">
          Mark done
        </button>
        <button type="button" @click="handleUnfinishedTasks('skipped')">
          Skip
        </button>
        <button
          type="button"
          class="meeting-primary"
          @click="handleUnfinishedTasks('move')"
        >
          Move to this week
        </button>
      </div>
    </section>

    <section
      class="meeting-panel meeting-people"
      aria-labelledby="meeting-people-title"
    >
      <h2 id="meeting-people-title">People here</h2>
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
        <label class="sr-only" for="participant-name">Add person</label>
        <input
          id="participant-name"
          v-model="participantName"
          type="text"
          placeholder="Add person"
        />
        <button type="submit">Add</button>
      </form>
    </section>

    <section
      v-if="showNotes"
      class="meeting-panel"
      aria-labelledby="meeting-notes-title"
    >
      <h2 id="meeting-notes-title">Notes</h2>
      <label class="meeting-label" for="note-person">Author</label>
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

      <label class="meeting-label" for="meeting-note">Note</label>
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
        Add note
      </button>

      <ul v-if="currentSection.notes.length" class="meeting-list">
        <li v-for="note in currentSection.notes" :key="note.id">
          <span>{{ getParticipantName(note.participantId) }}</span>
          <p>{{ note.text }}</p>
        </li>
      </ul>
      <p v-else class="meeting-empty">No notes yet.</p>
    </section>

    <section
      v-if="canAddTasks"
      class="meeting-panel"
      aria-labelledby="meeting-tasks-title"
    >
      <h2 id="meeting-tasks-title">Tasks</h2>
      <template v-if="canCreateTasks">
        <label class="meeting-label" for="task-title">Task title</label>
        <input
          id="task-title"
          v-model="taskDraft.title"
          type="text"
          placeholder="What needs care?"
        />

        <label class="meeting-label" for="task-description"
          >Optional detail</label
        >
        <textarea
          id="task-description"
          v-model="taskDraft.description"
          rows="3"
          placeholder="Anything that would make this easier?"
        />

        <label class="meeting-label" for="task-person">Responsible</label>
        <select id="task-person" v-model="taskDraft.responsibilityChoice">
          <option value="needsDiscussion">Needs discussion</option>
          <option value="shared">Shared</option>
          <option
            v-for="participant in activeMeetingParticipants"
            :key="participant.id"
            :value="participant.id"
          >
            {{ participant.name }}
          </option>
        </select>

        <label class="meeting-label" for="task-due-date">Due date</label>
        <input id="task-due-date" v-model="taskDraft.dueDate" type="date" />
        <button class="meeting-primary" type="button" @click="addTask">
          Add task
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
            <small v-if="task.dueDate">Due {{ task.dueDate }}</small>
          </div>
          <button
            v-if="canEditTasks"
            type="button"
            @click="toggleTask(task.id, task.status)"
          >
            {{ task.status === 'done' ? 'Done' : 'Open' }}
          </button>
        </li>
      </ul>
      <p v-else class="meeting-empty">No tasks yet.</p>
    </section>

    <section
      v-if="canAddAgreements"
      class="meeting-panel"
      aria-labelledby="meeting-agreements-title"
    >
      <h2 id="meeting-agreements-title">Agreements</h2>
      <label class="meeting-label" for="agreement-text"
        >Decision or agreement</label
      >
      <textarea
        id="agreement-text"
        v-model="agreementText"
        rows="3"
        placeholder="What did we agree to?"
        :disabled="!canEditMeeting"
      />
      <fieldset class="participant-selector">
        <legend>Participants</legend>
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
        Add agreement
      </button>

      <ul v-if="currentSection.agreements.length" class="meeting-list">
        <li v-for="agreement in currentSection.agreements" :key="agreement.id">
          <span>{{
            agreement.participantIds.map(getParticipantName).join(', ')
          }}</span>
          <p>{{ agreement.text }}</p>
        </li>
      </ul>
      <p v-else class="meeting-empty">No agreements yet.</p>
    </section>

    <section
      v-if="isFinalSection"
      class="meeting-panel meeting-summary"
      aria-labelledby="meeting-summary-title"
    >
      <h2 id="meeting-summary-title">Review together</h2>
      <p class="meeting-summary__intro">
        Look over the notes, tasks, and agreements before finishing.
      </p>

      <div class="meeting-summary__group">
        <h3>Agreements</h3>
        <ul v-if="allAgreements.length" class="meeting-list">
          <li v-for="agreement in allAgreements" :key="agreement.id">
            <span
              >{{ agreement.sectionTitle }} -
              {{ agreement.participantLabel }}</span
            >
            <p>{{ agreement.text }}</p>
          </li>
        </ul>
        <p v-else class="meeting-empty">No agreements yet.</p>
      </div>

      <div class="meeting-summary__group">
        <h3>Tasks and responsibilities</h3>
        <ul v-if="allTasks.length" class="meeting-list meeting-task-list">
          <li v-for="task in allTasks" :key="task.id">
            <div>
              <span>{{ task.responsibilityLabel }}</span>
              <p>{{ task.title }}</p>
              <small>{{ task.sectionTitle }}</small>
              <small v-if="task.dueDate">Due {{ task.dueDate }}</small>
            </div>
            <button
              v-if="canEditTasks"
              type="button"
              @click="toggleTask(task.id, task.status)"
            >
              {{ task.status === 'done' ? 'Done' : 'Open' }}
            </button>
          </li>
        </ul>
        <p v-else class="meeting-empty">No tasks yet.</p>
      </div>

      <div class="meeting-summary__group">
        <h3>Notes</h3>
        <ul v-if="allNotes.length" class="meeting-list">
          <li v-for="note in allNotes" :key="note.id">
            <span>{{ note.sectionTitle }} - {{ note.participantName }}</span>
            <p>{{ note.text }}</p>
          </li>
        </ul>
        <p v-else class="meeting-empty">No notes yet.</p>
      </div>

      <p v-if="!hasMeetingContent" class="meeting-help">
        Add at least one note, task, or agreement before finishing.
      </p>
      <p v-if="isCompleted" class="meeting-complete">
        This meeting is finished.
      </p>
    </section>

    <p v-if="formError" class="meeting-error" role="alert">{{ formError }}</p>
    <p v-if="statusMessage" class="meeting-status" role="status">
      {{ statusMessage }}
    </p>

    <footer class="meeting-actions">
      <button
        type="button"
        :disabled="currentStepNumber === 1 || !canEditMeeting"
        @click="goBack"
      >
        Back
      </button>
      <button
        v-if="!isCompleted && canEditMeeting"
        type="button"
        @click="saveDraft"
      >
        Save draft
      </button>
      <button
        v-if="!isFinalSection && !isCompleted && canEditMeeting"
        class="meeting-primary"
        type="button"
        @click="goNext"
      >
        Next
      </button>
      <button
        v-else-if="!isCompleted && canEditMeeting"
        class="meeting-primary"
        type="button"
        @click="finishMeeting"
      >
        Finish
      </button>
      <button
        v-else-if="canCreateMeeting"
        class="meeting-primary"
        type="button"
        @click="startNewMeeting"
      >
        New meeting
      </button>
    </footer>
  </section>
  <section v-else class="page-stack">
    <div>
      <p class="page-kicker">Weekly Meeting</p>
      <h1>Read-only access</h1>
      <p class="page-copy">
        Viewers can see shared summaries and tasks, but cannot start or edit a
        weekly meeting.
      </p>
    </div>
    <RouterLink class="secondary-button link-button" :to="{ name: 'history' }">
      View history
    </RouterLink>
  </section>
</template>
