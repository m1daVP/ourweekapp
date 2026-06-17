import { describe, expect, it } from 'vitest';
import { createAppConfig } from '@/shared/config/env';

describe('createAppConfig', () => {
  it('enables backend mode when a valid base URL is configured', () => {
    const config = createAppConfig({
      VITE_API_BASE_URL: 'http://localhost:3030/',
      VITE_API_MODE: 'backend',
      VITE_APP_ENV: 'staging',
    });

    expect(config.apiBaseUrl).toBe('http://localhost:3030');
    expect(config.apiMode).toBe('backend');
    expect(config.appEnvironment).toBe('staging');
    expect(config.isBackendApiEnabled).toBe(true);
    expect(config.isDevelopmentMockUiEnabled).toBe(false);
  });

  it('treats invalid backend URLs as unavailable', () => {
    const config = createAppConfig({
      VITE_API_BASE_URL: 'not a url',
      VITE_API_MODE: 'backend',
    });

    expect(config.apiBaseUrl).toBeNull();
    expect(config.apiMode).toBe('backend');
    expect(config.isBackendApiEnabled).toBe(false);
  });

  it('infers backend mode from a valid base URL when mode is omitted', () => {
    const config = createAppConfig({
      VITE_API_BASE_URL: 'https://api.example.com',
    });

    expect(config.apiMode).toBe('backend');
    expect(config.isBackendApiEnabled).toBe(true);
  });

  it('falls back to mock mode without a base URL', () => {
    const config = createAppConfig({});

    expect(config.apiMode).toBe('mock');
    expect(config.isBackendApiEnabled).toBe(false);
    expect(config.revenueCatEntitlementId).toBe('OurWeek Premium');
    expect(config.revenueCatCurrentOfferingId).toBe('default');
    expect(config.isRevenueCatEnabled).toBe(false);
    expect(config.isRevenueCatValidationEnabled).toBe(false);
  });

  it('defaults production app environment from the production build flag', () => {
    const config = createAppConfig({ PROD: true });

    expect(config.appEnvironment).toBe('production');
  });

  it('enables development mock UI only for local mock builds', () => {
    const config = createAppConfig({
      VITE_API_MODE: 'mock',
      VITE_APP_ENV: 'local',
    });

    expect(config.isDevelopmentMockUiEnabled).toBe(true);
  });

  it('hides development mock UI in backend mode', () => {
    const config = createAppConfig({
      VITE_API_BASE_URL: 'http://localhost:3030',
      VITE_API_MODE: 'backend',
      VITE_APP_ENV: 'local',
    });

    expect(config.isDevelopmentMockUiEnabled).toBe(false);
  });

  it('hides development mock UI in production builds', () => {
    const config = createAppConfig({
      VITE_API_MODE: 'mock',
      VITE_APP_ENV: 'local',
      PROD: true,
    });

    expect(config.appEnvironment).toBe('local');
    expect(config.isDevelopmentMockUiEnabled).toBe(false);
  });

  it('normalizes RevenueCat configuration values', () => {
    const config = createAppConfig({
      VITE_REVENUECAT_ANDROID_API_KEY: ' test_android ',
      VITE_REVENUECAT_IOS_API_KEY: ' test_ios ',
      VITE_REVENUECAT_ENTITLEMENT_ID: ' OurWeek Premium ',
      VITE_REVENUECAT_CURRENT_OFFERING_ID: ' default ',
    });

    expect(config.revenueCatAndroidApiKey).toBe('test_android');
    expect(config.revenueCatIosApiKey).toBe('test_ios');
    expect(config.revenueCatEntitlementId).toBe('OurWeek Premium');
    expect(config.revenueCatCurrentOfferingId).toBe('default');
  });

  it('requires backend mode and an explicit flag for RevenueCat validation', () => {
    const mockConfig = createAppConfig({
      VITE_ENABLE_REVENUECAT_VALIDATION: 'true',
    });
    const backendConfig = createAppConfig({
      VITE_API_BASE_URL: 'http://localhost:3030',
      VITE_API_MODE: 'backend',
      VITE_ENABLE_REVENUECAT_VALIDATION: 'true',
    });

    expect(mockConfig.isRevenueCatValidationEnabled).toBe(false);
    expect(backendConfig.isRevenueCatValidationEnabled).toBe(true);
  });
});
