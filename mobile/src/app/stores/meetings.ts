import { defineStore } from 'pinia';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
import {
  readStorageSlice,
  writeStorageSlice,
} from '@/shared/services/storageService';
import {
  DEFAULT_MEETING_TEMPLATE_ID,
  getMeetingSectionPrompt,
  getMeetingSectionTitle,
  getMeetingTemplate,
  getMeetingTemplateName,
  taskSectionIds,
} from '@/features/meeting/meetingTemplates';
import { translate } from '@/features/localization/i18n';
import type { Task, TaskResponsibilityType } from '@/features/tasks/types';
import type {
  Agreement,
  Meeting,
  MeetingNote,
  MeetingSection,
  MeetingSectionId,
  MeetingSummary,
  MeetingSummaryTask,
  MeetingTask,
  MeetingTaskStatus,
  MeetingTemplate,
  MeetingTemplateId,
} from '@/features/meeting/types';

interface MeetingsState {
  meetings: Meeting[];
  activeMeetingId: string | null;
  draftSavedAt: string | null;
}

interface AddTaskPayload {
  title: string;
  description?: string;
  responsibilityType: TaskResponsibilityType;
  responsibleParticipantIds: string[];
  dueDate?: string;
}

interface UpdateTaskPayload {
  title?: string;
  description?: string;
  responsibilityType?: TaskResponsibilityType;
  responsibleParticipantIds?: string[];
  dueDate?: string;
}

interface LegacyParticipant {
  id?: string;
  name?: string;
}

interface LegacyMeetingSummaryTask {
  title?: string;
  description?: string;
  responsibilityType?: TaskResponsibilityType;
  responsibleParticipantIds?: string[];
  dueDate?: string;
  status?: MeetingTaskStatus;
}

interface LegacyMeetingSummary {
  id?: string;
  meetingId?: string;
  shortSummary?: string;
  mainTopics?: string[];
  keyTensions?: string[];
  agreements?: string[];
  tasks?: LegacyMeetingSummaryTask[];
  suggestedNextMeetingFocus?: string[];
  createdAt?: string;
}

