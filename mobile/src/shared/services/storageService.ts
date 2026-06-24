import { shallowRef } from 'vue';
import { Preferences } from '@capacitor/preferences';
import { translate } from '@/features/localization/i18n';
import { nowIso } from '@/shared/utils/dates';
import { createId, isUuid } from '@/shared/utils/ids';

export const appDataVersion = 5;

const APP_DATA_STORAGE_KEY = 'ourweek:app-data';
const BACKUP_STORAGE_PREFIX = 'ourweek:app-data:backup';
const SETTINGS_STORAGE_KEY = 'ourweek:settings';

const legacyStorageKeys = {
  auth: 'ourweek:auth',
  calendarSyncSettings: 'ourweek:calendar-sync-settings',
  meetings: 'ourweek:meetings',
  participants: 'ourweek:participants',
  privateNotes: 'ourweek:private-notes',
  reminderSettings: 'ourweek:reminder-settings',
  tasks: 'ourweek:tasks-agreements',
  workspace: 'ourweek:workspace',
} as const;

type TopLevelStorageSliceKey =
  | 'participants'
  | 'meetings'
  | 'tasks'
  | 'privateNotes'
  | 'syncMetadata';

export type SyncStorageResource = 'meetings' | 'tasks' | 'participants';

interface SyncResourceMetadata {
  lastSyncedAt?: string;
  lastAttemptedAt?: string;
  lastSuccessfulAt?: string;
  lastFailedAt?: string;
  conflictCount?: number;
}

interface SyncStorageMetadata {
  version: 1;
  resources: Partial<Record<SyncStorageResource, SyncResourceMetadata>>;
  firstBackupKey?: string;
  migratedAt?: string;
  ownerUserId?: string;
  ownerWorkspaceId?: string;
  lastOwnerCheckedAt?: string;
}

type SettingsStorageSliceKey =
  | 'calendarSync'
  | 'localization'
  | 'reminders'
  | 'workspace';
type OnboardingStorageSliceKey = 'auth';

interface AppDataSettings {
  calendarSync: unknown;
  localization: unknown;
  reminders: unknown;
  workspace: unknown;
}

interface AppDataOnboarding {
  auth: unknown;
}

export interface AppDataEnvelope {
  appDataVersion: typeof appDataVersion;
  participants: unknown;
  meetings: unknown;
  tasks: unknown;
  privateNotes: unknown;
  syncMetadata: unknown;
  settings: AppDataSettings;
  onboarding: AppDataOnboarding;
  updatedAt: string;
}

interface StorageRecoveryState {
  hasIssue: boolean;
  messages: string[];
  backupKeys: string[];
}

type MigrationInput = Record<string, unknown>;
type Migration = (data: MigrationInput) => MigrationInput;

export const storageRecoveryState = shallowRef<StorageRecoveryState>({
  hasIssue: false,
  messages: [],
  backupKeys: [],
});

let cachedAppData: AppDataEnvelope | null = null;
let cachedSettingsData: AppDataSettings | null = null;
let hasInitializedSettingsStorage = false;
let hasReportedBlockedStorage = false;

const migrations: Record<number, Migration> = {
  1: migrateAppDataFromVersion1ToVersion2,
  2: migrateAppDataFromVersion2ToVersion3,
  3: migrateAppDataFromVersion3ToVersion4,
  4: migrateAppDataFromVersion4ToVersion5,
};

function getLocalStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    if (!hasReportedBlockedStorage) {
      hasReportedBlockedStorage = true;
      addRecoveryMessage(translate('storage.blocked'));
    }

    return null;
  }
}

function canUseLocalStorage() {
  return Boolean(getLocalStorage());
}

function createEmptyAppData(): AppDataEnvelope {
  return {
    appDataVersion,
    participants: null,
    meetings: null,
    tasks: null,
    privateNotes: null,
    syncMetadata: null,
    settings: {
      calendarSync: null,
      localization: null,
      reminders: null,
      workspace: null,
    },
    onboarding: {
      auth: null,
    },
    updatedAt: nowIso(),
  };
}

