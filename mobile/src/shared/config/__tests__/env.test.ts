import { describe, expect, it } from 'vitest';
import { createAppConfig } from '@/shared/config/env';

const apiBaseUrl = 'http://localhost:3030/';

describe('createAppConfig', () => {
  it('requires a valid backend URL', () => {
    expect(() => createAppConfig({})).toThrow(/VITE_API_BASE_URL/);
    expect(() => createAppConfig({ VITE_API_BASE_URL: 'not a url' })).toThrow(
      /VITE_API_BASE_URL/
    );
  });

  it('normalizes the required backend URL', () => {
    const config = createAppConfig({ VITE_API_BASE_URL: apiBaseUrl });

    expect(config.apiBaseUrl).toBe('http://localhost:3030');
  });

  it.each([
    ['development', false, 'development'],
    ['staging', true, 'staging'],
    ['release', true, 'production'],
    ['production', true, 'production'],
    ['custom', false, 'local'],
  ] as const)('derives %s mode as %s', (mode, prod, expectedEnvironment) => {
    const config = createAppConfig({
      VITE_API_BASE_URL: apiBaseUrl,
      MODE: mode,
      PROD: prod,
    });

    expect(config.appEnvironment).toBe(expectedEnvironment);
  });

  it('normalizes RevenueCat configuration values and keeps iOS support', () => {
    const config = createAppConfig({
      VITE_API_BASE_URL: apiBaseUrl,
      VITE_REVENUECAT_ANDROID_API_KEY: ' test_android ',
      VITE_REVENUECAT_IOS_API_KEY: ' test_ios ',
      VITE_REVENUECAT_ENTITLEMENT_ID: ' OurWeek Premium ',
      VITE_REVENUECAT_CURRENT_OFFERING_ID: ' default ',
      VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID: ' premium_monthly ',
      VITE_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID: ' premium_yearly ',
    });

    expect(config.revenueCatAndroidApiKey).toBe('test_android');
    expect(config.revenueCatIosApiKey).toBe('test_ios');
    expect(config.revenueCatEntitlementId).toBe('OurWeek Premium');
    expect(config.revenueCatCurrentOfferingId).toBe('default');
    expect(config.revenueCatAndroidMonthlyProductId).toBe('premium_monthly');
    expect(config.revenueCatAndroidYearlyProductId).toBe('premium_yearly');
  });

  it('uses stable RevenueCat identifiers when optional overrides are absent', () => {
    const config = createAppConfig({ VITE_API_BASE_URL: apiBaseUrl });

    expect(config.revenueCatEntitlementId).toBe('OurWeek Premium');
    expect(config.revenueCatCurrentOfferingId).toBe('default');
    expect(config.revenueCatAndroidMonthlyProductId).toBe('monthly');
    expect(config.revenueCatAndroidYearlyProductId).toBe('yearly');
  });
});