interface LegacyMeetingTask {
  id?: string;
  sectionId?: MeetingSectionId;
  title?: string;
  description?: string;
  responsibilityType?: TaskResponsibilityType;
  responsibleParticipantIds?: string[];
  responsiblePersonId?: string;
  dueDate?: string;
  status?: MeetingTaskStatus;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

interface LegacyAgreement {
  id?: string;
  sectionId?: MeetingSectionId;
  text?: string;
  participantIds?: string[];
  createdAt?: string;
}

interface LegacyMeetingSection {
  id?: MeetingSectionId;
  title?: string;
  prompt?: string;
  notes?: MeetingNote[];
  tasks?: LegacyMeetingTask[];
  agreements?: LegacyAgreement[];
}

interface LegacyMeeting {
  id?: string;
  templateId?: MeetingTemplateId;
  title?: string;
  status?: Meeting['status'];
  participants?: LegacyParticipant[];
  participantIds?: string[];
  sections?: LegacyMeetingSection[];
  currentSectionIndex?: number;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  aiSummary?: LegacyMeetingSummary;
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function uniqueIds(ids: Array<string | undefined>) {
  return [...new Set(ids.filter((id): id is string => Boolean(id?.trim())))];
}

function getActiveParticipantIds() {
  const participantsStore = useParticipantsStore();
  participantsStore.ensureDefaultParticipants();
  return participantsStore.activeParticipants.map(
    (participant) => participant.id
  );
}

function createSections(template: MeetingTemplate): MeetingSection[] {
  return template.sections.map((section) => ({
    ...section,
    title: getMeetingSectionTitle(section.id, section.title),
    prompt: getMeetingSectionPrompt(section.id, section.prompt),
    notes: [],
    tasks: [],
    agreements: [],
  }));
}

function createDefaultMeeting(
  participantIds: string[],
  templateId: MeetingTemplateId = DEFAULT_MEETING_TEMPLATE_ID
): Meeting {
  const template = getMeetingTemplate(templateId);
  const createdAt = nowIso();

  return {
    id: createId('meeting'),
    templateId: template.id,
    title: getMeetingTemplateName(template.id, template.name),
    status: 'in_progress',
    participantIds,
    sections: createSections(template),
    currentSectionIndex: 0,
    createdAt,
    updatedAt: createdAt,
  };
}

function normalizeMeetingTask(
  task: LegacyMeetingTask,
  sectionId: MeetingSectionId
): MeetingTask | null {
  const title = task.title?.trim();

  if (!title) {
    return null;
  }

  const responsibleParticipantIds = uniqueIds([
    ...(task.responsibleParticipantIds ?? []),
    task.responsiblePersonId,
  ]);
  const responsibilityType =
    task.responsibilityType ??
    (responsibleParticipantIds.length ? 'participant' : 'needsDiscussion');
  const createdAt = task.createdAt ?? nowIso();

  return {
    id: task.id ?? createId('task'),
    sectionId,
    title,
    description: task.description?.trim() || undefined,
    responsibilityType,
    responsibleParticipantIds:
      responsibilityType === 'needsDiscussion' ? [] : responsibleParticipantIds,
    dueDate: task.dueDate?.trim() || undefined,
    status: task.status ?? 'open',
    createdAt,
    updatedAt: task.updatedAt ?? createdAt,
    completedAt: task.completedAt,
  };
}

function normalizeMeetingSummaryTask(
  task: LegacyMeetingSummaryTask
): MeetingSummaryTask | null {
  const title = task.title?.trim();

  if (!title) {
    return null;
  }

  const responsibilityType = task.responsibilityType ?? 'needsDiscussion';

  return {
    title,
    description: task.description?.trim() || undefined,
    responsibilityType,
    responsibleParticipantIds:
      responsibilityType === 'needsDiscussion'
        ? []
        : uniqueIds(task.responsibleParticipantIds ?? []),
    dueDate: task.dueDate?.trim() || undefined,
    status: task.status ?? 'open',
  };
}

function normalizeStringList(items?: string[]) {
  return Array.isArray(items)
    ? items.map((item) => item.trim()).filter(Boolean)
    : [];
}

function normalizeMeetingSummary(
  summary: LegacyMeetingSummary | undefined,
  meetingId: string
): MeetingSummary | undefined {
  const id = summary?.id?.trim();
  const shortSummary = summary?.shortSummary?.trim();
  const createdAt = summary?.createdAt;

  if (!summary || !id || !shortSummary || !createdAt) {
    return undefined;
  }

  return {
    id,
    meetingId,
    shortSummary,
    mainTopics: normalizeStringList(summary.mainTopics),
    keyTensions: normalizeStringList(summary.keyTensions),
    agreements: normalizeStringList(summary.agreements),
    tasks:
      summary.tasks
        ?.map(normalizeMeetingSummaryTask)
        .filter((task): task is MeetingSummaryTask => Boolean(task)) ?? [],
    suggestedNextMeetingFocus: normalizeStringList(
      summary.suggestedNextMeetingFocus
    ),
    createdAt,
  };
}

function normalizeAgreement(
  agreement: LegacyAgreement,
  sectionId: MeetingSectionId,
  fallbackParticipantIds: string[]
): Agreement | null {
  const text = agreement.text?.trim();

  if (!text) {
    return null;
  }

  return {
    id: agreement.id ?? createId('agreement'),
    sectionId,
    text,
    participantIds: agreement.participantIds?.length
      ? uniqueIds(agreement.participantIds)
      : fallbackParticipantIds,
    createdAt: agreement.createdAt ?? nowIso(),
  };
}

function normalizeMeeting(meeting: LegacyMeeting): Meeting | null {
  const createdAt = meeting.createdAt ?? nowIso();
  const id = meeting.id ?? createId('meeting');
  const template = getMeetingTemplate(meeting.templateId);
  const participantIds = uniqueIds([
    ...(meeting.participantIds ?? []),
    ...(meeting.participants ?? []).map((participant) => participant.id),
  ]);
  const sections = template.sections.map((sectionTemplate) => {
    const section = meeting.sections?.find(
      (item) => item.id === sectionTemplate.id
    );

    return {
      ...sectionTemplate,
      title: getMeetingSectionTitle(sectionTemplate.id, section?.title),
      prompt: getMeetingSectionPrompt(sectionTemplate.id, section?.prompt),
      notes: section?.notes ?? [],
      tasks:
        section?.tasks
          ?.map((task) => normalizeMeetingTask(task, sectionTemplate.id))
          .filter((task): task is MeetingTask => Boolean(task)) ?? [],
      agreements:
        section?.agreements
          ?.map((agreement) =>
            normalizeAgreement(agreement, sectionTemplate.id, participantIds)
          )
          .filter((agreement): agreement is Agreement => Boolean(agreement)) ??
        [],
    };
  });

  return {
    id,
    templateId: template.id,
    title: meeting.title?.trim() || getMeetingTemplateName(template.id),
    status: meeting.status ?? 'in_progress',
    participantIds,
    sections,
    currentSectionIndex: Math.min(
      Math.max(meeting.currentSectionIndex ?? 0, 0),
      sections.length - 1
    ),
    createdAt,
    updatedAt: meeting.updatedAt ?? createdAt,
    completedAt: meeting.completedAt,
    aiSummary: normalizeMeetingSummary(meeting.aiSummary, id),
  };
}

function getStoredState(): MeetingsState {
  const storedState = readStorageSlice<Partial<{
    meetings: LegacyMeeting[];
    activeMeetingId: string | null;
    draftSavedAt: string | null;
  }> | null>('meetings', null);

  if (!storedState) {
    return { meetings: [], activeMeetingId: null, draftSavedAt: null };
  }

  return {
    meetings: Array.isArray(storedState.meetings)
      ? storedState.meetings
          .map(normalizeMeeting)
          .filter((meeting): meeting is Meeting => Boolean(meeting))
      : [],
    activeMeetingId: storedState.activeMeetingId ?? null,
    draftSavedAt: storedState.draftSavedAt ?? null,
  };
}

function findSection(meeting: Meeting, sectionId: MeetingSectionId) {
  return meeting.sections.find((section) => section.id === sectionId);
}

function findTaskTargetSection(meeting: Meeting) {
  return (
    findSection(meeting, 'tasks') ??
    meeting.sections.find((section) => taskSectionIds.includes(section.id))
  );
}

function findTask(meetings: Meeting[], taskId: string) {
  for (const meeting of meetings) {
    for (const section of meeting.sections) {
      const task = section.tasks.find((item) => item.id === taskId);

      if (task) {
        return { meeting, task };
      }
    }
  }

  return null;
}

function meetingHasContent(meeting: Meeting) {
  return meeting.sections.some(
    (section) =>
      section.notes.length > 0 ||
      section.tasks.length > 0 ||
      section.agreements.length > 0
  );
}

function syncMeetingParticipants(meeting: Meeting) {
  const activeIds = getActiveParticipantIds();
  const nextParticipantIds = uniqueIds([
    ...meeting.participantIds,
    ...activeIds,
  ]);

  if (nextParticipantIds.length === meeting.participantIds.length) {
    return false;
  }

  meeting.participantIds = nextParticipantIds;
  meeting.updatedAt = nowIso();
  return true;
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
      writeStorageSlice('meetings', {
        meetings: this.meetings,
        activeMeetingId: this.activeMeetingId,
        draftSavedAt: this.draftSavedAt,
      });
    },
    ensureActiveMeeting() {
      const activeMeeting = this.activeMeeting;

      if (activeMeeting && activeMeeting.status !== 'completed') {
        if (syncMeetingParticipants(activeMeeting)) {
          this.persist();
        }

        return activeMeeting;
      }

      const existingDraft = this.meetings.find(
        (meeting) => meeting.status !== 'completed'
      );

      if (existingDraft) {
        this.activeMeetingId = existingDraft.id;
        syncMeetingParticipants(existingDraft);
        this.persist();
        return existingDraft;
      }

      const meeting = createDefaultMeeting(getActiveParticipantIds());
      this.meetings.unshift(meeting);
      this.activeMeetingId = meeting.id;
      this.persist();
      return meeting;
    },
    startNewMeeting(
      templateId: MeetingTemplateId = DEFAULT_MEETING_TEMPLATE_ID
    ) {
      const meeting = createDefaultMeeting(
        getActiveParticipantIds(),
        templateId
      );
      this.meetings.unshift(meeting);
      this.activeMeetingId = meeting.id;
      this.draftSavedAt = null;
      this.persist();
      return meeting;
    },
    startNewMeetingFromTemplate(templateId: MeetingTemplateId) {
      return this.startNewMeeting(templateId);
    },
    resumeMeeting(meetingId: string) {
      const meeting = this.meetings.find((item) => item.id === meetingId);

      if (!meeting || meeting.status === 'completed') {
        return null;
      }

      this.activeMeetingId = meeting.id;
      syncMeetingParticipants(meeting);
      meeting.status = 'in_progress';
      meeting.updatedAt = nowIso();
      this.persist();
      return meeting;
    },
    deleteDraftMeeting(meetingId: string) {
      const meeting = this.meetings.find((item) => item.id === meetingId);

      if (!meeting || meeting.status === 'completed') {
        return false;
      }

      this.meetings = this.meetings.filter((item) => item.id !== meetingId);

      if (this.activeMeetingId === meetingId) {
        this.activeMeetingId = null;
      }

      if (!this.meetings.some((item) => item.status !== 'completed')) {
        this.draftSavedAt = null;
      }

      useTasksStore().deleteItemsForMeeting(meetingId);
      this.persist();
      return true;
    },
    syncActiveMeetingParticipants() {
      const meeting = this.activeMeeting;

      if (!meeting) {
        return;
      }

      if (syncMeetingParticipants(meeting)) {
        this.persist();
      }
    },
    setActiveMeetingParticipants(participantIds: string[]) {
      const meeting = this.activeMeeting;

      if (!meeting) {
        return;
      }

      const activeParticipantIds = new Set(getActiveParticipantIds());
      const selectedParticipantIds = uniqueIds(participantIds).filter(
        (participantId) => activeParticipantIds.has(participantId)
      );

      if (!selectedParticipantIds.length) {
        return;
      }

      meeting.participantIds = selectedParticipantIds;
      meeting.updatedAt = nowIso();
      this.persist();
    },
    setCurrentSection(index: number) {
      const meeting = this.activeMeeting;

      if (!meeting) {
        return;
      }

      meeting.currentSectionIndex = Math.min(
        Math.max(index, 0),
        meeting.sections.length - 1
      );
      meeting.status = 'in_progress';
      meeting.updatedAt = nowIso();
      this.persist();
    },
    addNote(
      sectionId: MeetingSectionId,
      participantId: string,
      text: string
    ): string | null {
      const meeting = this.activeMeeting;
      const section = meeting ? findSection(meeting, sectionId) : undefined;
      const trimmedText = text.trim();

      if (!meeting || !section) {
        return translate('meetingStore.openBeforeNote');
      }

      if (!trimmedText) {
        return translate('meetingStore.addShortNote');
      }

      if (!meeting.participantIds.includes(participantId)) {
        return translate('meetingStore.chooseNoteAuthor');
      }

      const note: MeetingNote = {
        id: createId('note'),
        sectionId,
        participantId,
        text: trimmedText,
        createdAt: nowIso(),
      };

      section.notes.push(note);
      meeting.updatedAt = nowIso();
      this.persist();
      return null;
    },
    addTask(
      sectionId: MeetingSectionId,
      payload: AddTaskPayload
    ): string | null {
      const meeting = this.activeMeeting;
      const section = meeting ? findSection(meeting, sectionId) : undefined;
      const title = payload.title.trim();
      const description = payload.description?.trim();
      const dueDate = payload.dueDate?.trim();
      const responsibilityType = payload.responsibilityType;
      const responsibleParticipantIds =
        responsibilityType === 'needsDiscussion'
          ? []
          : uniqueIds(payload.responsibleParticipantIds);

      if (!meeting || !section) {
        return translate('meetingStore.openBeforeTask');
      }

      if (!title) {
        return translate('meetingStore.taskTitleRequired');
      }

      if (
        responsibilityType === 'participant' &&
        !responsibleParticipantIds.length
      ) {
        return translate('meetingStore.chooseResponsible');
      }

      if (
        responsibleParticipantIds.some(
          (participantId) => !meeting.participantIds.includes(participantId)
        )
      ) {
        return translate('meetingStore.chooseFromMeeting');
      }

      const createdAt = nowIso();
      const task: MeetingTask = {
        id: createId('task'),
        sectionId,
        title,
        description: description || undefined,
        responsibilityType,
        responsibleParticipantIds,
        dueDate: dueDate || undefined,
        status: 'open',
        createdAt,
        updatedAt: createdAt,
      };

      section.tasks.push(task);
      meeting.updatedAt = createdAt;
      useTasksStore().addTask({ ...task, sourceMeetingId: meeting.id });
      this.persist();
      return null;
    },
    updateTaskStatus(taskId: string, status: MeetingTaskStatus) {
      const found = findTask(this.meetings, taskId);

      if (!found) {
        return;
      }

      const updatedAt = nowIso();
      found.task.status = status;
      found.task.updatedAt = updatedAt;
      found.task.completedAt = status === 'done' ? updatedAt : undefined;
      found.meeting.updatedAt = updatedAt;
      useTasksStore().updateTaskStatus(taskId, status);
      this.persist();
    },
    updateTaskDetails(taskId: string, payload: UpdateTaskPayload) {
      const found = findTask(this.meetings, taskId);

      if (!found) {
        return;
      }

      const title = payload.title?.trim();
      const description = payload.description?.trim();
      const dueDate = payload.dueDate?.trim();

      if (title !== undefined) {
        if (!title) {
          return;
        }

        found.task.title = title;
      }

      if (payload.description !== undefined) {
        found.task.description = description || undefined;
      }

      if (
        payload.responsibilityType !== undefined ||
        payload.responsibleParticipantIds !== undefined
      ) {
        const responsibilityType =
          payload.responsibilityType ?? found.task.responsibilityType;
        const responsibleParticipantIds =
          responsibilityType === 'needsDiscussion'
            ? []
            : uniqueIds(payload.responsibleParticipantIds ?? []);

        if (
          responsibilityType === 'participant' &&
          !responsibleParticipantIds.length
        ) {
          return;
        }

        found.task.responsibilityType = responsibilityType;
        found.task.responsibleParticipantIds = responsibleParticipantIds;
      }

      if (payload.dueDate !== undefined) {
        found.task.dueDate = dueDate || undefined;
      }

      const updatedAt = nowIso();
      found.task.updatedAt = updatedAt;
      found.meeting.updatedAt = updatedAt;
      this.persist();
    },
    updateTasksFromMeeting(sourceMeetingId: string, status: MeetingTaskStatus) {
      const meeting = this.meetings.find((item) => item.id === sourceMeetingId);

      if (!meeting) {
        return;
      }

      const updatedAt = nowIso();
      let changed = false;

      for (const task of meeting.sections.flatMap((section) => section.tasks)) {
        if (task.status !== 'open') {
          continue;
        }

        task.status = status;
        task.updatedAt = updatedAt;
        task.completedAt = status === 'done' ? updatedAt : undefined;
        changed = true;
      }

      if (changed) {
        meeting.updatedAt = updatedAt;
        this.persist();
      }
    },
    addMovedTasksToMeeting(
      sourceMeetingId: string,
      targetMeetingId: string,
      movedTasks: Task[]
    ) {
      const sourceMeeting = this.meetings.find(
        (meeting) => meeting.id === sourceMeetingId
      );
      const targetMeeting = this.meetings.find(
        (meeting) => meeting.id === targetMeetingId
      );
      const targetSection = targetMeeting
        ? findTaskTargetSection(targetMeeting)
        : undefined;

      if (
        !sourceMeeting ||
        !targetMeeting ||
        !targetSection ||
        !movedTasks.length
      ) {
        return;
      }

      const updatedAt = nowIso();
      const movedTaskIds = new Set(movedTasks.map((task) => task.id));

      for (const task of sourceMeeting.sections.flatMap(
        (section) => section.tasks
      )) {
        if (task.status === 'open') {
          task.status = 'skipped';
          task.updatedAt = updatedAt;
        }
      }

      for (const task of movedTasks) {
        if (
          movedTaskIds.has(task.id) &&
          !targetSection.tasks.some((item) => item.id === task.id)
        ) {
          targetSection.tasks.push({
            id: task.id,
            sectionId: targetSection.id,
            title: task.title,
            description: task.description,
            responsibilityType: task.responsibilityType,
            responsibleParticipantIds: task.responsibleParticipantIds,
            dueDate: task.dueDate,
            status: task.status,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
          });
        }
      }

      sourceMeeting.updatedAt = updatedAt;
      targetMeeting.updatedAt = updatedAt;
      this.persist();
    },
    deleteTask(taskId: string) {
      let changed = false;

      for (const meeting of this.meetings) {
        for (const section of meeting.sections) {
          const nextTasks = section.tasks.filter((task) => task.id !== taskId);

          if (nextTasks.length !== section.tasks.length) {
            section.tasks = nextTasks;
            meeting.updatedAt = nowIso();
            changed = true;
          }
        }
      }

      if (changed) {
        this.persist();
      }
    },
    addAgreement(
      sectionId: MeetingSectionId,
      text: string,
      participantIds: string[]
    ): string | null {
      const meeting = this.activeMeeting;
      const section = meeting ? findSection(meeting, sectionId) : undefined;
      const trimmedText = text.trim();
      const selectedParticipantIds = uniqueIds(participantIds);

      if (!meeting || !section) {
        return translate('meetingStore.openBeforeAgreement');
      }

      if (!trimmedText) {
        return translate('meetingStore.addAgreementFirst');
      }

      if (!selectedParticipantIds.length) {
        return translate('meetingStore.chooseAgreementPeople');
      }

      if (
        selectedParticipantIds.some(
          (participantId) => !meeting.participantIds.includes(participantId)
        )
      ) {
        return translate('meetingStore.choosePeopleFromMeeting');
      }

      const createdAt = nowIso();
      const agreement: Agreement = {
        id: createId('agreement'),
        sectionId,
        text: trimmedText,
        participantIds: selectedParticipantIds,
        createdAt,
      };

      section.agreements.push(agreement);
      meeting.updatedAt = createdAt;
      useTasksStore().addAgreement({
        id: agreement.id,
        title: trimmedText,
        participantIds: selectedParticipantIds,
        relatedTaskIds: meeting.sections.flatMap((item) =>
          item.tasks.map((task) => task.id)
        ),
        sourceMeetingId: meeting.id,
        createdAt,
        updatedAt: createdAt,
      });
      this.persist();
      return null;
    },
    saveAiSummary(meetingId: string, summary: MeetingSummary) {
      const meeting = this.meetings.find((item) => item.id === meetingId);

      if (!meeting || summary.meetingId !== meetingId) {
        return;
      }

      meeting.aiSummary = summary;
      meeting.updatedAt = nowIso();
      this.persist();
    },
    saveDraft() {
      const meeting = this.activeMeeting;

      if (!meeting) {
        return;
      }

      const savedAt = nowIso();
      meeting.status = 'draft';
      meeting.updatedAt = savedAt;
      this.draftSavedAt = savedAt;
      this.persist();
    },
    pauseMeeting() {
      const meeting = this.activeMeeting;

      if (!meeting || meeting.status === 'completed') {
        return false;
      }

      const pausedAt = nowIso();
      meeting.status = 'paused';
      meeting.updatedAt = pausedAt;
      this.draftSavedAt = pausedAt;
      this.persist();
      return true;
    },
    resumeActiveMeeting() {
      const meeting = this.activeMeeting;

      if (!meeting || meeting.status === 'completed') {
        return false;
      }

      meeting.status = 'in_progress';
      meeting.updatedAt = nowIso();
      this.persist();
      return true;
    },
    endMeetingIncomplete() {
      const meeting = this.activeMeeting;

      if (!meeting || meeting.status === 'completed') {
        return false;
      }

      const endedAt = nowIso();
      meeting.status = 'incomplete';
      meeting.updatedAt = endedAt;
      this.draftSavedAt = endedAt;
      this.persist();
      return true;
    },
    finishMeeting(): string | null {
      const meeting = this.activeMeeting;

      if (!meeting) {
        return translate('meetingStore.openBeforeFinish');
      }

      if (!meetingHasContent(meeting)) {
        return translate('meeting.atLeastOne');
      }

      const completedAt = nowIso();
      meeting.status = 'completed';
      meeting.completedAt = completedAt;
      meeting.updatedAt = completedAt;
      meeting.currentSectionIndex = meeting.sections.length - 1;
      this.draftSavedAt = null;
      this.persist();
      return null;
    },
  },
});