function createEmptySettingsData(): AppDataSettings {
  return {
    calendarSync: null,
    localization: null,
    reminders: null,
    workspace: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function removeAuthTokenFields(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const { accessToken, refreshToken, ...safeState } = value;

  void accessToken;
  void refreshToken;

  return safeState;
}

function removeStoredAuthTokenFields(data: AppDataEnvelope): AppDataEnvelope {
  return {
    ...data,
    onboarding: {
      ...data.onboarding,
      auth: removeAuthTokenFields(data.onboarding.auth),
    },
  };
}

function sanitizeRawAppDataBackup(rawValue: string) {
  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    const migratedData = migrateAppData(parsedValue);

    if (!migratedData) {
      return null;
    }

    return JSON.stringify(removeStoredAuthTokenFields(migratedData));
  } catch {
    return null;
  }
}

function parseJsonValue(value: string, label: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    addRecoveryMessage(translate('storage.parseFailed', { label }));
    return null;
  }
}

function readLegacyJson(key: keyof typeof legacyStorageKeys) {
  if (!canUseLocalStorage()) {
    return null;
  }

  const storage = getLocalStorage();
  let rawValue: string | null | undefined;

  try {
    rawValue = storage?.getItem(legacyStorageKeys[key]);
  } catch {
    addRecoveryMessage(translate('storage.accessFailed', { label: key }));
    return null;
  }

  if (!rawValue) {
    return null;
  }

  return parseJsonValue(rawValue, key);
}

function createBackupKey(reason: string) {
  return `${BACKUP_STORAGE_PREFIX}:${reason}:${Date.now()}`;
}

function addRecoveryMessage(message: string, backupKey?: string) {
  const current = storageRecoveryState.value;

  storageRecoveryState.value = {
    hasIssue: true,
    messages: current.messages.includes(message)
      ? current.messages
      : [...current.messages, message],
    backupKeys:
      backupKey && !current.backupKeys.includes(backupKey)
        ? [...current.backupKeys, backupKey]
        : current.backupKeys,
  };
}

function backupRawAppData(rawValue: string, reason: string) {
  if (!canUseLocalStorage()) {
    return undefined;
  }

  const safeRawValue = sanitizeRawAppDataBackup(rawValue);

  if (!safeRawValue) {
    return undefined;
  }

  const backupKey = createBackupKey(reason);

  try {
    getLocalStorage()?.setItem(
      backupKey,
      JSON.stringify({
        reason,
        backedUpAt: nowIso(),
        storageKey: APP_DATA_STORAGE_KEY,
        rawValue: safeRawValue,
      })
    );
    return backupKey;
  } catch {
    return undefined;
  }
}

function validateAppDataEnvelope(value: unknown): AppDataEnvelope | null {
  if (!isRecord(value) || value.appDataVersion !== appDataVersion) {
    return null;
  }

  const settings = getRecord(value.settings);
  const onboarding = getRecord(value.onboarding);

  return {
    appDataVersion,
    participants: value.participants ?? null,
    meetings: value.meetings ?? null,
    tasks: value.tasks ?? null,
    privateNotes: value.privateNotes ?? null,
    syncMetadata: value.syncMetadata ?? null,
    settings: {
      calendarSync: settings.calendarSync ?? null,
      localization: settings.localization ?? null,
      reminders: settings.reminders ?? null,
      workspace: settings.workspace ?? null,
    },
    onboarding: {
      auth: onboarding.auth ?? null,
    },
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : nowIso(),
  };
}

function migrateAppDataFromVersion1ToVersion2(
  data: MigrationInput
): MigrationInput {
  const settings = getRecord(data.settings);
  const onboarding = getRecord(data.onboarding);

  return {
    appDataVersion: 2,
    participants: data.participants ?? null,
    meetings: data.meetings ?? null,
    tasks: data.tasks ?? null,
    privateNotes: data.privateNotes ?? null,
    settings: {
      calendarSync: data.calendarSyncSettings ?? settings.calendarSync ?? null,
      localization: settings.localization ?? null,
      reminders: data.reminderSettings ?? settings.reminders ?? null,
      workspace: data.workspace ?? settings.workspace ?? null,
    },
    onboarding: {
      auth: data.auth ?? onboarding.auth ?? null,
    },
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
  };
}

