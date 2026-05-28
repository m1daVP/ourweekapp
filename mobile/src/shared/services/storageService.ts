import { shallowRef } from 'vue';
import { translate } from '@/features/localization/i18n';

export const appDataVersion = 2;

const APP_DATA_STORAGE_KEY = 'weekly-us:app-data';
const BACKUP_STORAGE_PREFIX = 'weekly-us:app-data:backup';

const legacyStorageKeys = {
  auth: 'weekly-us:auth',
  calendarSyncSettings: 'weekly-us:calendar-sync-settings',
  meetings: 'weekly-us:meetings',
  participants: 'weekly-us:participants',
  privateNotes: 'weekly-us:private-notes',
  reminderSettings: 'weekly-us:reminder-settings',
  subscriptionMock: 'weekly-us:subscription:mock',
  tasks: 'weekly-us:tasks-agreements',
  workspace: 'weekly-us:workspace',
} as const;

type TopLevelStorageSliceKey =
  | 'participants'
  | 'meetings'
  | 'tasks'
  | 'privateNotes'
  | 'subscriptionMockState';

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
  settings: AppDataSettings;
  onboarding: AppDataOnboarding;
  subscriptionMockState: unknown;
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
let hasReportedBlockedStorage = false;

const migrations: Record<number, Migration> = {
  1: migrateAppDataFromVersion1ToVersion2,
};

function nowIso() {
  return new Date().toISOString();
}

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
    settings: {
      calendarSync: null,
      localization: null,
      reminders: null,
      workspace: null,
    },
    onboarding: {
      auth: null,
    },
    subscriptionMockState: null,
    updatedAt: nowIso(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
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

  const backupKey = createBackupKey(reason);

  try {
    getLocalStorage()?.setItem(
      backupKey,
      JSON.stringify({
        reason,
        backedUpAt: nowIso(),
        storageKey: APP_DATA_STORAGE_KEY,
        rawValue,
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
    settings: {
      calendarSync: settings.calendarSync ?? null,
      localization: settings.localization ?? null,
      reminders: settings.reminders ?? null,
      workspace: settings.workspace ?? null,
    },
    onboarding: {
      auth: onboarding.auth ?? null,
    },
    subscriptionMockState: value.subscriptionMockState ?? null,
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
    subscriptionMockState: data.subscriptionMockState ?? null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
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
    subscriptionMockState: readLegacyJson('subscriptionMock'),
    updatedAt: nowIso(),
  };

  return migrateAppData(versionOneData) ?? createEmptyAppData();
}

function persistAppData(data: AppDataEnvelope) {
  cachedAppData = data;

  if (!canUseLocalStorage()) {
    return;
  }

  try {
    getLocalStorage()?.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(data));
  } catch {
    addRecoveryMessage(translate('storage.saveFailed'));
  }
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

export function readSettingsStorage<T>(
  key: SettingsStorageSliceKey,
  fallback: T
): T {
  const data = loadAppData();
  return (data.settings[key] ?? fallback) as T;
}

export function writeSettingsStorage(
  key: SettingsStorageSliceKey,
  value: unknown
) {
  const data = loadAppData();

  persistAppData({
    ...data,
    settings: {
      ...data.settings,
      [key]: value,
    },
    updatedAt: nowIso(),
  });
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
