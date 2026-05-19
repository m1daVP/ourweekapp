import { defineStore } from 'pinia'
import { useTasksStore } from '@/app/stores/tasks'
import type { Task } from '@/features/tasks/types'
import type {
  Agreement,
  Meeting,
  MeetingNote,
  MeetingSection,
  MeetingSectionId,
  MeetingTask,
  MeetingTaskStatus,
  Participant,
} from '@/features/meeting/types'

const STORAGE_KEY = 'weekly-us:meetings'

interface MeetingsState {
  meetings: Meeting[]
  activeMeetingId: string | null
  draftSavedAt: string | null
}

interface AddTaskPayload {
  title: string
  description?: string
  responsiblePersonId: string
  dueDate?: string
}

interface UpdateTaskPayload {
  title?: string
  description?: string
  responsiblePersonId?: string
  dueDate?: string
}

const sectionTemplates: Array<Pick<MeetingSection, 'id' | 'title' | 'prompt'>> =
  [
    {
      id: 'goodThings',
      title: 'Good things this week',
      prompt: 'What went well this week?',
    },
    {
      id: 'tensions',
      title: 'Tensions / problems',
      prompt: 'What felt stressful, unfair, or chaotic?',
    },
    {
      id: 'tasks',
      title: 'Tasks and responsibilities',
      prompt: 'What needs to be done this week?',
    },
    {
      id: 'money',
      title: 'Purchases / money',
      prompt: 'What do we need to buy or discuss financially?',
    },
    {
      id: 'familyCare',
      title: 'Kids / family care',
      prompt:
        'Anything important about kids, school, health, routines, or family care?',
    },
    {
      id: 'plans',
      title: 'Plans',
      prompt: 'What is coming next week?',
    },
    {
      id: 'finalAgreements',
      title: 'Final agreements',
      prompt: 'Review what was decided and finish when it feels complete.',
    },
  ]

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function nowIso() {
  return new Date().toISOString()
}

function createSections(): MeetingSection[] {
  return sectionTemplates.map((section) => ({
    ...section,
    notes: [],
    tasks: [],
    agreements: [],
  }))
}

function createDefaultParticipants(): Participant[] {
  return [
    { id: createId('person'), name: 'You' },
    { id: createId('person'), name: 'Partner' },
  ]
}

function createDefaultMeeting(participants?: Participant[]): Meeting {
  const createdAt = nowIso()

  return {
    id: createId('meeting'),
    title: 'Weekly meeting',
    status: 'in_progress',
    participants: participants?.length
      ? participants.map((participant) => ({ ...participant }))
      : createDefaultParticipants(),
    sections: createSections(),
    currentSectionIndex: 0,
    createdAt,
    updatedAt: createdAt,
  }
}

function getStoredState(): MeetingsState {
  if (typeof window === 'undefined') {
    return { meetings: [], activeMeetingId: null, draftSavedAt: null }
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return { meetings: [], activeMeetingId: null, draftSavedAt: null }
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<MeetingsState>

    return {
      meetings: Array.isArray(parsedValue.meetings) ? parsedValue.meetings : [],
      activeMeetingId: parsedValue.activeMeetingId ?? null,
      draftSavedAt: parsedValue.draftSavedAt ?? null,
    }
  } catch {
    return { meetings: [], activeMeetingId: null, draftSavedAt: null }
  }
}

function findSection(meeting: Meeting, sectionId: MeetingSectionId) {
  return meeting.sections.find((section) => section.id === sectionId)
}

function findTask(meetings: Meeting[], taskId: string) {
  for (const meeting of meetings) {
    for (const section of meeting.sections) {
      const task = section.tasks.find((item) => item.id === taskId)

      if (task) {
        return { meeting, task }
      }
    }
  }

  return null
}

function meetingHasContent(meeting: Meeting) {
  return meeting.sections.some(
    (section) =>
      section.notes.length > 0 ||
      section.tasks.length > 0 ||
      section.agreements.length > 0,
  )
}