function migrateAppDataFromVersion2ToVersion3(
  data: MigrationInput
): MigrationInput {
  return {
    ...data,
    appDataVersion: 3,
  };
}

function remapId(value: unknown, idMap: Map<string, string>) {
  if (typeof value !== 'string' || isUuid(value)) {
    return typeof value === 'string' ? value : '';
  }

  const existingId = idMap.get(value);

  if (existingId) {
    return existingId;
  }

  const nextId = createId();
  idMap.set(value, nextId);
  return nextId;
}

function remapIdList(value: unknown, idMap: Map<string, string>) {
  return Array.isArray(value)
    ? value
        .map((item) => remapId(item, idMap))
        .filter((item) => Boolean(item.trim()))
    : [];
}

function remapParticipants(value: unknown, idMap: Map<string, string>) {
  const state = getRecord(value);
  const participants = Array.isArray(state.participants)
    ? state.participants.map((participant) => {
        const item = getRecord(participant);

        return {
          ...item,
          id: remapId(item.id, idMap),
        };
      })
    : state.participants;

  return {
    ...state,
    participants,
  };
}

function remapMeetingSections(
  value: unknown,
  idMap: Map<string, string>
): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((section) => {
    const item = getRecord(section);

    return {
      ...item,
      notes: Array.isArray(item.notes)
        ? item.notes.map((note) => {
            const noteItem = getRecord(note);

            return {
              ...noteItem,
              id: remapId(noteItem.id, idMap),
              participantId: remapId(noteItem.participantId, idMap),
            };
          })
        : item.notes,
      tasks: Array.isArray(item.tasks)
        ? item.tasks.map((task) => {
            const taskItem = getRecord(task);

            return {
              ...taskItem,
              id: remapId(taskItem.id, idMap),
              responsibleParticipantIds: remapIdList(
                taskItem.responsibleParticipantIds,
                idMap
              ),
              responsiblePersonId:
                typeof taskItem.responsiblePersonId === 'string'
                  ? remapId(taskItem.responsiblePersonId, idMap)
                  : taskItem.responsiblePersonId,
            };
          })
        : item.tasks,
      agreements: Array.isArray(item.agreements)
        ? item.agreements.map((agreement) => {
            const agreementItem = getRecord(agreement);

            return {
              ...agreementItem,
              id: remapId(agreementItem.id, idMap),
              participantIds: remapIdList(agreementItem.participantIds, idMap),
            };
          })
        : item.agreements,
    };
  });
}

function remapMeetings(value: unknown, idMap: Map<string, string>) {
  const state = getRecord(value);
  const meetings = Array.isArray(state.meetings)
    ? state.meetings.map((meeting) => {
        const item = getRecord(meeting);
        const meetingId = remapId(item.id, idMap);
        const summary = getRecord(item.aiSummary);

        return {
          ...item,
          id: meetingId,
          participantIds: remapIdList(item.participantIds, idMap),
          participants: Array.isArray(item.participants)
            ? item.participants.map((participant) => {
                const participantItem = getRecord(participant);

                return {
                  ...participantItem,
                  id: remapId(participantItem.id, idMap),
                };
              })
            : item.participants,
          sections: remapMeetingSections(item.sections, idMap),
          aiSummary: item.aiSummary
            ? {
                ...summary,
                id: remapId(summary.id, idMap),
                meetingId,
              }
            : item.aiSummary,
        };
      })
    : state.meetings;

  return {
    ...state,
    meetings,
    activeMeetingId:
      typeof state.activeMeetingId === 'string'
        ? remapId(state.activeMeetingId, idMap)
        : state.activeMeetingId,
  };
}

