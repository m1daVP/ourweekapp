import { describe, expect, it } from 'vitest';
import { legacySettingsRoutes } from '@/app/router/legacySettingsRoutes';

describe('legacy settings routes', () => {
  it('redirects the removed workspace page to settings', () => {
    expect(legacySettingsRoutes).toEqual([
      {
        path: '/settings/workspace',
        redirect: { name: 'settings' },
      },
    ]);
    expect(legacySettingsRoutes[0]).not.toHaveProperty('component');
    expect(legacySettingsRoutes[0]).not.toHaveProperty('name');
  });
});