export const useMeetingsStore = defineStore('meetings', {
  state: (): MeetingsState => getStoredState(),
  getters: {
    activeMeeting: (state) =>
      state.meetings.find((meeting) => meeting.id === state.activeMeetingId) ??
      null,
    completedMeetings: (state) =>
      state.meetings.filter((meeting) => meeting.status === 'completed'),
  },
  actions: {
    persist() {
      if (typeof window === 'undefined') {
        return
      }

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          meetings: this.meetings,
          activeMeetingId: this.activeMeetingId,
          draftSavedAt: this.draftSavedAt,
        }),
      )
    },
    ensureActiveMeeting() {
      const activeMeeting = this.activeMeeting

      if (activeMeeting && activeMeeting.status !== 'completed') {
        return activeMeeting
      }

      const existingDraft = this.meetings.find(
        (meeting) => meeting.status !== 'completed',
      )

      if (existingDraft) {
        this.activeMeetingId = existingDraft.id
        this.persist()
        return existingDraft
      }

      const meeting = createDefaultMeeting(this.meetings[0]?.participants)
      this.meetings.unshift(meeting)
      this.activeMeetingId = meeting.id
      this.persist()
      return meeting
    },
    startNewMeeting() {
      const meeting = createDefaultMeeting(this.meetings[0]?.participants)
      this.meetings.unshift(meeting)
      this.activeMeetingId = meeting.id
      this.draftSavedAt = null
      this.persist()
      return meeting
    },
    setCurrentSection(index: number) {
      const meeting = this.activeMeeting

      if (!meeting) {
        return
      }

      meeting.currentSectionIndex = Math.min(
        Math.max(index, 0),
        meeting.sections.length - 1,
      )
      meeting.status = 'in_progress'
      meeting.updatedAt = nowIso()
      this.persist()
    },
    addParticipant(name: string): Participant | null {
      const meeting = this.activeMeeting
      const trimmedName = name.trim()

      if (!meeting || !trimmedName) {
        return null
      }

      const participant = {
        id: createId('person'),
        name: trimmedName,
      }

      meeting.participants.push(participant)
      meeting.updatedAt = nowIso()
      this.persist()
      return participant
    },
    addNote(
      sectionId: MeetingSectionId,
      participantId: string,
      text: string,
    ): string | null {
      const meeting = this.activeMeeting
      const section = meeting ? findSection(meeting, sectionId) : undefined
      const trimmedText = text.trim()

      if (!meeting || !section) {
        return 'Open a meeting before adding a note.'
      }

      if (!trimmedText) {
        return 'Add a short note first.'
      }

      if (
        !meeting.participants.some(
          (participant) => participant.id === participantId,
        )
      ) {
        return 'Choose who is adding this note.'
      }

      const note: MeetingNote = {
        id: createId('note'),
        sectionId,
        participantId,
        text: trimmedText,
        createdAt: nowIso(),
      }

      section.notes.push(note)
      meeting.updatedAt = nowIso()
      this.persist()
      return null
    },
    addTask(
      sectionId: MeetingSectionId,
      payload: AddTaskPayload,
    ): string | null {
      const meeting = this.activeMeeting
      const section = meeting ? findSection(meeting, sectionId) : undefined
      const title = payload.title.trim()
      const description = payload.description?.trim()
      const dueDate = payload.dueDate?.trim()

      if (!meeting || !section) {
        return 'Open a meeting before adding a task.'
      }

      if (!title) {
        return 'Task title is required.'
      }

      if (!payload.responsiblePersonId) {
        return 'Choose who will take care of it.'
      }

      if (
        !meeting.participants.some(
          (participant) => participant.id === payload.responsiblePersonId,
        )
      ) {
        return 'Choose someone from this meeting.'
      }

      const createdAt = nowIso()
      const task: MeetingTask = {
        id: createId('task'),
        sectionId,
        title,
        description: description || undefined,
        responsiblePersonId: payload.responsiblePersonId,
        dueDate: dueDate || undefined,
        status: 'open',
        createdAt,
        updatedAt: createdAt,
      }

      section.tasks.push(task)
      meeting.updatedAt = createdAt
      useTasksStore().addTask({ ...task, sourceMeetingId: meeting.id })
      this.persist()
      return null
    },
    updateTaskStatus(taskId: string, status: MeetingTaskStatus) {
      const found = findTask(this.meetings, taskId)

      if (!found) {
        return
      }

      const updatedAt = nowIso()
      found.task.status = status
      found.task.updatedAt = updatedAt
      found.task.completedAt = status === 'done' ? updatedAt : undefined
      found.meeting.updatedAt = updatedAt
      useTasksStore().updateTaskStatus(taskId, status)
      this.persist()
    },
    updateTaskDetails(taskId: string, payload: UpdateTaskPayload) {
      const found = findTask(this.meetings, taskId)

      if (!found) {
        return
      }

      const title = payload.title?.trim()
      const description = payload.description?.trim()
      const dueDate = payload.dueDate?.trim()

      if (title !== undefined) {
        if (!title) {
          return
        }

        found.task.title = title
      }

      if (payload.description !== undefined) {
        found.task.description = description || undefined
      }

      if (payload.responsiblePersonId !== undefined) {
        found.task.responsiblePersonId = payload.responsiblePersonId
      }

      if (payload.dueDate !== undefined) {
        found.task.dueDate = dueDate || undefined
      }

      const updatedAt = nowIso()
      found.task.updatedAt = updatedAt
      found.meeting.updatedAt = updatedAt
      this.persist()
    },
    updateTasksFromMeeting(sourceMeetingId: string, status: MeetingTaskStatus) {
      const meeting = this.meetings.find((item) => item.id === sourceMeetingId)

      if (!meeting) {
        return
      }

      const updatedAt = nowIso()
      let changed = false

      for (const task of meeting.sections.flatMap((section) => section.tasks)) {
        if (task.status !== 'open') {
          continue
        }

        task.status = status
        task.updatedAt = updatedAt
        task.completedAt = status === 'done' ? updatedAt : undefined
        changed = true
      }

      if (changed) {
        meeting.updatedAt = updatedAt
        this.persist()
      }
    },
    addMovedTasksToMeeting(
      sourceMeetingId: string,
      targetMeetingId: string,
      movedTasks: Task[],
    ) {
      const sourceMeeting = this.meetings.find(
        (meeting) => meeting.id === sourceMeetingId,
      )
      const targetMeeting = this.meetings.find(
        (meeting) => meeting.id === targetMeetingId,
      )
      const targetSection = targetMeeting
        ? findSection(targetMeeting, 'tasks')
        : undefined

      if (
        !sourceMeeting ||
        !targetMeeting ||
        !targetSection ||
        !movedTasks.length
      ) {
        return
      }

      const updatedAt = nowIso()
      const movedTaskIds = new Set(movedTasks.map((task) => task.id))

      for (const task of sourceMeeting.sections.flatMap(
        (section) => section.tasks,
      )) {
        if (task.status === 'open') {
          task.status = 'skipped'
          task.updatedAt = updatedAt
        }
      }

      for (const task of movedTasks) {
        if (
          movedTaskIds.has(task.id) &&
          !targetSection.tasks.some((item) => item.id === task.id)
        ) {
          targetSection.tasks.push({
            id: task.id,
            sectionId: 'tasks',
            title: task.title,
            description: task.description,
            responsiblePersonId: task.responsiblePersonId,
            dueDate: task.dueDate,
            status: task.status,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
          })
        }
      }

      sourceMeeting.updatedAt = updatedAt
      targetMeeting.updatedAt = updatedAt
      this.persist()
    },
    deleteTask(taskId: string) {
      let changed = false

      for (const meeting of this.meetings) {
        for (const section of meeting.sections) {
          const nextTasks = section.tasks.filter((task) => task.id !== taskId)

          if (nextTasks.length !== section.tasks.length) {
            section.tasks = nextTasks
            meeting.updatedAt = nowIso()
            changed = true
          }
        }
      }

      if (changed) {
        this.persist()
      }
    },
    addAgreement(sectionId: MeetingSectionId, text: string): string | null {
      const meeting = this.activeMeeting
      const section = meeting ? findSection(meeting, sectionId) : undefined
      const trimmedText = text.trim()

      if (!meeting || !section) {
        return 'Open a meeting before adding an agreement.'
      }

      if (!trimmedText) {
        return 'Add the agreement first.'
      }

      const createdAt = nowIso()
      const agreement: Agreement = {
        id: createId('agreement'),
        sectionId,
        text: trimmedText,
        createdAt,
      }

      section.agreements.push(agreement)
      meeting.updatedAt = createdAt
      useTasksStore().addAgreement({
        id: agreement.id,
        title: trimmedText,
        participants: meeting.participants.map((participant) => participant.id),
        relatedTaskIds: meeting.sections.flatMap((item) =>
          item.tasks.map((task) => task.id),
        ),
        sourceMeetingId: meeting.id,
        createdAt,
        updatedAt: createdAt,
      })
      this.persist()
      return null
    },
    saveDraft() {
      const meeting = this.activeMeeting

      if (!meeting) {
        return
      }

      const savedAt = nowIso()
      meeting.status = 'draft'
      meeting.updatedAt = savedAt
      this.draftSavedAt = savedAt
      this.persist()
    },
    finishMeeting(): string | null {
      const meeting = this.activeMeeting

      if (!meeting) {
        return 'Open a meeting before finishing.'
      }

      if (!meetingHasContent(meeting)) {
        return 'Add at least one note, task, or agreement before finishing.'
      }

      const completedAt = nowIso()
      meeting.status = 'completed'
      meeting.completedAt = completedAt
      meeting.updatedAt = completedAt
      meeting.currentSectionIndex = meeting.sections.length - 1
      this.draftSavedAt = null
      this.persist()
      return null
    },
  },
})
