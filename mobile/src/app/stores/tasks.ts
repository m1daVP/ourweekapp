import { defineStore } from 'pinia';
import {
  readStorageSlice,
  writeStorageSlice,
} from '@/shared/services/storageService';
import { appConfig } from '@/shared/config/env';
import { uniqueStrings } from '@/shared/utils/collections';
import { compareIsoDesc, nowIso } from '@/shared/utils/dates';
import { createId } from '@/shared/utils/ids';
import type { Meeting } from '@/features/meeting/types';
import type {
  Agreement,
  Task,
  TaskResponsibilityType,
  TaskReviewDecision,
  TaskStatus,
} from '@/features/tasks/types';

interface TasksState {
  tasks: Task[];
  agreements: Agreement[];
  reviewDecisions: TaskReviewDecision[];
}

interface AddTaskPayload {
  id?: string;
  title: string;
  description?: string;
  responsibilityType?: TaskResponsibilityType;
  responsibleParticipantIds?: string[];
  responsiblePersonId?: string;
  dueDate?: string;
  status?: TaskStatus;
  sourceMeetingId?: string;
  carriedFromTaskId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UpdateTaskPayload {
  title?: string;
  description?: string;
  responsibilityType?: TaskResponsibilityType;
  responsibleParticipantIds?: string[];
  responsiblePersonId?: string;
  dueDate?: string;
  sourceMeetingId?: string;
}

interface AddAgreementPayload {
  id?: string;
  title: string;
  description?: string;
  participantIds: string[];
  relatedTaskIds?: string[];
  sourceMeetingId: string;
  createdAt?: string;
  updatedAt?: string;
}

interface LegacyTask {
  id?: string;
  title?: string;
  description?: string;
  responsibilityType?: TaskResponsibilityType;
  responsibleParticipantIds?: string[];
  responsiblePersonId?: string;
  dueDate?: string;
  status?: TaskStatus;
  sourceMeetingId?: string;
  carriedFromTaskId?: string;
  createdAt?: string;
  updatedAt?: string;
  serverRevision?: number;
  deletedAt?: string;
}

interface LegacyAgreement {
  id?: string;
  title?: string;
  description?: string;
  participantIds?: string[];
  participants?: string[];
  relatedTaskIds?: string[];
  sourceMeetingId?: string;
  createdAt?: string;
  updatedAt?: string;
  serverRevision?: number;
  deletedAt?: string;
}

function normalizeTask(task: LegacyTask): Task | null {
  const title = task.title?.trim();

  if (!title) {
    return null;
  }

  const responsibleParticipantIds = uniqueStrings([
    ...(task.responsibleParticipantIds ?? []),
    task.responsiblePersonId,
  ]);
  const responsibilityType =
    task.responsibilityType ??
    (responsibleParticipantIds.length ? 'participant' : 'needsDiscussion');
  const createdAt = task.createdAt ?? nowIso();

  return {
    id: task.id ?? createId(),
    title,
    description: task.description?.trim() || undefined,
    responsibilityType,
    responsibleParticipantIds:
      responsibilityType === 'needsDiscussion' ? [] : responsibleParticipantIds,
    dueDate: task.dueDate?.trim() || undefined,
    status: task.status ?? 'open',
    sourceMeetingId: task.sourceMeetingId,
    carriedFromTaskId: task.carriedFromTaskId?.trim() || undefined,
    createdAt,
    updatedAt: task.updatedAt ?? createdAt,
    serverRevision: task.serverRevision,
    deletedAt: task.deletedAt,
  };
}

function normalizeAgreement(agreement: LegacyAgreement): Agreement | null {
  const title = agreement.title?.trim();

  if (!title || !agreement.sourceMeetingId) {
    return null;
  }

  const createdAt = agreement.createdAt ?? nowIso();

  return {
    id: agreement.id ?? createId(),
    title,
    description: agreement.description?.trim() || undefined,
    participantIds: uniqueStrings([
      ...(agreement.participantIds ?? []),
      ...(agreement.participants ?? []),
    ]),
    relatedTaskIds: agreement.relatedTaskIds?.length
      ? agreement.relatedTaskIds
      : undefined,
    sourceMeetingId: agreement.sourceMeetingId,
    createdAt,
    updatedAt: agreement.updatedAt ?? createdAt,
    serverRevision: agreement.serverRevision,
    deletedAt: agreement.deletedAt,
  };
}

function resolveTaskResponsibility(
  payload: AddTaskPayload | UpdateTaskPayload
) {
  const responsibleParticipantIds = uniqueStrings([
    ...(payload.responsibleParticipantIds ?? []),
    payload.responsiblePersonId,
  ]);
  const responsibilityType =
    payload.responsibilityType ??
    (responsibleParticipantIds.length ? 'participant' : 'needsDiscussion');

  return {
    responsibilityType,
    responsibleParticipantIds:
      responsibilityType === 'needsDiscussion' ? [] : responsibleParticipantIds,
  };
}

function getStoredState(): TasksState {
  const storedState = readStorageSlice<Partial<TasksState> | null>(
    'tasks',
    null
  );

  if (!storedState) {
    return { tasks: [], agreements: [], reviewDecisions: [] };
  }

  return {
    tasks: Array.isArray(storedState.tasks)
      ? storedState.tasks
          .map(normalizeTask)
          .filter((task): task is Task => Boolean(task))
      : [],
    agreements: Array.isArray(storedState.agreements)
      ? storedState.agreements
          .map(normalizeAgreement)
          .filter((agreement): agreement is Agreement => Boolean(agreement))
      : [],
    reviewDecisions: Array.isArray(storedState.reviewDecisions)
      ? storedState.reviewDecisions
      : [],
  };
}

function sortByUpdatedDesc<T extends { updatedAt: string }>(items: T[]) {
  return [...items].sort((first, second) =>
    compareIsoDesc(first.updatedAt, second.updatedAt)
  );
}

export const useTasksStore = defineStore('tasks', {
  state: (): TasksState => getStoredState(),
  getters: {
    openTasks: (state) =>
      [...state.tasks]
        .filter((task) => task.status === 'open' && !task.deletedAt)
        .sort((first, second) => {
          if (first.dueDate && second.dueDate) {
            return first.dueDate.localeCompare(second.dueDate);
          }

          if (first.dueDate) {
            return -1;
          }

          if (second.dueDate) {
            return 1;
          }

          return compareIsoDesc(first.updatedAt, second.updatedAt);
        }),
    doneTasks: (state) =>
      sortByUpdatedDesc(
        state.tasks.filter((task) => task.status === 'done' && !task.deletedAt)
      ),
    skippedTasks: (state) =>
      sortByUpdatedDesc(
        state.tasks.filter(
          (task) => task.status === 'skipped' && !task.deletedAt
        )
      ),
    recentAgreements: (state) =>
      sortByUpdatedDesc(
        state.agreements.filter((agreement) => !agreement.deletedAt)
      ).slice(0, 8),
  },
  actions: {
    persist() {
      writeStorageSlice('tasks', {
        tasks: this.tasks,
        agreements: this.agreements,
        reviewDecisions: this.reviewDecisions,
      });
    },
    syncFromMeetings(meetings: Meeting[]) {
      let changed = false;

      for (const meeting of meetings) {
        if (meeting.deletedAt) {
          continue;
        }

        for (const section of meeting.sections) {
          for (const meetingTask of section.tasks) {
            if (this.tasks.some((task) => task.id === meetingTask.id)) {
              continue;
            }

            this.tasks.push({
              id: meetingTask.id,
              title: meetingTask.title,
              description: meetingTask.description,
              responsibilityType: meetingTask.responsibilityType,
              responsibleParticipantIds: meetingTask.responsibleParticipantIds,
              dueDate: meetingTask.dueDate,
              status: meetingTask.status,
              sourceMeetingId: meeting.id,
              carriedFromTaskId: meetingTask.carriedFromTaskId,
              createdAt: meetingTask.createdAt,
              updatedAt:
                meetingTask.completedAt ??
                meeting.updatedAt ??
                meetingTask.createdAt,
            });
            changed = true;
          }

          for (const meetingAgreement of section.agreements) {
            if (
              this.agreements.some(
                (agreement) => agreement.id === meetingAgreement.id
              )
            ) {
              continue;
            }

            this.agreements.push({
              id: meetingAgreement.id,
              title: meetingAgreement.text,
              participantIds: meetingAgreement.participantIds,
              sourceMeetingId: meeting.id,
              createdAt: meetingAgreement.createdAt,
              updatedAt: meetingAgreement.createdAt,
            });
            changed = true;
          }
        }
      }

      if (changed) {
        this.persist();
      }
    },
    addTask(payload: AddTaskPayload) {
      const title = payload.title.trim();
      const { responsibilityType, responsibleParticipantIds } =
        resolveTaskResponsibility(payload);

      if (
        !title ||
        (responsibilityType === 'participant' &&
          !responsibleParticipantIds.length)
      ) {
        return null;
      }

      const createdAt = payload.createdAt ?? nowIso();
      const task: Task = {
        id: payload.id ?? createId(),
        title,
        description: payload.description?.trim() || undefined,
        responsibilityType,
        responsibleParticipantIds,
        dueDate: payload.dueDate?.trim() || undefined,
        status: payload.status ?? 'open',
        sourceMeetingId: payload.sourceMeetingId,
        carriedFromTaskId: payload.carriedFromTaskId?.trim() || undefined,
        createdAt,
        updatedAt: payload.updatedAt ?? createdAt,
      };
      const existingIndex = this.tasks.findIndex((item) => item.id === task.id);

      if (existingIndex >= 0) {
        this.tasks.splice(existingIndex, 1, task);
      } else {
        this.tasks.unshift(task);
      }

      this.persist();
      return task;
    },
    updateTask(taskId: string, payload: UpdateTaskPayload) {
      const task = this.tasks.find((item) => item.id === taskId);

      if (!task || task.deletedAt) {
        return null;
      }

      const title = payload.title?.trim();
      const description = payload.description?.trim();
      const dueDate = payload.dueDate?.trim();

      if (title !== undefined) {
        if (!title) {
          return null;
        }

        task.title = title;
      }

      if (payload.description !== undefined) {
        task.description = description || undefined;
      }

      if (
        payload.responsibilityType !== undefined ||
        payload.responsibleParticipantIds !== undefined ||
        payload.responsiblePersonId !== undefined
      ) {
        const { responsibilityType, responsibleParticipantIds } =
          resolveTaskResponsibility(payload);

        if (
          responsibilityType === 'participant' &&
          !responsibleParticipantIds.length
        ) {
          return null;
        }

        task.responsibilityType = responsibilityType;
        task.responsibleParticipantIds = responsibleParticipantIds;
      }

      if (payload.dueDate !== undefined) {
        task.dueDate = dueDate || undefined;
      }

      if (payload.sourceMeetingId !== undefined) {
        task.sourceMeetingId = payload.sourceMeetingId;
      }

      task.updatedAt = nowIso();
      this.persist();
      return task;
    },
    updateTaskStatus(taskId: string, status: TaskStatus) {
      const task = this.tasks.find((item) => item.id === taskId);

      if (!task || task.deletedAt) {
        return;
      }

      task.status = status;
      task.updatedAt = nowIso();
      this.persist();
    },
    updateTasksFromMeeting(sourceMeetingId: string, status: TaskStatus) {
      const changedAt = nowIso();
      let changed = false;

      for (const task of this.tasks) {
        if (
          task.sourceMeetingId === sourceMeetingId &&
          task.status === 'open'
        ) {
          task.status = status;
          task.updatedAt = changedAt;
          changed = true;
        }
      }

      if (changed) {
        this.persist();
      }
    },
    deleteTask(taskId: string) {
      const task = this.tasks.find((item) => item.id === taskId);

      if (!task) {
        return;
      }

      if (appConfig.isBackendApiEnabled) {
        const deletedAt = nowIso();
        task.deletedAt = deletedAt;
        task.updatedAt = deletedAt;
        this.persist();
        return;
      }

      const originalLength = this.tasks.length;
      this.tasks = this.tasks.filter((item) => item.id !== taskId);

      if (this.tasks.length !== originalLength) {
        this.persist();
      }
    },
    deleteItemsForMeeting(sourceMeetingId: string) {
      const changedAt = nowIso();
      const originalReviewDecisionLength = this.reviewDecisions.length;
      let changed = false;

      if (appConfig.isBackendApiEnabled) {
        for (const task of this.tasks) {
          if (task.sourceMeetingId === sourceMeetingId && !task.deletedAt) {
            task.deletedAt = changedAt;
            task.updatedAt = changedAt;
            changed = true;
          }
        }

        for (const agreement of this.agreements) {
          if (
            agreement.sourceMeetingId === sourceMeetingId &&
            !agreement.deletedAt
          ) {
            agreement.deletedAt = changedAt;
            agreement.updatedAt = changedAt;
            changed = true;
          }
        }
      } else {
        const originalTaskLength = this.tasks.length;
        const originalAgreementLength = this.agreements.length;

        this.tasks = this.tasks.filter(
          (task) => task.sourceMeetingId !== sourceMeetingId
        );
        this.agreements = this.agreements.filter(
          (agreement) => agreement.sourceMeetingId !== sourceMeetingId
        );
        changed =
          this.tasks.length !== originalTaskLength ||
          this.agreements.length !== originalAgreementLength;
      }

      this.reviewDecisions = this.reviewDecisions.filter(
        (decision) =>
          decision.meetingId !== sourceMeetingId &&
          decision.sourceMeetingId !== sourceMeetingId
      );

      if (
        changed ||
        this.reviewDecisions.length !== originalReviewDecisionLength
      ) {
        this.persist();
      }
    },
    addAgreement(payload: AddAgreementPayload) {
      const title = payload.title.trim();

      if (!title || !payload.sourceMeetingId) {
        return null;
      }

      const createdAt = payload.createdAt ?? nowIso();
      const agreement: Agreement = {
        id: payload.id ?? createId(),
        title,
        description: payload.description?.trim() || undefined,
        participantIds: uniqueStrings(payload.participantIds),
        relatedTaskIds: payload.relatedTaskIds?.length
          ? payload.relatedTaskIds
          : undefined,
        sourceMeetingId: payload.sourceMeetingId,
        createdAt,
        updatedAt: payload.updatedAt ?? createdAt,
      };
      const existingIndex = this.agreements.findIndex(
        (item) => item.id === agreement.id
      );

      if (existingIndex >= 0) {
        this.agreements.splice(existingIndex, 1, agreement);
      } else {
        this.agreements.unshift(agreement);
      }

      this.persist();
      return agreement;
    },
    moveOpenTasksToMeeting(sourceMeetingId: string, targetMeetingId: string) {
      const changedAt = nowIso();
      const movedTasks: Task[] = [];

      for (const task of this.tasks) {
        if (
          task.sourceMeetingId !== sourceMeetingId ||
          task.status !== 'open' ||
          task.deletedAt
        ) {
          continue;
        }

        task.status = 'skipped';
        task.updatedAt = changedAt;

        const movedTask: Task = {
          ...task,
          id: createId(),
          status: 'open',
          sourceMeetingId: targetMeetingId,
          carriedFromTaskId: task.id,
          createdAt: changedAt,
          updatedAt: changedAt,
        };
        movedTasks.push(movedTask);
      }

      if (movedTasks.length) {
        this.tasks.unshift(...movedTasks);
        this.persist();
      }

      return movedTasks;
    },
    markReviewHandled(meetingId: string, sourceMeetingId: string) {
      const existingDecision = this.reviewDecisions.find(
        (decision) =>
          decision.meetingId === meetingId &&
          decision.sourceMeetingId === sourceMeetingId
      );

      if (existingDecision) {
        existingDecision.decidedAt = nowIso();
      } else {
        this.reviewDecisions.push({
          meetingId,
          sourceMeetingId,
          decidedAt: nowIso(),
        });
      }

      this.persist();
    },
    wasReviewHandled(meetingId: string, sourceMeetingId: string) {
      return this.reviewDecisions.some(
        (decision) =>
          decision.meetingId === meetingId &&
          decision.sourceMeetingId === sourceMeetingId
      );
    },
  },
});
