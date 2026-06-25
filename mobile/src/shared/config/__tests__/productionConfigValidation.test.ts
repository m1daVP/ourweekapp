import { describe, expect, it } from 'vitest';
import {
  assertValidProductionConfig,
  validateRequiredApiConfig,
  validateProductionConfig,
  type ProductionConfigEnv,
} from '@/shared/config/productionConfigValidation';

const validProductionEnv: ProductionConfigEnv = {
  VITE_API_BASE_URL: 'https://api.ourweek.app/v1',
  VITE_REVENUECAT_ANDROID_API_KEY: 'public-android-sdk-key',
  VITE_REVENUECAT_ENTITLEMENT_ID: 'OurWeek Premium',
  VITE_REVENUECAT_CURRENT_OFFERING_ID: 'default',
  VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID: 'ourweek.premium.monthly',
  VITE_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID: 'ourweek.premium.yearly',
};

describe('production configuration validation', () => {
  it('accepts an explicit production backend and billing configuration', () => {
    expect(validateProductionConfig(validProductionEnv)).toEqual([]);
    expect(() => assertValidProductionConfig(validProductionEnv)).not.toThrow();
  });

  it('reports every required production setting without printing values', () => {
    const secretLikeValue = 'do-not-print-this-value';
    const issues = validateProductionConfig({
      VITE_REVENUECAT_ANDROID_API_KEY: secretLikeValue,
    });
    const keys = issues.map((issue) => issue.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        'VITE_API_BASE_URL',
        'VITE_REVENUECAT_ENTITLEMENT_ID',
        'VITE_REVENUECAT_CURRENT_OFFERING_ID',
        'VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID',
        'VITE_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID',
      ])
    );
    expect(issues).not.toContain(secretLikeValue);

    expect(() =>
      assertValidProductionConfig({
        VITE_REVENUECAT_ANDROID_API_KEY: secretLikeValue,
      })
    ).toThrowError(/Invalid OurWeek production configuration/);

    try {
      assertValidProductionConfig({
        VITE_REVENUECAT_ANDROID_API_KEY: secretLikeValue,
      });
    } catch (error) {
      expect(String(error)).not.toContain(secretLikeValue);
    }
  });

  it.each([
    'http://api.ourweek.example',
    'https://localhost:3030',
    'https://192.168.1.2',
    'https://api.example.com',
    'https://user:password@api.ourweek.example',
    'https://api.ourweek.example?debug=true',
  ])('rejects an unsafe production backend URL: %s', (apiBaseUrl) => {
    const issues = validateProductionConfig({
      ...validProductionEnv,
      VITE_API_BASE_URL: apiBaseUrl,
    });

    expect(issues).toContainEqual(
      expect.objectContaining({ key: 'VITE_API_BASE_URL' })
    );
  });

  it('rejects placeholder billing identifiers', () => {
    const issues = validateProductionConfig({
      ...validProductionEnv,
      VITE_REVENUECAT_ANDROID_API_KEY: 'change-me',
      VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID: 'pending',
    });

    expect(issues.map((issue) => issue.key)).toEqual([
      'VITE_REVENUECAT_ANDROID_API_KEY',
      'VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID',
    ]);
  });

  it('allows local HTTP only for non-release app runs', () => {
    expect(
      validateRequiredApiConfig({
        VITE_API_BASE_URL: 'http://localhost:3030',
      })
    ).toEqual([]);
    expect(
      validateRequiredApiConfig({
        VITE_API_BASE_URL: 'http://api.ourweek.app',
      })
    ).toContainEqual(expect.objectContaining({ key: 'VITE_API_BASE_URL' }));
    expect(
      validateProductionConfig({
        ...validProductionEnv,
        VITE_API_BASE_URL: 'http://localhost:3030',
      })
    ).toContainEqual(expect.objectContaining({ key: 'VITE_API_BASE_URL' }));
  });
});
