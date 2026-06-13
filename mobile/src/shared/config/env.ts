export type AppEnvironment = 'local' | 'development' | 'staging' | 'production';

export type ApiMode = 'mock' | 'backend';

export interface AppConfig {
  apiBaseUrl: string | null;
  apiMode: ApiMode;
  appEnvironment: AppEnvironment;
  isBackendApiEnabled: boolean;
  isGoogleCalendarSyncEnabled: boolean;
}

export interface AppConfigEnv {
  VITE_API_BASE_URL?: string;
  VITE_API_MODE?: string;
  VITE_APP_ENV?: string;
  VITE_ENABLE_GOOGLE_CALENDAR?: string;
  PROD?: boolean;
}

const appEnvironments = new Set<AppEnvironment>([
  'local',
  'development',
  'staging',
  'production',
]);

function normalizeBaseUrl(value: string | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    return trimmedValue.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function normalizeAppEnvironment(
  value: string | undefined,
  isProductionBuild: boolean
): AppEnvironment {
  if (value && appEnvironments.has(value as AppEnvironment)) {
    return value as AppEnvironment;
  }

  if (isProductionBuild) {
    return 'production';
  }

  return 'local';
}

function normalizeApiMode(
  value: string | undefined,
  apiBaseUrl: string | null
): ApiMode {
  if (value === 'backend' || value === 'mock') {
    return value;
  }

  return apiBaseUrl ? 'backend' : 'mock';
}

function normalizeBooleanFlag(
  value: string | undefined,
  fallback: boolean
): boolean {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function createAppConfig(env: AppConfigEnv): AppConfig {
  const apiBaseUrl = normalizeBaseUrl(env.VITE_API_BASE_URL);
  const apiMode = normalizeApiMode(env.VITE_API_MODE, apiBaseUrl);
  const appEnvironment = normalizeAppEnvironment(
    env.VITE_APP_ENV,
    Boolean(env.PROD)
  );
  const isBackendApiEnabled = apiMode === 'backend' && Boolean(apiBaseUrl);

  return {
    apiBaseUrl,
    apiMode,
    appEnvironment,
    isBackendApiEnabled,
    isGoogleCalendarSyncEnabled:
      isBackendApiEnabled &&
      normalizeBooleanFlag(
        env.VITE_ENABLE_GOOGLE_CALENDAR,
        appEnvironment !== 'production'
      ),
  };
}

export const appConfig: AppConfig = createAppConfig(import.meta.env);
