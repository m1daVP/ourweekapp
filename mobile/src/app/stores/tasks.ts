import { defineStore } from 'pinia'
import type { Meeting } from '@/features/meeting/types'
import type {
  Agreement,
  Task,
  TaskReviewDecision,
  TaskStatus,
} from '@/features/tasks/types'

const STORAGE_KEY = 'weekly-us:tasks-agreements'

interface TasksState {
  tasks: Task[]
  agreements: Agreement[]
  reviewDecisions: TaskReviewDecision[]
}

interface AddTaskPayload {
  id?: string
  title: string
  description?: string
  responsiblePersonId: string
  dueDate?: string
  status?: TaskStatus
  sourceMeetingId?: string
  createdAt?: string
  updatedAt?: string
}

interface UpdateTaskPayload {
  title?: string
  description?: string
  responsiblePersonId?: string
  dueDate?: string
  sourceMeetingId?: string
}

interface AddAgreementPayload {
  id?: string
  title: string
  description?: string
  participants: string[]
  relatedTaskIds?: string[]
  sourceMeetingId: string
  createdAt?: string
  updatedAt?: string
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function nowIso() {
  return new Date().toISOString()
}

function getStoredState(): TasksState {
  if (typeof window === 'undefined') {
    return { tasks: [], agreements: [], reviewDecisions: [] }
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return { tasks: [], agreements: [], reviewDecisions: [] }
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<TasksState>

    return {
      tasks: Array.isArray(parsedValue.tasks) ? parsedValue.tasks : [],
      agreements: Array.isArray(parsedValue.agreements)
        ? parsedValue.agreements
        : [],
      reviewDecisions: Array.isArray(parsedValue.reviewDecisions)
        ? parsedValue.reviewDecisions
        : [],
    }
  } catch {
    return { tasks: [], agreements: [], reviewDecisions: [] }
  }
}

function sortByUpdatedDesc<T extends { updatedAt: string }>(items: T[]) {
  return [...items].sort(
    (first, second) =>
      new Date(second.updatedAt).getTime() -
      new Date(first.updatedAt).getTime(),
  )
}

export const useTasksStore = defineStore('tasks', {
  state: (): TasksState => getStoredState(),
  getters: {
    openTasks: (state) =>
      [...state.tasks]
        .filter((task) => task.status === 'open')
        .sort((first, second) => {
          if (first.dueDate && second.dueDate) {
            return first.dueDate.localeCompare(second.dueDate)
          }

          if (first.dueDate) {
            return -1
          }

          if (second.dueDate) {
            return 1
          }

          return (
            new Date(second.updatedAt).getTime() -
            new Date(first.updatedAt).getTime()
          )
        }),
    doneTasks: (state) =>
      sortByUpdatedDesc(state.tasks.filter((task) => task.status === 'done')),
    skippedTasks: (state) =>
      sortByUpdatedDesc(
        state.tasks.filter((task) => task.status === 'skipped'),
      ),
    recentAgreements: (state) =>
      sortByUpdatedDesc(state.agreements).slice(0, 8),
  },
  actions: {
    persist() {
      if (typeof window === 'undefined') {
        return
      }

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          tasks: this.tasks,
          agreements: this.agreements,
          reviewDecisions: this.reviewDecisions,
        }),
      )
    },
    syncFromMeetings(meetings: Meeting[]) {
      let changed = false

      for (const meeting of meetings) {
        for (const section of meeting.sections) {
          for (const meetingTask of section.tasks) {
            if (this.tasks.some((task) => task.id === meetingTask.id)) {
              continue
            }

            this.tasks.push({
              id: meetingTask.id,
              title: meetingTask.title,
              description: meetingTask.description,
              responsiblePersonId: meetingTask.responsiblePersonId,
              dueDate: meetingTask.dueDate,
              status: meetingTask.status,
              sourceMeetingId: meeting.id,
              createdAt: meetingTask.createdAt,
              updatedAt:
                meetingTask.completedAt ??
                meeting.updatedAt ??
                meetingTask.createdAt,
            })
            changed = true
          }

          for (const meetingAgreement of section.agreements) {
            if (
              this.agreements.some(
                (agreement) => agreement.id === meetingAgreement.id,
              )
            ) {
              continue
            }

            this.agreements.push({
              id: meetingAgreement.id,
              title: meetingAgreement.text,
              participants: meeting.participants.map(
                (participant) => participant.id,
              ),
              sourceMeetingId: meeting.id,
              createdAt: meetingAgreement.createdAt,
              updatedAt: meetingAgreement.createdAt,
            })
            changed = true
          }
        }
      }

      if (changed) {
        this.persist()
      }
    },
    addTask(payload: AddTaskPayload) {
      const title = payload.title.trim()

      if (!title || !payload.responsiblePersonId) {
        return null
      }

      const createdAt = payload.createdAt ?? nowIso()
      const task: Task = {
        id: payload.id ?? createId('task'),
        title,
        description: payload.description?.trim() || undefined,
        responsiblePersonId: payload.responsiblePersonId,
        dueDate: payload.dueDate?.trim() || undefined,
        status: payload.status ?? 'open',
        sourceMeetingId: payload.sourceMeetingId,
        createdAt,
        updatedAt: payload.updatedAt ?? createdAt,
      }
      const existingIndex = this.tasks.findIndex((item) => item.id === task.id)

      if (existingIndex >= 0) {
        this.tasks.splice(existingIndex, 1, task)
      } else {
        this.tasks.unshift(task)
      }

      this.persist()
      return task
    },
    updateTask(taskId: string, payload: UpdateTaskPayload) {
      const task = this.tasks.find((item) => item.id === taskId)

      if (!task) {
        return null
      }

      const title = payload.title?.trim()
      const description = payload.description?.trim()
      const dueDate = payload.dueDate?.trim()

      if (title !== undefined) {
        if (!title) {
          return null
        }

        task.title = title
      }

      if (payload.description !== undefined) {
        task.description = description || undefined
      }

      if (payload.responsiblePersonId !== undefined) {
        task.responsiblePersonId = payload.responsiblePersonId
      }

      if (payload.dueDate !== undefined) {
        task.dueDate = dueDate || undefined
      }

      if (payload.sourceMeetingId !== undefined) {
        task.sourceMeetingId = payload.sourceMeetingId
      }

      task.updatedAt = nowIso()
      this.persist()
      return task
    },
    updateTaskStatus(taskId: string, status: TaskStatus) {
      const task = this.tasks.find((item) => item.id === taskId)

      if (!task) {
        return
      }

      task.status = status
      task.updatedAt = nowIso()
      this.persist()
    },
    updateTasksFromMeeting(sourceMeetingId: string, status: TaskStatus) {
      const changedAt = nowIso()
      let changed = false

      for (const task of this.tasks) {
        if (
          task.sourceMeetingId === sourceMeetingId &&
          task.status === 'open'
        ) {
          task.status = status
          task.updatedAt = changedAt
          changed = true
        }
      }

      if (changed) {
        this.persist()
      }
    },
    deleteTask(taskId: string) {
      const originalLength = this.tasks.length
      this.tasks = this.tasks.filter((task) => task.id !== taskId)

      if (this.tasks.length !== originalLength) {
        this.persist()
      }
    },
    addAgreement(payload: AddAgreementPayload) {
      const title = payload.title.trim()

      if (!title || !payload.sourceMeetingId) {
        return null
      }

      const createdAt = payload.createdAt ?? nowIso()
      const agreement: Agreement = {
        id: payload.id ?? createId('agreement'),
        title,
        description: payload.description?.trim() || undefined,
        participants: payload.participants,
        relatedTaskIds: payload.relatedTaskIds?.length
          ? payload.relatedTaskIds
          : undefined,
        sourceMeetingId: payload.sourceMeetingId,
        createdAt,
        updatedAt: payload.updatedAt ?? createdAt,
      }
      const existingIndex = this.agreements.findIndex(
        (item) => item.id === agreement.id,
      )

      if (existingIndex >= 0) {
        this.agreements.splice(existingIndex, 1, agreement)
      } else {
        this.agreements.unshift(agreement)
      }

      this.persist()
      return agreement
    },
    moveOpenTasksToMeeting(sourceMeetingId: string, targetMeetingId: string) {
      const changedAt = nowIso()
      const movedTasks: Task[] = []

      for (const task of this.tasks) {
        if (
          task.sourceMeetingId !== sourceMeetingId ||
          task.status !== 'open'
        ) {
          continue
        }

        task.status = 'skipped'
        task.updatedAt = changedAt

        const movedTask: Task = {
          ...task,
          id: createId('task'),
          status: 'open',
          sourceMeetingId: targetMeetingId,
          createdAt: changedAt,
          updatedAt: changedAt,
        }
        movedTasks.push(movedTask)
      }

      if (movedTasks.length) {
        this.tasks.unshift(...movedTasks)
        this.persist()
      }

      return movedTasks
    },
    markReviewHandled(meetingId: string, sourceMeetingId: string) {
      const existingDecision = this.reviewDecisions.find(
        (decision) =>
          decision.meetingId === meetingId &&
          decision.sourceMeetingId === sourceMeetingId,
      )

      if (existingDecision) {
        existingDecision.decidedAt = nowIso()
      } else {
        this.reviewDecisions.push({
          meetingId,
          sourceMeetingId,
          decidedAt: nowIso(),
        })
      }

      this.persist()
    },
    wasReviewHandled(meetingId: string, sourceMeetingId: string) {
      return this.reviewDecisions.some(
        (decision) =>
          decision.meetingId === meetingId &&
          decision.sourceMeetingId === sourceMeetingId,
      )
    },
  },
})