function remapTasks(value: unknown, idMap: Map<string, string>) {
  const state = getRecord(value);

  return {
    ...state,
    tasks: Array.isArray(state.tasks)
      ? state.tasks.map((task) => {
          const item = getRecord(task);

          return {
            ...item,
            id: remapId(item.id, idMap),
            responsibleParticipantIds: remapIdList(
              item.responsibleParticipantIds,
              idMap
            ),
            responsiblePersonId:
              typeof item.responsiblePersonId === 'string'
                ? remapId(item.responsiblePersonId, idMap)
                : item.responsiblePersonId,
            sourceMeetingId:
              typeof item.sourceMeetingId === 'string'
                ? remapId(item.sourceMeetingId, idMap)
                : item.sourceMeetingId,
          };
        })
      : state.tasks,
    agreements: Array.isArray(state.agreements)
      ? state.agreements.map((agreement) => {
          const item = getRecord(agreement);

          return {
            ...item,
            id: remapId(item.id, idMap),
            participantIds: remapIdList(item.participantIds, idMap),
            participants: remapIdList(item.participants, idMap),
            relatedTaskIds: remapIdList(item.relatedTaskIds, idMap),
            sourceMeetingId:
              typeof item.sourceMeetingId === 'string'
                ? remapId(item.sourceMeetingId, idMap)
                : item.sourceMeetingId,
          };
        })
      : state.agreements,
    reviewDecisions: Array.isArray(state.reviewDecisions)
      ? state.reviewDecisions.map((decision) => {
          const item = getRecord(decision);

          return {
            ...item,
            meetingId:
              typeof item.meetingId === 'string'
                ? remapId(item.meetingId, idMap)
                : item.meetingId,
            sourceMeetingId:
              typeof item.sourceMeetingId === 'string'
                ? remapId(item.sourceMeetingId, idMap)
                : item.sourceMeetingId,
          };
        })
      : state.reviewDecisions,
  };
}

function remapPrivateNotes(value: unknown, idMap: Map<string, string>) {
  const state = getRecord(value);

  return {
    ...state,
    notes: Array.isArray(state.notes)
      ? state.notes.map((note) => {
          const item = getRecord(note);

          return {
            ...item,
            relatedMeetingId:
              typeof item.relatedMeetingId === 'string'
                ? remapId(item.relatedMeetingId, idMap)
                : item.relatedMeetingId,
          };
        })
      : state.notes,
  };
}

function migrateAppDataFromVersion3ToVersion4(
  data: MigrationInput
): MigrationInput {
  const idMap = new Map<string, string>();

  return {
    ...data,
    appDataVersion: 4,
    participants: remapParticipants(data.participants, idMap),
    meetings: remapMeetings(data.meetings, idMap),
    tasks: remapTasks(data.tasks, idMap),
    privateNotes: remapPrivateNotes(data.privateNotes, idMap),
    syncMetadata: {
      version: 1,
      resources: {},
      migratedAt: nowIso(),
    },
  };
}

function getLegacyTaskSignature(task: Record<string, unknown>) {
  const responsibleParticipantIds = Array.isArray(
    task.responsibleParticipantIds
  )
    ? task.responsibleParticipantIds
        .filter((item): item is string => typeof item === 'string')
        .sort()
    : [];

  return JSON.stringify([
    typeof task.title === 'string' ? task.title : '',
    typeof task.description === 'string' ? task.description : '',
    typeof task.responsibilityType === 'string' ? task.responsibilityType : '',
    responsibleParticipantIds,
    typeof task.dueDate === 'string' ? task.dueDate : '',
  ]);
}

function findLegacyCarriedFromTaskId(
  candidate: Record<string, unknown>,
  sourceTasks: Record<string, unknown>[],
  decidedAt: string
) {
  if (
    typeof candidate.carriedFromTaskId === 'string' &&
    candidate.carriedFromTaskId.trim()
  ) {
    return candidate.carriedFromTaskId;
  }

  const createdAt = candidate.createdAt;

  if (typeof createdAt !== 'string' || createdAt > decidedAt) {
    return undefined;
  }

  const signature = getLegacyTaskSignature(candidate);
  const matches = sourceTasks.filter(
    (sourceTask) =>
      sourceTask.status === 'skipped' &&
      sourceTask.updatedAt === createdAt &&
      getLegacyTaskSignature(sourceTask) === signature &&
      typeof sourceTask.id === 'string' &&
      Boolean(sourceTask.id.trim())
  );

  return matches.length === 1 ? (matches[0].id as string) : undefined;
}

