<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useMeetingsStore } from '@/app/stores/meetings'
import { useTasksStore } from '@/app/stores/tasks'
import type { Agreement, Task, TaskStatus } from '@/features/tasks/types'

const meetingsStore = useMeetingsStore()
const tasksStore = useTasksStore()

const editDrafts = reactive<
  Record<
    string,
    { title: string; dueDate: string; responsiblePersonId: string }
  >
>({})
const selectedAgreement = ref<Agreement | null>(null)
const statusMessage = ref('')

const openTasks = computed(() => tasksStore.openTasks)
const doneTasks = computed(() => tasksStore.doneTasks)
const skippedTasks = computed(() => tasksStore.skippedTasks)
const recentAgreements = computed(() => tasksStore.recentAgreements)

const participantOptions = computed(() => {
  const participants = new Map<string, string>()

  for (const meeting of meetingsStore.meetings) {
    for (const participant of meeting.participants) {
      participants.set(participant.id, participant.name)
    }
  }

  return [...participants.entries()].map(([id, name]) => ({ id, name }))
})

onMounted(() => {
  tasksStore.syncFromMeetings(meetingsStore.meetings)
})

watch(
  () =>
    tasksStore.tasks.map((task) => `${task.id}:${task.updatedAt}`).join('|'),
  () => syncDrafts(),
  { immediate: true },
)

function syncDrafts() {
  const taskIds = new Set(tasksStore.tasks.map((task) => task.id))

  for (const task of tasksStore.tasks) {
    if (!editDrafts[task.id]) {
      editDrafts[task.id] = {
        title: task.title,
        dueDate: task.dueDate ?? '',
        responsiblePersonId: task.responsiblePersonId,
      }
    }
  }

  for (const taskId of Object.keys(editDrafts)) {
    if (!taskIds.has(taskId)) {
      delete editDrafts[taskId]
    }
  }
}

function getPersonName(participantId: string) {
  return (
    participantOptions.value.find(
      (participant) => participant.id === participantId,
    )?.name ?? 'Someone'
  )
}

function getMeeting(meetingId?: string) {
  return (
    meetingsStore.meetings.find((meeting) => meeting.id === meetingId) ?? null
  )
}

