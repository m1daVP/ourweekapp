/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_MODE?: 'mock' | 'backend';
  readonly VITE_APP_ENV?: 'local' | 'development' | 'staging' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