export function migrateAppDataFromVersion4ToVersion5(
  data: MigrationInput
): MigrationInput {
  const tasksState = getRecord(data.tasks);
  const meetingsState = getRecord(data.meetings);
  const reviewDecisions = Array.isArray(tasksState.reviewDecisions)
    ? tasksState.reviewDecisions.map(getRecord)
    : [];
  let tasks = Array.isArray(tasksState.tasks)
    ? tasksState.tasks.map((task) => ({ ...getRecord(task) }))
    : null;
  let meetings = Array.isArray(meetingsState.meetings)
    ? meetingsState.meetings.map((meeting) => {
        const item = getRecord(meeting);

        return {
          ...item,
          sections: Array.isArray(item.sections)
            ? item.sections.map((section) => {
                const sectionItem = getRecord(section);

                return {
                  ...sectionItem,
                  tasks: Array.isArray(sectionItem.tasks)
                    ? sectionItem.tasks.map((task) => ({
                        ...getRecord(task),
                      }))
                    : sectionItem.tasks,
                };
              })
            : item.sections,
        };
      })
    : null;

  if (tasks && meetings) {
    for (const decision of reviewDecisions) {
      const meetingId = decision.meetingId;
      const sourceMeetingId = decision.sourceMeetingId;
      const decidedAt = decision.decidedAt;

      if (
        typeof meetingId !== 'string' ||
        typeof sourceMeetingId !== 'string' ||
        typeof decidedAt !== 'string'
      ) {
        continue;
      }

      const sourceTasks = tasks.filter(
        (task) => task.sourceMeetingId === sourceMeetingId
      );

      tasks = tasks.map((task) => {
        if (task.sourceMeetingId !== meetingId) {
          return task;
        }

        const carriedFromTaskId = findLegacyCarriedFromTaskId(
          task,
          sourceTasks,
          decidedAt
        );

        return carriedFromTaskId ? { ...task, carriedFromTaskId } : task;
      });

      meetings = meetings.map((meeting) => {
        if (meeting.id !== meetingId || !Array.isArray(meeting.sections)) {
          return meeting;
        }

        return {
          ...meeting,
          sections: meeting.sections.map((section) => {
            const sectionItem = getRecord(section);

            return {
              ...sectionItem,
              tasks: Array.isArray(sectionItem.tasks)
                ? sectionItem.tasks.map((task) => {
                    const taskItem = getRecord(task);
                    const carriedFromTaskId = findLegacyCarriedFromTaskId(
                      taskItem,
                      sourceTasks,
                      decidedAt
                    );

                    return carriedFromTaskId
                      ? { ...taskItem, carriedFromTaskId }
                      : taskItem;
                  })
                : sectionItem.tasks,
            };
          }),
        };
      });
    }

    const provenanceByTaskId = new Map(
      tasks
        .filter(
          (task) =>
            typeof task.id === 'string' &&
            typeof task.carriedFromTaskId === 'string'
        )
        .map((task) => [task.id as string, task.carriedFromTaskId as string])
    );

    meetings = meetings.map((meeting) => ({
      ...meeting,
      sections: Array.isArray(meeting.sections)
        ? meeting.sections.map((section) => {
            const sectionItem = getRecord(section);

            return {
              ...sectionItem,
              tasks: Array.isArray(sectionItem.tasks)
                ? sectionItem.tasks.map((task) => {
                    const taskItem = getRecord(task);
                    const carriedFromTaskId =
                      typeof taskItem.id === 'string'
                        ? provenanceByTaskId.get(taskItem.id)
                        : undefined;

                    return carriedFromTaskId &&
                      typeof taskItem.carriedFromTaskId !== 'string'
                      ? { ...taskItem, carriedFromTaskId }
                      : taskItem;
                  })
                : sectionItem.tasks,
            };
          })
        : meeting.sections,
    }));
  }

  return {
    ...data,
    appDataVersion: 5,
    tasks: tasks ? { ...tasksState, tasks } : data.tasks,
    meetings: meetings ? { ...meetingsState, meetings } : data.meetings,
  };
}