function getMeetingLabel(meetingId?: string) {
  const meeting = getMeeting(meetingId)

  if (!meeting) {
    return ''
  }

  return `${meeting.title} - ${formatDate(meeting.completedAt ?? meeting.updatedAt)}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function saveTask(task: Task) {
  const draft = editDrafts[task.id]

  if (!draft?.title.trim()) {
    statusMessage.value = 'Add a short title first.'
    return
  }

  tasksStore.updateTask(task.id, {
    title: draft.title,
    dueDate: draft.dueDate,
    responsiblePersonId: draft.responsiblePersonId,
  })
  meetingsStore.updateTaskDetails(task.id, {
    title: draft.title,
    dueDate: draft.dueDate,
    responsiblePersonId: draft.responsiblePersonId,
  })
  statusMessage.value = 'Task updated.'
}

function setTaskStatus(task: Task, status: TaskStatus) {
  tasksStore.updateTaskStatus(task.id, status)
  meetingsStore.updateTaskStatus(task.id, status)
  statusMessage.value = status === 'done' ? 'Marked done.' : 'Updated.'
}

function deleteTask(task: Task) {
  const confirmed = window.confirm('Delete this task?')

  if (!confirmed) {
    return
  }

  tasksStore.deleteTask(task.id)
  meetingsStore.deleteTask(task.id)
  statusMessage.value = 'Task deleted.'
}

function openAgreement(agreement: Agreement) {
  selectedAgreement.value = agreement
}

function closeAgreement() {
  selectedAgreement.value = null
}

function relatedTaskTitles(agreement: Agreement) {
  return (
    agreement.relatedTaskIds
      ?.map(
        (taskId) => tasksStore.tasks.find((task) => task.id === taskId)?.title,
      )
      .filter((title): title is string => Boolean(title)) ?? []
  )
}
</script>

<template>
  <section class="page-stack tasks-page">
    <div>
      <p class="page-kicker">Tasks</p>
      <h1>What we agreed to do</h1>
      <p class="page-copy">
        A light place for household follow-ups from your weekly meetings.
      </p>
    </div>

    <section
      class="content-panel task-section"
      aria-labelledby="open-tasks-title"
    >
      <div class="task-section__header">
        <div>
          <h2 id="open-tasks-title">Open tasks</h2>
          <p>{{ openTasks.length }} still relevant</p>
        </div>
      </div>

      <ul v-if="openTasks.length" class="task-list">
        <li v-for="task in openTasks" :key="task.id" class="task-item">
          <div class="task-item__fields">
            <label>
              <span>Task</span>
              <input v-model="editDrafts[task.id].title" type="text" />
            </label>

            <label>
              <span>Who</span>
              <select v-model="editDrafts[task.id].responsiblePersonId">
                <option
                  v-for="participant in participantOptions"
                  :key="participant.id"
                  :value="participant.id"
                >
                  {{ participant.name }}
                </option>
              </select>
            </label>

            <label>
              <span>Still relevant?</span>
              <input v-model="editDrafts[task.id].dueDate" type="date" />
            </label>
          </div>

          <p v-if="task.description" class="task-item__description">
            {{ task.description }}
          </p>
          <p v-if="task.sourceMeetingId" class="task-item__source">
            From {{ getMeetingLabel(task.sourceMeetingId) }}
          </p>

          <div class="task-item__actions">
            <button type="button" @click="saveTask(task)">Save</button>
            <button
              type="button"
              class="task-item__done"
              @click="setTaskStatus(task, 'done')"
            >
              Done
            </button>
            <button type="button" @click="setTaskStatus(task, 'skipped')">
              Skip
            </button>
            <button
              type="button"
              class="task-item__danger"
              @click="deleteTask(task)"
            >
              Delete
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="meeting-empty">No open tasks right now.</p>
    </section>

    <details class="content-panel task-archive">
      <summary>Done tasks ({{ doneTasks.length }})</summary>
      <ul v-if="doneTasks.length" class="task-list task-list--compact">
        <li
          v-for="task in doneTasks"
          :key="task.id"
          class="task-item task-item--compact"
        >
          <div>
            <strong>{{ task.title }}</strong>
            <p>{{ getPersonName(task.responsiblePersonId) }}</p>
          </div>
          <button type="button" @click="setTaskStatus(task, 'open')">
            Reopen
          </button>
        </li>
      </ul>
      <p v-else class="meeting-empty">Nothing marked done yet.</p>
    </details>

    <details class="content-panel task-archive">
      <summary>Skipped tasks ({{ skippedTasks.length }})</summary>
      <ul v-if="skippedTasks.length" class="task-list task-list--compact">
        <li
          v-for="task in skippedTasks"
          :key="task.id"
          class="task-item task-item--compact"
        >
          <div>
            <strong>{{ task.title }}</strong>
            <p>{{ getPersonName(task.responsiblePersonId) }}</p>
          </div>
          <button type="button" @click="setTaskStatus(task, 'open')">
            Bring back
          </button>
        </li>
      </ul>
      <p v-else class="meeting-empty">No skipped tasks.</p>
    </details>

    <section
      class="content-panel agreement-history"
      aria-labelledby="agreements-title"
    >
      <div>
        <h2 id="agreements-title">Recent agreements</h2>
        <p>Decisions saved from weekly meetings.</p>
      </div>

      <ul v-if="recentAgreements.length" class="agreement-list">
        <li v-for="agreement in recentAgreements" :key="agreement.id">
          <button type="button" @click="openAgreement(agreement)">
            <span>{{ agreement.title }}</span>
            <small>
              {{ formatDate(agreement.createdAt) }}
              <template v-if="agreement.sourceMeetingId">
                -
                {{ getMeeting(agreement.sourceMeetingId)?.title ?? 'Meeting' }}
              </template>
            </small>
          </button>
        </li>
      </ul>
      <p v-else class="meeting-empty">No agreements saved yet.</p>
    </section>

    <p v-if="statusMessage" class="meeting-status" role="status">
      {{ statusMessage }}
    </p>

    <div
      v-if="selectedAgreement"
      class="agreement-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agreement-modal-title"
    >
      <div class="agreement-modal__panel">
        <div>
          <p class="page-kicker">Agreement</p>
          <h2 id="agreement-modal-title">{{ selectedAgreement.title }}</h2>
        </div>
        <p v-if="selectedAgreement.description">
          {{ selectedAgreement.description }}
        </p>
        <dl class="agreement-detail-list">
          <div>
            <dt>Date</dt>
            <dd>{{ formatDate(selectedAgreement.createdAt) }}</dd>
          </div>
          <div>
            <dt>Meeting</dt>
            <dd>
              {{
                getMeetingLabel(selectedAgreement.sourceMeetingId) || 'Meeting'
              }}
            </dd>
          </div>
          <div>
            <dt>People</dt>
            <dd>
              {{ selectedAgreement.participants.map(getPersonName).join(', ') }}
            </dd>
          </div>
        </dl>
        <div
          v-if="relatedTaskTitles(selectedAgreement).length"
          class="agreement-related"
        >
          <h3>Related tasks</h3>
          <ul>
            <li
              v-for="title in relatedTaskTitles(selectedAgreement)"
              :key="title"
            >
              {{ title }}
            </li>
          </ul>
        </div>
        <button type="button" class="meeting-primary" @click="closeAgreement">
          Close
        </button>
      </div>
    </div>
  </section>
</template>
