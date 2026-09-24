// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/app/stores/auth', () => ({
  useAuthStore: () => ({
    user: { email: 'member@example.com' },
    logout: vi.fn(),
  }),
}));

import LogoutConfirmationPage from '../LogoutConfirmationPage.vue';

describe('LogoutConfirmationPage', () => {
  it('returns a user to Settings when they keep their session', () => {
    const wrapper = shallowMount(LogoutConfirmationPage, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template:
              '<a data-testid="keep-signed-in" :data-route="to.name"><slot /></a>',
          },
        },
      },
    });

    expect(
      wrapper.get('[data-testid="keep-signed-in"]').attributes('data-route')
    ).toBe('settings');
  });
});
