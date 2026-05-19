<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useMeetingsStore } from '@/app/stores/meetings'
import type { MeetingSectionId } from '@/features/meeting/types'

const meetingsStore = useMeetingsStore()

const noteText = ref('')
const agreementText = ref('')
const participantName = ref('')
const selectedParticipantId = ref('')
const formError = ref('')
const statusMessage = ref('')

const taskDraft = reactive({
  title: '',
  description: '',
  responsiblePersonId: '',
  dueDate: '',
})

const activeMeeting = computed(() => meetingsStore.activeMeeting)
const currentSection = computed(() => {
  const meeting = activeMeeting.value
  return meeting?.sections[meeting.currentSectionIndex] ?? null
})
const currentStepNumber = computed(() => (activeMeeting.value?.currentSectionIndex ?? 0) + 1)
const totalSteps = computed(() => activeMeeting.value?.sections.length ?? 0)
const progressPercent = computed(() =>
  totalSteps.value > 0 ? `${(currentStepNumber.value / totalSteps.value) * 100}%` : '0%',
)
const isFinalSection = computed(() => currentSection.value?.id === 'finalAgreements')
const canAddTasks = computed(() =>
  currentSection.value ? ['tasks', 'familyCare'].includes(currentSection.value.id) : false,
)
const canAddAgreements = computed(() =>
  currentSection.value ? ['money', 'finalAgreements'].includes(currentSection.value.id) : false,
)
const showNotes = computed(() => currentSection.value?.id !== 'finalAgreements')
const isCompleted = computed(() => activeMeeting.value?.status === 'completed')

const allNotes = computed(() =>
  activeMeeting.value
    ? activeMeeting.value.sections.flatMap((section) =>
        section.notes.map((note) => ({
          ...note,
          sectionTitle: section.title,
          participantName: getParticipantName(note.participantId),
        })),
      )
    : [],
)
const allTasks = computed(() =>
  activeMeeting.value
    ? activeMeeting.value.sections.flatMap((section) =>
        section.tasks.map((task) => ({
          ...task,
          sectionTitle: section.title,
          responsibleName: getParticipantName(task.responsiblePersonId),
        })),
      )
    : [],
)
const allAgreements = computed(() =>
  activeMeeting.value
    ? activeMeeting.value.sections.flatMap((section) =>
        section.agreements.map((agreement) => ({
          ...agreement,
          sectionTitle: section.title,
        })),
      )
    : [],
)
const hasMeetingContent = computed(
  () => allNotes.value.length > 0 || allTasks.value.length > 0 || allAgreements.value.length > 0,
)

const neutralHint = computed(() => {
  if (currentSection.value?.id !== 'tensions' || !noteText.value.trim()) {
    return ''
  }

  const loadedWords = ['always', 'never', 'lazy', 'stupid', 'fault', 'blame']
  const lowerText = noteText.value.toLowerCase()

  return loadedWords.some((word) => lowerText.includes(word))
    ? 'Try naming what happened and what would help, without labels or blame.'
    : ''
})

onMounted(() => {
  const meeting = meetingsStore.ensureActiveMeeting()
  selectedParticipantId.value = meeting.participants[0]?.id ?? ''
  taskDraft.responsiblePersonId = selectedParticipantId.value
})

watch(
  () => activeMeeting.value?.participants,
  (participants) => {
    const firstParticipantId = participants?.[0]?.id ?? ''

    if (!selectedParticipantId.value) {
      selectedParticipantId.value = firstParticipantId
    }

    if (!taskDraft.responsiblePersonId) {
      taskDraft.responsiblePersonId = firstParticipantId
    }
  },
  { immediate: true },
)

watch(
  () => currentSection.value?.id,
  () => {
    noteText.value = ''
    agreementText.value = ''
    formError.value = ''
    statusMessage.value = ''
    resetTaskForm()
  },
)

function getParticipantName(participantId: string) {
  return activeMeeting.value?.participants.find((participant) => participant.id === participantId)?.name ?? 'Someone'
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
  }

  return placeholders[sectionId]
}

function clearMessages() {
  formError.value = ''
  statusMessage.value = ''
}

function resetTaskForm() {
  taskDraft.title = ''
  taskDraft.description = ''
  taskDraft.dueDate = ''
  taskDraft.responsiblePersonId = selectedParticipantId.value || activeMeeting.value?.participants[0]?.id || ''
}

