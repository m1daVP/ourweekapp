export type AppEnvironment = 'local' | 'development' | 'staging' | 'production';

export type ApiMode = 'mock' | 'backend';

interface AppConfig {
  apiBaseUrl: string | null;
  apiMode: ApiMode;
  appEnvironment: AppEnvironment;
  isBackendApiEnabled: boolean;
}

const appEnvironments = new Set<AppEnvironment>([
  'local',
  'development',
  'staging',
  'production',
]);

function normalizeBaseUrl(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue.replace(/\/+$/, '') : null;
}

function normalizeAppEnvironment(value: string | undefined): AppEnvironment {
  if (value && appEnvironments.has(value as AppEnvironment)) {
    return value as AppEnvironment;
  }

  if (import.meta.env.PROD) {
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

const apiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
const apiMode = normalizeApiMode(import.meta.env.VITE_API_MODE, apiBaseUrl);

export const appConfig: AppConfig = {
  apiBaseUrl,
  apiMode,
  appEnvironment: normalizeAppEnvironment(import.meta.env.VITE_APP_ENV),
  isBackendApiEnabled: apiMode === 'backend' && Boolean(apiBaseUrl),
};
