// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@jaames/iro', () => ({ default: { ColorPicker: vi.fn() } }));

vi.mock('@/app/stores/participants', () => ({
  participantColors: ['#496a8f'],
}));

import AvatarPickerSheet from '../AvatarPickerSheet.vue';

describe('AvatarPickerSheet custom color trigger', () => {
  it('renders the custom-color trigger as a circular swatch', () => {
    const wrapper = shallowMount(AvatarPickerSheet, {
      props: { open: true, avatarType: null, avatarColor: '#496a8f' },
      global: {
        stubs: {
          BaseBottomSheet: { template: '<div><slot /></div>' },
        },
      },
    });

    expect(
      wrapper.get('button.avatar-picker__custom-color').attributes('aria-label')
    ).toBe('settings.customAvatarColor');
    expect(wrapper.find('.avatar-picker__custom-color-swatch').exists()).toBe(
      true
    );
  });
});