function addParticipant() {
  clearMessages()
  const participant = meetingsStore.addParticipant(participantName.value)

  if (!participant) {
    formError.value = 'Add a name first.'
    return
  }

  selectedParticipantId.value = participant.id
  taskDraft.responsiblePersonId = participant.id
  participantName.value = ''
  statusMessage.value = 'Person added.'
}

function addNote() {
  const section = currentSection.value

  if (!section) {
    return
  }

  clearMessages()
  const error = meetingsStore.addNote(section.id, selectedParticipantId.value, noteText.value)

  if (error) {
    formError.value = error
    return
  }

  noteText.value = ''
  statusMessage.value = 'Note added.'
}

function addTask() {
  const section = currentSection.value

  if (!section) {
    return
  }

  clearMessages()
  const error = meetingsStore.addTask(section.id, taskDraft)

  if (error) {
    formError.value = error
    return
  }

  resetTaskForm()
  statusMessage.value = 'Task added.'
}

function addAgreement() {
  const section = currentSection.value

  if (!section) {
    return
  }

  clearMessages()
  const error = meetingsStore.addAgreement(section.id, agreementText.value)

  if (error) {
    formError.value = error
    return
  }

  agreementText.value = ''
  statusMessage.value = 'Agreement added.'
}

function toggleTask(taskId: string, status: 'open' | 'done') {
  meetingsStore.updateTaskStatus(taskId, status === 'open' ? 'done' : 'open')
}

function goBack() {
  const meeting = activeMeeting.value

  if (!meeting) {
    return
  }

  meetingsStore.setCurrentSection(meeting.currentSectionIndex - 1)
}

function goNext() {
  const meeting = activeMeeting.value

  if (!meeting) {
    return
  }

  meetingsStore.setCurrentSection(meeting.currentSectionIndex + 1)
}

function saveDraft() {
  clearMessages()
  meetingsStore.saveDraft()
  statusMessage.value = 'Draft saved on this phone.'
}

function finishMeeting() {
  clearMessages()
  const error = meetingsStore.finishMeeting()

  if (error) {
    formError.value = error
    return
  }

  statusMessage.value = 'Meeting finished.'
}