function migrateAppData(value: unknown): AppDataEnvelope | null {
  if (!isRecord(value)) {
    return null;
  }

  let version =
    typeof value.appDataVersion === 'number' ? value.appDataVersion : 1;
  let nextData: MigrationInput = { ...value };

  if (version > appDataVersion) {
    addRecoveryMessage(translate('storage.newerVersion'));
    return null;
  }

  while (version < appDataVersion) {
    const migration = migrations[version];

    if (!migration) {
      addRecoveryMessage(translate('storage.missingMigration'));
      return null;
    }

    nextData = migration(nextData);
    version += 1;
  }

  return validateAppDataEnvelope(nextData);
}

function createAppDataFromLegacyStorage(): AppDataEnvelope {
  const versionOneData: MigrationInput = {
    appDataVersion: 1,
    participants: readLegacyJson('participants'),
    meetings: readLegacyJson('meetings'),
    tasks: readLegacyJson('tasks'),
    privateNotes: readLegacyJson('privateNotes'),
    reminderSettings: readLegacyJson('reminderSettings'),
    calendarSyncSettings: readLegacyJson('calendarSyncSettings'),
    workspace: readLegacyJson('workspace'),
    auth: readLegacyJson('auth'),
    updatedAt: nowIso(),
  };

  return migrateAppData(versionOneData) ?? createEmptyAppData();
}

function persistAppData(data: AppDataEnvelope) {
  const safeData = removeStoredAuthTokenFields(data);

  cachedAppData = safeData;

  if (!canUseLocalStorage()) {
    return;
  }

  try {
    getLocalStorage()?.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(safeData));
  } catch {
    addRecoveryMessage(translate('storage.saveFailed'));
  }
}

function normalizeSettingsData(value: unknown): AppDataSettings | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    calendarSync: value.calendarSync ?? null,
    localization: value.localization ?? null,
    reminders: value.reminders ?? null,
    workspace: value.workspace ?? null,
  };
}

async function persistSettingsData(data: AppDataSettings) {
  cachedSettingsData = data;

  try {
    await Preferences.set({
      key: SETTINGS_STORAGE_KEY,
      value: JSON.stringify(data),
    });
  } catch {
    addRecoveryMessage(translate('storage.saveFailed'));
  }
}

export async function initializeStorageServices() {
  if (hasInitializedSettingsStorage) {
    return;
  }

  hasInitializedSettingsStorage = true;

  try {
    const { value } = await Preferences.get({ key: SETTINGS_STORAGE_KEY });

    if (value) {
      const parsedValue = JSON.parse(value) as unknown;
      cachedSettingsData =
        normalizeSettingsData(parsedValue) ?? createEmptySettingsData();
      return;
    }
  } catch {
    addRecoveryMessage(translate('storage.parseFailed', { label: 'settings' }));
  }

  cachedSettingsData = {
    ...createEmptySettingsData(),
    ...loadAppData().settings,
  };
  await persistSettingsData(cachedSettingsData);
}

