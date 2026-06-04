<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
import type { Participant } from '@/features/participants/types';
import type {
  Task,
  TaskResponsibilityType,
  TaskStatus,
} from '@/features/tasks/types';
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';

type TaskFilter = 'todo' | 'done' | 'all';
type TaskCardTone = 'default' | 'danger';
type TaskCardGroup = 'shared' | 'mine';

interface TaskCardView {
  id: string;
  title: string;
  metadataIcon: string;
  metadataText: string;
  metadataTone: TaskCardTone;
  participants: Participant[];
  accessory: 'avatars' | 'badge' | 'none';
  badgeCount?: number;
  group: TaskCardGroup;
  task?: Task;
}

const meetingsStore = useMeetingsStore();
const participantsStore = useParticipantsStore();
const tasksStore = useTasksStore();
const { can } = useWorkspacePermissions();
const { t, locale } = useI18n();

const taskFilters: Array<{ value: TaskFilter; label: string }> = [
  { value: 'todo', label: 'To Do' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
];

const editDrafts = reactive<
  Record<
    string,
    { title: string; dueDate: string; responsibilityChoice: string }
  >
>({});
const newTaskDraft = reactive({
  title: '',
  dueDate: '',
  responsibilityChoice: 'needsDiscussion',
});
const selectedFilter = ref<TaskFilter>('todo');
const selectedTask = ref<Task | null>(null);
const isAddTaskSheetOpen = ref(false);
const statusMessage = ref('');

const openTasks = computed(() => tasksStore.openTasks);
const doneTasks = computed(() => tasksStore.doneTasks);
const skippedTasks = computed(() => tasksStore.skippedTasks);
const activeParticipants = computed(() => participantsStore.activeParticipants);
const firstParticipant = computed(() => activeParticipants.value[0] ?? null);
const canEditTasks = computed(() => can('editTasks'));
const canDeleteTasks = computed(() => can('deleteTasks'));
const taskFilterCounts = computed<Record<TaskFilter, number>>(() => ({
  todo: openTasks.value.length,
  done: doneTasks.value.length,
  all: tasksStore.tasks.length,
}));

const filteredTasks = computed(() => {
  if (selectedFilter.value === 'todo') {
    return openTasks.value;
  }

  if (selectedFilter.value === 'done') {
    return doneTasks.value;
  }

  return [...openTasks.value, ...doneTasks.value, ...skippedTasks.value];
});

const taskCards = computed(() => filteredTasks.value.map(createTaskCard));
const sharedTaskCards = computed(() =>
  taskCards.value.filter((card) => card.group === 'shared')
);
const myTaskCards = computed(() =>
  taskCards.value.filter((card) => card.group === 'mine')
);
const selectedTaskDraft = computed(() =>
  selectedTask.value ? editDrafts[selectedTask.value.id] : null
);
const emptyTaskMessage = computed(() => {
  if (selectedFilter.value === 'done') {
    return t('tasksPage.nothingDone');
  }

  if (selectedFilter.value === 'all' && tasksStore.tasks.length === 0) {
    return t('tasksPage.noOpenTasks');
  }

  return t('tasksPage.noOpenTasks');
});

onMounted(() => {
  participantsStore.ensureDefaultParticipants();
  tasksStore.syncFromMeetings(meetingsStore.meetings);
  newTaskDraft.responsibilityChoice = firstParticipant.value?.id ?? 'shared';
});

watch(
  () =>
    tasksStore.tasks.map((task) => `${task.id}:${task.updatedAt}`).join('|'),
  () => syncDrafts(),
  { immediate: true }
);

function syncDrafts() {
  const taskIds = new Set(tasksStore.tasks.map((task) => task.id));

  for (const task of tasksStore.tasks) {
    if (!editDrafts[task.id]) {
      editDrafts[task.id] = {
        title: task.title,
        dueDate: task.dueDate ?? '',
        responsibilityChoice: getResponsibilityChoice(task),
      };
    }
  }

  for (const taskId of Object.keys(editDrafts)) {
    if (!taskIds.has(taskId)) {
      delete editDrafts[taskId];
    }
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

function getResponsibilityChoice(task: Task) {
  if (task.responsibilityType === 'shared') {
    return 'shared';
  }

  if (task.responsibilityType === 'needsDiscussion') {
    return 'needsDiscussion';
  }

  return task.responsibleParticipantIds[0] ?? 'needsDiscussion';
}

function getTaskParticipants(task: Task) {
  const participantsById = new Map<string, Participant>();

  for (const participantId of task.responsibleParticipantIds) {
    const participant = participantsStore.getParticipantById(participantId);

    if (participant) {
      participantsById.set(participant.id, participant);
    }
  }

  if (task.responsibilityType === 'shared' && !participantsById.size) {
    for (const participant of activeParticipants.value) {
      participantsById.set(participant.id, participant);
    }
  }

  return [...participantsById.values()];
}

function getResponsibilityOptions(task?: Task) {
  const participantsById = new Map<string, Participant>();

  for (const participant of activeParticipants.value) {
    participantsById.set(participant.id, participant);
  }

  for (const participantId of task?.responsibleParticipantIds ?? []) {
    const participant = participantsStore.getParticipantById(participantId);

    if (participant) {
      participantsById.set(participant.id, participant);
    }
  }

  return [...participantsById.values()];
}

function resolveDraftResponsibility(choice: string) {
  if (choice === 'shared') {
    return {
      responsibilityType: 'shared' as const,
      responsibleParticipantIds: activeParticipants.value.map(
        (participant) => participant.id
      ),
    };
  }

  if (choice === 'needsDiscussion') {
    return {
      responsibilityType: 'needsDiscussion' as const,
      responsibleParticipantIds: [],
    };
  }

  return {
    responsibilityType: 'participant' as const,
    responsibleParticipantIds: [choice],
  };
}

function getMeeting(meetingId?: string) {
  return (
    meetingsStore.meetings.find((meeting) => meeting.id === meetingId) ?? null
  );
}

function getMeetingLabel(meetingId?: string) {
  const meeting = getMeeting(meetingId);

  if (!meeting) {
    return '';
  }

  return `${meeting.title} - ${formatDate(meeting.completedAt ?? meeting.updatedAt)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function createTaskCard(task: Task): TaskCardView {
  const participants = getTaskParticipants(task);
  const isShared =
    task.responsibilityType === 'shared' ||
    task.responsibleParticipantIds.length !== 1;
  const metadata = getTaskMetadata(task);
  const shouldUseBadge =
    isShared && (participants.length > 2 || participants.length === 0);

  return {
    id: task.id,
    title: task.title,
    metadataIcon: metadata.icon,
    metadataText: metadata.text,
    metadataTone: metadata.tone,
    participants,
    accessory: shouldUseBadge
      ? 'badge'
      : participants.length
        ? 'avatars'
        : 'none',
    badgeCount: shouldUseBadge ? Math.max(participants.length, 2) : undefined,
    group: isShared ? 'shared' : 'mine',
    task,
  };
}

function getTaskMetadata(task: Task) {
  if (task.status === 'done') {
    return {
      icon: 'check_circle',
      text: `${t('common.done')} - ${formatRelativeDay(
        getDayDifferenceFromToday(task.updatedAt)
      )}`,
      tone: 'default' as const,
    };
  }

  if (task.status === 'skipped') {
    return {
      icon: 'remove_circle',
      text: `${t('tasksPage.skip')} - ${formatRelativeDay(
        getDayDifferenceFromToday(task.updatedAt)
      )}`,
      tone: 'default' as const,
    };
  }

  if (task.dueDate) {
    const dayDifference = getDayDifferenceFromToday(task.dueDate);

    return {
      icon: dayDifference < 0 ? 'warning' : 'calendar_today',
      text: formatRelativeDay(dayDifference),
      tone: dayDifference < 0 ? 'danger' : ('default' as const),
    };
  }

  return {
    icon: 'calendar_today',
    text: getResponsibilityLabel(
      task.responsibilityType,
      task.responsibleParticipantIds
    ),
    tone: 'default' as const,
  };
}

function getDayDifferenceFromToday(value: string) {
  const date = getDateOnly(value);
  const today = getToday();

  return Math.round((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function formatRelativeDay(dayDifference: number) {
  const formatted = new Intl.RelativeTimeFormat(locale.value, {
    numeric: 'auto',
  }).format(dayDifference, 'day');

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getDateOnly(value: string) {
  const datePart = value.split('T')[0] || value;
  const date = new Date(`${datePart}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}

function saveTask(task: Task) {
  if (!canEditTasks.value) {
    statusMessage.value = t('meeting.roleCannotEditTasks');
    return;
  }

  const draft = editDrafts[task.id];

  if (!draft?.title.trim()) {
    statusMessage.value = t('tasksPage.addShortTitle');
    return;
  }

  const responsibility = resolveDraftResponsibility(draft.responsibilityChoice);

  tasksStore.updateTask(task.id, {
    title: draft.title,
    dueDate: draft.dueDate,
    ...responsibility,
  });
  meetingsStore.updateTaskDetails(task.id, {
    title: draft.title,
    dueDate: draft.dueDate,
    ...responsibility,
  });
  statusMessage.value = t('tasksPage.taskUpdated');
  selectedTask.value = null;
}

function addTask() {
  if (!canEditTasks.value) {
    statusMessage.value = t('meeting.roleCannotEditTasks');
    return;
  }

  if (!newTaskDraft.title.trim()) {
    statusMessage.value = t('tasksPage.addShortTitle');
    return;
  }

  const responsibility = resolveDraftResponsibility(
    newTaskDraft.responsibilityChoice
  );

  const createdTask = tasksStore.addTask({
    title: newTaskDraft.title,
    dueDate: newTaskDraft.dueDate,
    ...responsibility,
  });

  if (!createdTask) {
    statusMessage.value = t('tasksPage.addShortTitle');
    return;
  }

  newTaskDraft.title = '';
  newTaskDraft.dueDate = '';
  newTaskDraft.responsibilityChoice = firstParticipant.value?.id ?? 'shared';
  isAddTaskSheetOpen.value = false;
  statusMessage.value = t('tasksPage.updated');
}

function setTaskStatus(task: Task, status: TaskStatus) {
  if (!canEditTasks.value) {
    statusMessage.value = t('meeting.roleCannotEditTasks');
    return;
  }

  tasksStore.updateTaskStatus(task.id, status);
  meetingsStore.updateTaskStatus(task.id, status);
  statusMessage.value =
    status === 'done' ? t('tasksPage.markedDone') : t('tasksPage.updated');
  selectedTask.value = null;
}

function toggleTaskStatus(card: TaskCardView) {
  if (!card.task) {
    return;
  }

  setTaskStatus(card.task, card.task.status === 'done' ? 'open' : 'done');
}

function getTaskToggleLabel(card: TaskCardView) {
  if (card.task?.status === 'done') {
    return `${t('tasksPage.reopen')} ${card.title}`;
  }

  return `${t('common.done')} ${card.title}`;
}

function deleteTask(task: Task) {
  if (!canDeleteTasks.value) {
    statusMessage.value = t('tasksPage.ownerDeleteOnly');
    return;
  }

  const confirmed = window.confirm(t('tasksPage.confirmDeleteTask'));

  if (!confirmed) {
    return;
  }

  tasksStore.deleteTask(task.id);
  meetingsStore.deleteTask(task.id);
  selectedTask.value = null;
  statusMessage.value = t('tasksPage.taskDeleted');
}

function openTask(card: TaskCardView) {
  if (card.task) {
    selectedTask.value = card.task;
  }
}

function openAddTaskSheet() {
  if (!canEditTasks.value) {
    statusMessage.value = t('meeting.roleCannotEditTasks');
    return;
  }

  isAddTaskSheetOpen.value = true;
}
</script>

<template>
  <section class="tasks-page tasks-page--redesign" aria-label="Household Tasks">
    <div class="task-filter-tabs" role="tablist" aria-label="Task filters">
      <button
        v-for="filter in taskFilters"
        :key="filter.value"
        type="button"
        role="tab"
        :aria-selected="selectedFilter === filter.value"
        :class="[
          'task-filter-tabs__button',
          { 'is-active': selectedFilter === filter.value },
        ]"
        @click="selectedFilter = filter.value"
      >
        <span>{{ filter.label }}</span>
        <small>{{ taskFilterCounts[filter.value] }}</small>
      </button>
    </div>

    <section
      v-if="sharedTaskCards.length"
      class="task-card-section"
      aria-labelledby="shared-tasks-title"
    >
      <h2 id="shared-tasks-title">SHARED RESPONSIBILITIES</h2>
      <ul v-if="sharedTaskCards.length" class="task-card-list">
        <li
          v-for="card in sharedTaskCards"
          :key="card.id"
          class="task-card"
          @click="openTask(card)"
        >
          <button
            type="button"
            class="task-card__checkbox"
            :class="{ 'is-checked': card.task?.status === 'done' }"
            :aria-label="getTaskToggleLabel(card)"
            :disabled="!canEditTasks"
            @click.stop="toggleTaskStatus(card)"
          >
            <span class="material-symbols-outlined" aria-hidden="true">
              check
            </span>
          </button>
          <button
            type="button"
            class="task-card__content"
            @click.stop="openTask(card)"
          >
            <strong>{{ card.title }}</strong>
            <span
              class="task-card__metadata"
              :class="{ 'is-danger': card.metadataTone === 'danger' }"
            >
              <span class="material-symbols-outlined" aria-hidden="true">
                {{ card.metadataIcon }}
              </span>
              {{ card.metadataText }}
            </span>
          </button>
          <div class="task-card__side" aria-hidden="true">
            <div v-if="card.accessory === 'avatars'" class="task-avatar-stack">
              <span
                v-for="participant in card.participants.slice(0, 2)"
                :key="participant.id"
                class="task-avatar"
                :style="{ backgroundColor: participant.avatarColor }"
              >
                {{ participant.initials }}
              </span>
            </div>
            <span v-else-if="card.accessory === 'badge'" class="task-count">
              {{ card.badgeCount }}
            </span>
          </div>
        </li>
      </ul>
    </section>

    <section
      v-if="myTaskCards.length"
      class="task-card-section"
      aria-labelledby="my-tasks-title"
    >
      <h2 id="my-tasks-title">MY TASKS</h2>
      <ul v-if="myTaskCards.length" class="task-card-list">
        <li
          v-for="card in myTaskCards"
          :key="card.id"
          class="task-card"
          @click="openTask(card)"
        >
          <button
            type="button"
            class="task-card__checkbox"
            :class="{ 'is-checked': card.task?.status === 'done' }"
            :aria-label="getTaskToggleLabel(card)"
            :disabled="!canEditTasks"
            @click.stop="toggleTaskStatus(card)"
          >
            <span class="material-symbols-outlined" aria-hidden="true">
              check
            </span>
          </button>
          <button
            type="button"
            class="task-card__content"
            @click.stop="openTask(card)"
          >
            <strong>{{ card.title }}</strong>
            <span
              class="task-card__metadata"
              :class="{ 'is-danger': card.metadataTone === 'danger' }"
            >
              <span class="material-symbols-outlined" aria-hidden="true">
                {{ card.metadataIcon }}
              </span>
              {{ card.metadataText }}
            </span>
          </button>
          <div class="task-card__side" aria-hidden="true">
            <div v-if="card.accessory === 'avatars'" class="task-avatar-stack">
              <span
                v-for="participant in card.participants.slice(0, 2)"
                :key="participant.id"
                class="task-avatar"
                :style="{ backgroundColor: participant.avatarColor }"
              >
                {{ participant.initials }}
              </span>
            </div>
            <span v-else-if="card.accessory === 'badge'" class="task-count">
              {{ card.badgeCount }}
            </span>
          </div>
        </li>
      </ul>
    </section>
    <p v-if="!taskCards.length" class="task-empty">{{ emptyTaskMessage }}</p>

    <p v-if="statusMessage" class="meeting-status" role="status">
      {{ statusMessage }}
    </p>

    <button
      type="button"
      class="tasks-fab"
      :aria-label="t('tasksPage.task')"
      @click="openAddTaskSheet"
    >
      <span class="material-symbols-outlined" aria-hidden="true">add</span>
    </button>

    <div
      v-if="isAddTaskSheetOpen"
      class="task-editor-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-task-title"
    >
      <button
        type="button"
        class="task-editor-sheet__scrim"
        aria-label="Close"
        @click="isAddTaskSheetOpen = false"
      ></button>
      <form class="task-editor-sheet__panel" @submit.prevent="addTask">
        <header>
          <h2 id="add-task-title">{{ t('tasksPage.task') }}</h2>
          <button
            type="button"
            class="material-symbols-outlined"
            aria-label="Close"
            @click="isAddTaskSheetOpen = false"
          >
            close
          </button>
        </header>
        <label>
          <span>{{ t('tasksPage.task') }}</span>
          <input v-model="newTaskDraft.title" type="text" />
        </label>
        <label>
          <span>{{ t('tasksPage.responsible') }}</span>
          <select v-model="newTaskDraft.responsibilityChoice">
            <option value="needsDiscussion">
              {{ t('tasksPage.needsDiscussion') }}
            </option>
            <option value="shared">{{ t('tasksPage.shared') }}</option>
            <option
              v-for="participant in getResponsibilityOptions()"
              :key="participant.id"
              :value="participant.id"
            >
              {{ participant.name }}
            </option>
          </select>
        </label>
        <label>
          <span>{{ t('tasksPage.stillRelevant') }}</span>
          <input v-model="newTaskDraft.dueDate" type="date" />
        </label>
        <button type="submit" class="meeting-primary">
          {{ t('common.save') }}
        </button>
      </form>
    </div>

    <div
      v-if="selectedTask && selectedTaskDraft"
      class="task-editor-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-title"
    >
      <button
        type="button"
        class="task-editor-sheet__scrim"
        aria-label="Close"
        @click="selectedTask = null"
      ></button>
      <form
        class="task-editor-sheet__panel"
        @submit.prevent="saveTask(selectedTask)"
      >
        <header>
          <h2 id="edit-task-title">{{ t('tasksPage.task') }}</h2>
          <button
            type="button"
            class="material-symbols-outlined"
            aria-label="Close"
            @click="selectedTask = null"
          >
            close
          </button>
        </header>
        <label>
          <span>{{ t('tasksPage.task') }}</span>
          <input
            v-model="selectedTaskDraft.title"
            type="text"
            :disabled="!canEditTasks"
          />
        </label>
        <label>
          <span>{{ t('tasksPage.responsible') }}</span>
          <select
            v-model="selectedTaskDraft.responsibilityChoice"
            :disabled="!canEditTasks"
          >
            <option value="needsDiscussion">
              {{ t('tasksPage.needsDiscussion') }}
            </option>
            <option value="shared">{{ t('tasksPage.shared') }}</option>
            <option
              v-for="participant in getResponsibilityOptions(selectedTask)"
              :key="participant.id"
              :value="participant.id"
            >
              {{ participant.name
              }}{{
                participant.isActive ? '' : t('tasksPage.disabledParticipant')
              }}
            </option>
          </select>
        </label>
        <label>
          <span>{{ t('tasksPage.stillRelevant') }}</span>
          <input
            v-model="selectedTaskDraft.dueDate"
            type="date"
            :disabled="!canEditTasks"
          />
        </label>
        <p v-if="selectedTask.description" class="task-editor-sheet__note">
          {{ selectedTask.description }}
        </p>
        <p v-if="selectedTask.sourceMeetingId" class="task-editor-sheet__note">
          {{
            t('tasksPage.fromMeeting', {
              meeting: getMeetingLabel(selectedTask.sourceMeetingId),
            })
          }}
        </p>
        <div class="task-editor-sheet__actions">
          <button v-if="canEditTasks" type="submit" class="meeting-primary">
            {{ t('common.save') }}
          </button>
          <button
            v-if="canEditTasks && selectedTask.status !== 'done'"
            type="button"
            @click="setTaskStatus(selectedTask, 'done')"
          >
            {{ t('common.done') }}
          </button>
          <button
            v-if="canEditTasks && selectedTask.status === 'done'"
            type="button"
            @click="setTaskStatus(selectedTask, 'open')"
          >
            {{ t('tasksPage.reopen') }}
          </button>
          <button
            v-if="canEditTasks"
            type="button"
            @click="setTaskStatus(selectedTask, 'skipped')"
          >
            {{ t('tasksPage.skip') }}
          </button>
          <button
            v-if="canDeleteTasks"
            type="button"
            class="task-editor-sheet__danger"
            @click="deleteTask(selectedTask)"
          >
            {{ t('common.delete') }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>
