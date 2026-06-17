import { Capacitor } from '@capacitor/core';

export type AppEnvironment = 'local' | 'development' | 'staging' | 'production';

export type ApiMode = 'mock' | 'backend';

export interface AppConfig {
  apiBaseUrl: string | null;
  apiMode: ApiMode;
  appEnvironment: AppEnvironment;
  isBackendApiEnabled: boolean;
  isDevelopmentMockUiEnabled: boolean;
  isGoogleCalendarSyncEnabled: boolean;
  revenueCatAndroidApiKey: string | null;
  revenueCatIosApiKey: string | null;
  revenueCatEntitlementId: string;
  revenueCatCurrentOfferingId: string;
  isRevenueCatEnabled: boolean;
  isRevenueCatValidationEnabled: boolean;
}

export interface AppConfigEnv {
  VITE_API_BASE_URL?: string;
  VITE_API_MODE?: string;
  VITE_APP_ENV?: string;
  VITE_ENABLE_GOOGLE_CALENDAR?: string;
  VITE_REVENUECAT_ANDROID_API_KEY?: string;
  VITE_REVENUECAT_IOS_API_KEY?: string;
  VITE_REVENUECAT_ENTITLEMENT_ID?: string;
  VITE_REVENUECAT_CURRENT_OFFERING_ID?: string;
  VITE_ENABLE_REVENUECAT_VALIDATION?: string;
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

function normalizeOptionalString(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue || null;
}

function normalizeRequiredString(value: string | undefined, fallback: string) {
  return normalizeOptionalString(value) ?? fallback;
}

function hasNativeRevenueCatKey(
  androidApiKey: string | null,
  iosApiKey: string | null
) {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const platform = Capacitor.getPlatform();

  if (platform === 'android') {
    return Boolean(androidApiKey);
  }

  if (platform === 'ios') {
    return Boolean(iosApiKey);
  }

  return false;
}

export function createAppConfig(env: AppConfigEnv): AppConfig {
  const apiBaseUrl = normalizeBaseUrl(env.VITE_API_BASE_URL);
  const apiMode = normalizeApiMode(env.VITE_API_MODE, apiBaseUrl);
  const appEnvironment = normalizeAppEnvironment(
    env.VITE_APP_ENV,
    Boolean(env.PROD)
  );
  const isBackendApiEnabled = apiMode === 'backend' && Boolean(apiBaseUrl);
  const isDevelopmentMockUiEnabled =
    !env.PROD && appEnvironment === 'local' && apiMode === 'mock';
  const revenueCatAndroidApiKey = normalizeOptionalString(
    env.VITE_REVENUECAT_ANDROID_API_KEY
  );
  const revenueCatIosApiKey = normalizeOptionalString(
    env.VITE_REVENUECAT_IOS_API_KEY
  );

  return {
    apiBaseUrl,
    apiMode,
    appEnvironment,
    isBackendApiEnabled,
    isDevelopmentMockUiEnabled,
    isGoogleCalendarSyncEnabled:
      isBackendApiEnabled &&
      normalizeBooleanFlag(
        env.VITE_ENABLE_GOOGLE_CALENDAR,
        appEnvironment !== 'production'
      ),
    revenueCatAndroidApiKey,
    revenueCatIosApiKey,
    revenueCatEntitlementId: normalizeRequiredString(
      env.VITE_REVENUECAT_ENTITLEMENT_ID,
      'OurWeek Premium'
    ),
    revenueCatCurrentOfferingId: normalizeRequiredString(
      env.VITE_REVENUECAT_CURRENT_OFFERING_ID,
      'default'
    ),
    isRevenueCatEnabled: hasNativeRevenueCatKey(
      revenueCatAndroidApiKey,
      revenueCatIosApiKey
    ),
    isRevenueCatValidationEnabled:
      isBackendApiEnabled &&
      normalizeBooleanFlag(env.VITE_ENABLE_REVENUECAT_VALIDATION, false),
  };
}

export const appConfig: AppConfig = createAppConfig(import.meta.env);