function loadAppData(): AppDataEnvelope {
  if (cachedAppData) {
    return cachedAppData;
  }

  if (!canUseLocalStorage()) {
    cachedAppData = createEmptyAppData();
    return cachedAppData;
  }

  const storage = getLocalStorage();
  let rawValue: string | null | undefined;

  try {
    rawValue = storage?.getItem(APP_DATA_STORAGE_KEY);
  } catch {
    addRecoveryMessage(translate('storage.appDataAccessFailed'));
    cachedAppData = createEmptyAppData();
    return cachedAppData;
  }

  if (!rawValue) {
    cachedAppData = createAppDataFromLegacyStorage();
    persistAppData(cachedAppData);
    return cachedAppData;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    const migratedData = migrateAppData(parsedValue);

    if (migratedData) {
      cachedAppData = migratedData;

      if (
        isRecord(parsedValue) &&
        parsedValue.appDataVersion !== appDataVersion
      ) {
        persistAppData(cachedAppData);
      }

      return cachedAppData;
    }

    const backupKey = backupRawAppData(rawValue, 'invalid');
    addRecoveryMessage(translate('storage.invalidData'), backupKey);
  } catch {
    const backupKey = backupRawAppData(rawValue, 'corrupt');
    addRecoveryMessage(translate('storage.corruptData'), backupKey);
  }

  cachedAppData = createEmptyAppData();
  persistAppData(cachedAppData);
  return cachedAppData;
}

export function readStorageSlice<T>(
  key: TopLevelStorageSliceKey,
  fallback: T
): T {
  const data = loadAppData();
  return (data[key] ?? fallback) as T;
}

export function writeStorageSlice(
  key: TopLevelStorageSliceKey,
  value: unknown
) {
  const data = {
    ...loadAppData(),
    [key]: value,
    updatedAt: nowIso(),
  };

  persistAppData(data);
}

function normalizeSyncMetadata(value: unknown): SyncStorageMetadata {
  if (!isRecord(value)) {
    return { version: 1, resources: {} };
  }

  const resources = getRecord(value.resources);

  return {
    version: 1,
    resources: {
      meetings: getRecord(resources.meetings),
      tasks: getRecord(resources.tasks),
      participants: getRecord(resources.participants),
    },
    firstBackupKey:
      typeof value.firstBackupKey === 'string'
        ? value.firstBackupKey
        : undefined,
    migratedAt:
      typeof value.migratedAt === 'string' ? value.migratedAt : undefined,
    ownerUserId:
      typeof value.ownerUserId === 'string' ? value.ownerUserId : undefined,
    ownerWorkspaceId:
      typeof value.ownerWorkspaceId === 'string'
        ? value.ownerWorkspaceId
        : undefined,
    lastOwnerCheckedAt:
      typeof value.lastOwnerCheckedAt === 'string'
        ? value.lastOwnerCheckedAt
        : undefined,
  };
}

export function readSyncMetadata() {
  return normalizeSyncMetadata(readStorageSlice('syncMetadata', null));
}

export function readSyncResourceMetadata(resource: SyncStorageResource) {
  return readSyncMetadata().resources[resource] ?? {};
}

export function writeSyncResourceMetadata(
  resource: SyncStorageResource,
  metadata: SyncResourceMetadata
) {
  const currentMetadata = readSyncMetadata();

  writeStorageSlice('syncMetadata', {
    ...currentMetadata,
    resources: {
      ...currentMetadata.resources,
      [resource]: {
        ...currentMetadata.resources[resource],
        ...metadata,
      },
    },
  });
}

export function bindSyncOwner(ownerUserId: string, ownerWorkspaceId?: string) {
  const currentMetadata = readSyncMetadata();

  writeStorageSlice('syncMetadata', {
    ...currentMetadata,
    ownerUserId,
    ownerWorkspaceId,
    lastOwnerCheckedAt: nowIso(),
  });
}

export function resetSyncedAppDataForOwner(ownerUserId: string) {
  const previousMetadata = readSyncMetadata();
  const backupKey = createInternalAppDataBackup('before-sync-owner-change');

  writeStorageSlice('participants', null);
  writeStorageSlice('meetings', null);
  writeStorageSlice('tasks', null);
  writeSettingsStorage('workspace', null);
  writeStorageSlice('syncMetadata', {
    version: 1,
    resources: {},
    firstBackupKey: backupKey ?? previousMetadata.firstBackupKey,
    migratedAt: previousMetadata.migratedAt,
    ownerUserId,
    lastOwnerCheckedAt: nowIso(),
  } satisfies SyncStorageMetadata);

  return backupKey;
}

