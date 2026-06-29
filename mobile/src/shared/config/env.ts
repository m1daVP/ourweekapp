import { Capacitor } from '@capacitor/core';

export type AppEnvironment = 'local' | 'development' | 'staging' | 'production';

export interface AppConfig {
  apiBaseUrl: string;
  appEnvironment: AppEnvironment;
  revenueCatAndroidApiKey: string | null;
  revenueCatIosApiKey: string | null;
  revenueCatEntitlementId: string;
  revenueCatCurrentOfferingId: string;
  revenueCatAndroidMonthlyProductId: string;
  revenueCatAndroidYearlyProductId: string;
  isRevenueCatEnabled: boolean;
  googleWebClientId: string | null;
  googleIosClientId: string | null;
}

export interface AppConfigEnv {
  VITE_API_BASE_URL?: string;
  VITE_REVENUECAT_ANDROID_API_KEY?: string;
  VITE_REVENUECAT_IOS_API_KEY?: string;
  VITE_REVENUECAT_ENTITLEMENT_ID?: string;
  VITE_REVENUECAT_CURRENT_OFFERING_ID?: string;
  VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID?: string;
  VITE_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID?: string;
  VITE_GOOGLE_WEB_CLIENT_ID?: string;
  VITE_GOOGLE_IOS_CLIENT_ID?: string;
  MODE?: string;
  PROD?: boolean;
}

function normalizeBaseUrl(value: string | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const isLocalHttp =
      url.protocol === 'http:' &&
      (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.endsWith('.local') ||
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname));

    if (
      (url.protocol !== 'https:' && !isLocalHttp) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return trimmedValue.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function normalizeAppEnvironment(
  mode: string | undefined,
  isProductionBuild: boolean
): AppEnvironment {
  if (mode === 'staging') {
    return 'staging';
  }

  if (mode === 'development') {
    return 'development';
  }

  if (mode === 'release' || mode === 'production' || isProductionBuild) {
    return 'production';
  }

  return 'local';
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

  if (!apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL must be configured with a valid URL.');
  }

  const appEnvironment = normalizeAppEnvironment(env.MODE, Boolean(env.PROD));
  const revenueCatAndroidApiKey = normalizeOptionalString(
    env.VITE_REVENUECAT_ANDROID_API_KEY
  );
  const revenueCatIosApiKey = normalizeOptionalString(
    env.VITE_REVENUECAT_IOS_API_KEY
  );

  return {
    apiBaseUrl,
    appEnvironment,
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
    revenueCatAndroidMonthlyProductId: normalizeRequiredString(
      env.VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID,
      'monthly'
    ),
    revenueCatAndroidYearlyProductId: normalizeRequiredString(
      env.VITE_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID,
      'yearly'
    ),
    isRevenueCatEnabled: hasNativeRevenueCatKey(
      revenueCatAndroidApiKey,
      revenueCatIosApiKey
    ),
    googleWebClientId: normalizeOptionalString(env.VITE_GOOGLE_WEB_CLIENT_ID),
    googleIosClientId: normalizeOptionalString(env.VITE_GOOGLE_IOS_CLIENT_ID),
  };
}

export const appConfig: AppConfig = createAppConfig(import.meta.env);
