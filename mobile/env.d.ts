/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_REVENUECAT_ANDROID_API_KEY?: string;
  readonly VITE_REVENUECAT_IOS_API_KEY?: string;
  readonly VITE_REVENUECAT_ENTITLEMENT_ID?: string;
  readonly VITE_REVENUECAT_CURRENT_OFFERING_ID?: string;
  readonly VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID?: string;
  readonly VITE_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
