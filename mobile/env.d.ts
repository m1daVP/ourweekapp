/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_MODE?: 'mock' | 'backend';
  readonly VITE_APP_ENV?: 'local' | 'development' | 'staging' | 'production';
  readonly VITE_ENABLE_GOOGLE_CALENDAR?: string;
  readonly VITE_REVENUECAT_ANDROID_API_KEY?: string;
  readonly VITE_REVENUECAT_IOS_API_KEY?: string;
  readonly VITE_REVENUECAT_ENTITLEMENT_ID?: string;
  readonly VITE_REVENUECAT_CURRENT_OFFERING_ID?: string;
  readonly VITE_ENABLE_REVENUECAT_VALIDATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
