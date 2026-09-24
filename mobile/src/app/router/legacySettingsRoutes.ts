import type { RouteRecordRaw } from 'vue-router';

export const legacySettingsRoutes: RouteRecordRaw[] = [
  {
    path: '/settings/workspace',
    redirect: { name: 'settings' },
  },
];