export function ensureFirstSyncBackup() {
  const currentMetadata = readSyncMetadata();

  if (currentMetadata.firstBackupKey) {
    return currentMetadata.firstBackupKey;
  }

  const backupKey = createInternalAppDataBackup('before-first-cloud-sync');

  if (!backupKey) {
    return null;
  }

  writeStorageSlice('syncMetadata', {
    ...currentMetadata,
    firstBackupKey: backupKey,
  });

  return backupKey;
}

export function readSettingsStorage<T>(
  key: SettingsStorageSliceKey,
  fallback: T
): T {
  const settings = cachedSettingsData ?? loadAppData().settings;
  return (settings[key] ?? fallback) as T;
}

export function writeSettingsStorage(
  key: SettingsStorageSliceKey,
  value: unknown
) {
  const settings = {
    ...(cachedSettingsData ?? loadAppData().settings),
    [key]: value,
  };

  void persistSettingsData(settings);
}

export function readOnboardingStorage<T>(
  key: OnboardingStorageSliceKey,
  fallback: T
): T {
  const data = loadAppData();
  return (data.onboarding[key] ?? fallback) as T;
}

export function writeOnboardingStorage(
  key: OnboardingStorageSliceKey,
  value: unknown
) {
  const data = loadAppData();

  persistAppData({
    ...data,
    onboarding: {
      ...data.onboarding,
      [key]: value,
    },
    updatedAt: nowIso(),
  });
}

export function createInternalAppDataBackup(reason = 'manual') {
  if (!canUseLocalStorage()) {
    return null;
  }

  const backupKey = createBackupKey(reason);
  const data = loadAppData();

  try {
    getLocalStorage()?.setItem(
      backupKey,
      JSON.stringify({
        reason,
        backedUpAt: nowIso(),
        storageKey: APP_DATA_STORAGE_KEY,
        appData: data,
      })
    );
  } catch {
    addRecoveryMessage(translate('storage.backupFailed'));
    return null;
  }

  return backupKey;
}

function removeLocalStorageKey(key: string) {
  const storage = getLocalStorage();

  if (!storage) {
    if (typeof window !== 'undefined') {
      addRecoveryMessage(translate('storage.clearFailed'));
      return false;
    }

    return true;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch {
    addRecoveryMessage(translate('storage.clearFailed'));
    return false;
  }
}

function clearAppDataBackupKeys() {
  const storage = getLocalStorage();

  if (!storage) {
    if (typeof window !== 'undefined') {
      addRecoveryMessage(translate('storage.clearFailed'));
      return false;
    }

    return true;
  }

  const keysToRemove: string[] = [];

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (key?.startsWith(BACKUP_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
  } catch {
    addRecoveryMessage(translate('storage.clearFailed'));
    return false;
  }

  let didClearAll = true;

  for (const key of keysToRemove) {
    didClearAll = removeLocalStorageKey(key) && didClearAll;
  }

  return didClearAll;
}

export async function clearAllLocalAppDataAfterAccountDeletion() {
  clearStorageRecoveryMessages();
  let didClearAll = true;

  for (const key of Object.values(legacyStorageKeys)) {
    didClearAll = removeLocalStorageKey(key) && didClearAll;
  }

  didClearAll = removeLocalStorageKey(APP_DATA_STORAGE_KEY) && didClearAll;
  didClearAll = clearAppDataBackupKeys() && didClearAll;

  try {
    await Preferences.remove({ key: SETTINGS_STORAGE_KEY });
  } catch {
    addRecoveryMessage(translate('storage.clearFailed'));
    didClearAll = false;
  }

  cachedAppData = null;
  cachedSettingsData = null;
  hasInitializedSettingsStorage = false;

  if (!didClearAll) {
    throw new Error(translate('storage.clearFailed'));
  }
}

export function exportAppDataBackup() {
  return JSON.stringify(loadAppData(), null, 2);
}

export function clearStorageRecoveryMessages() {
  storageRecoveryState.value = {
    hasIssue: false,
    messages: [],
    backupKeys: [],
  };
}