function startNewMeeting() {
  const meeting = meetingsStore.startNewMeeting()
  selectedParticipantId.value = meeting.participants[0]?.id ?? ''
  resetTaskForm()
  clearMessages()
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
        <button v-if="!isCompleted" class="meeting-save" type="button" @click="saveDraft">
          Save draft
        </button>
      </div>

      <div class="meeting-progress" aria-label="Meeting progress">
        <div class="meeting-progress__label">
          <span>Step {{ currentStepNumber }} of {{ totalSteps }}</span>
          <span>{{ Math.round((currentStepNumber / totalSteps) * 100) }}%</span>
        </div>
        <div class="meeting-progress__track">
          <div class="meeting-progress__bar" :style="{ width: progressPercent }" />
        </div>
      </div>
    </header>

    <section class="meeting-panel meeting-people" aria-labelledby="meeting-people-title">
      <h2 id="meeting-people-title">People here</h2>
      <div class="meeting-chip-row">
        <span
          v-for="participant in activeMeeting.participants"
          :key="participant.id"
          class="meeting-chip"
        >
          {{ participant.name }}
        </span>
      </div>
      <form class="meeting-inline-form" @submit.prevent="addParticipant">
        <label class="sr-only" for="participant-name">Add person</label>
        <input id="participant-name" v-model="participantName" type="text" placeholder="Add person" />
        <button type="submit">Add</button>
      </form>
    </section>

    <section v-if="showNotes" class="meeting-panel" aria-labelledby="meeting-notes-title">
      <h2 id="meeting-notes-title">Notes</h2>
      <label class="meeting-label" for="note-person">Who is adding this?</label>
      <select id="note-person" v-model="selectedParticipantId">
        <option
          v-for="participant in activeMeeting.participants"
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
      />
      <p v-if="neutralHint" class="meeting-help">{{ neutralHint }}</p>
      <button class="meeting-primary" type="button" @click="addNote">Add note</button>

      <ul v-if="currentSection.notes.length" class="meeting-list">
        <li v-for="note in currentSection.notes" :key="note.id">
          <span>{{ getParticipantName(note.participantId) }}</span>
          <p>{{ note.text }}</p>
        </li>
      </ul>
      <p v-else class="meeting-empty">No notes yet.</p>
    </section>

    <section v-if="canAddTasks" class="meeting-panel" aria-labelledby="meeting-tasks-title">
      <h2 id="meeting-tasks-title">Tasks</h2>
      <label class="meeting-label" for="task-title">Task title</label>
      <input id="task-title" v-model="taskDraft.title" type="text" placeholder="What needs care?" />

      <label class="meeting-label" for="task-description">Optional detail</label>
      <textarea
        id="task-description"
        v-model="taskDraft.description"
        rows="3"
        placeholder="Anything that would make this easier?"
      />

      <label class="meeting-label" for="task-person">Who will take care of it?</label>
      <select id="task-person" v-model="taskDraft.responsiblePersonId">
        <option value="">Choose a person</option>
        <option
          v-for="participant in activeMeeting.participants"
          :key="participant.id"
          :value="participant.id"
        >
          {{ participant.name }}
        </option>
      </select>

      <label class="meeting-label" for="task-due-date">Due date</label>
      <input id="task-due-date" v-model="taskDraft.dueDate" type="date" />
      <button class="meeting-primary" type="button" @click="addTask">Add task</button>

      <ul v-if="currentSection.tasks.length" class="meeting-list meeting-task-list">
        <li v-for="task in currentSection.tasks" :key="task.id">
          <div>
            <span>{{ getParticipantName(task.responsiblePersonId) }}</span>
            <p>{{ task.title }}</p>
            <small v-if="task.description">{{ task.description }}</small>
            <small v-if="task.dueDate">Due {{ task.dueDate }}</small>
          </div>
          <button type="button" @click="toggleTask(task.id, task.status)">
            {{ task.status === 'done' ? 'Done' : 'Open' }}
          </button>
        </li>
      </ul>
      <p v-else class="meeting-empty">No tasks yet.</p>
    </section>

    <section v-if="canAddAgreements" class="meeting-panel" aria-labelledby="meeting-agreements-title">
      <h2 id="meeting-agreements-title">Agreements</h2>
      <label class="meeting-label" for="agreement-text">Decision or agreement</label>
      <textarea
        id="agreement-text"
        v-model="agreementText"
        rows="3"
        placeholder="What did we agree to?"
      />
      <button class="meeting-primary" type="button" @click="addAgreement">Add agreement</button>

      <ul v-if="currentSection.agreements.length" class="meeting-list">
        <li v-for="agreement in currentSection.agreements" :key="agreement.id">
          <span>{{ currentSection.title }}</span>
          <p>{{ agreement.text }}</p>
        </li>
      </ul>
      <p v-else class="meeting-empty">No agreements yet.</p>
    </section>

    <section v-if="isFinalSection" class="meeting-panel meeting-summary" aria-labelledby="meeting-summary-title">
      <h2 id="meeting-summary-title">Review together</h2>
      <p class="meeting-summary__intro">
        Look over the notes, tasks, and agreements before finishing.
      </p>

      <div class="meeting-summary__group">
        <h3>Agreements</h3>
        <ul v-if="allAgreements.length" class="meeting-list">
          <li v-for="agreement in allAgreements" :key="agreement.id">
            <span>{{ agreement.sectionTitle }}</span>
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
              <span>{{ task.responsibleName }}</span>
              <p>{{ task.title }}</p>
              <small>{{ task.sectionTitle }}</small>
              <small v-if="task.dueDate">Due {{ task.dueDate }}</small>
            </div>
            <button type="button" @click="toggleTask(task.id, task.status)">
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
      <p v-if="isCompleted" class="meeting-complete">This meeting is finished.</p>
    </section>

    <p v-if="formError" class="meeting-error" role="alert">{{ formError }}</p>
    <p v-if="statusMessage" class="meeting-status" role="status">{{ statusMessage }}</p>

    <footer class="meeting-actions">
      <button type="button" :disabled="currentStepNumber === 1" @click="goBack">Back</button>
      <button v-if="!isCompleted" type="button" @click="saveDraft">Save draft</button>
      <button v-if="!isFinalSection && !isCompleted" class="meeting-primary" type="button" @click="goNext">
        Next
      </button>
      <button v-else-if="!isCompleted" class="meeting-primary" type="button" @click="finishMeeting">
        Finish
      </button>
      <button v-else class="meeting-primary" type="button" @click="startNewMeeting">
        New meeting
      </button>
    </footer>
  </section>
</template>
