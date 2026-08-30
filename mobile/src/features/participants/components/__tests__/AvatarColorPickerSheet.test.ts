// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();

  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  };
});

vi.mock('@jaames/iro', () => ({
  default: {
    ColorPicker: vi.fn(() => ({
      base: document.createElement('div'),
      color: { hexString: '#496a8f' },
      on: vi.fn(),
    })),
    ui: {
      Slider: Symbol('Slider'),
      Wheel: Symbol('Wheel'),
    },
  },
}));

import AvatarColorPickerSheet from '../AvatarColorPickerSheet.vue';

function mountSheet() {
  return mount(AvatarColorPickerSheet, {
    props: {
      color: '#496a8f',
      open: true,
    },
    global: {
      stubs: {
        BaseBottomSheet: {
          template: '<div><slot /></div>',
        },
      },
    },
  });
}

describe('AvatarColorPickerSheet', () => {
  it('emits the normalized staged value only after Select', async () => {
    const wrapper = mountSheet();

    await wrapper.get('input[type="text"]').setValue('#A1B2C3');
    await wrapper.get('[data-test="avatar-color-select"]').trigger('click');

    expect(wrapper.emitted('select')).toEqual([['#a1b2c3']]);
  });

  it('does not emit a selected value when Cancel is pressed', async () => {
    const wrapper = mountSheet();

    await wrapper.get('[data-test="avatar-color-cancel"]').trigger('click');

    expect(wrapper.emitted('select')).toBeUndefined();
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('keeps the sheet open and explains an invalid hex value', async () => {
    const wrapper = mountSheet();

    await wrapper.get('input[type="text"]').setValue('#123');
    await wrapper.get('[data-test="avatar-color-select"]').trigger('click');

    expect(wrapper.emitted('select')).toBeUndefined();
    expect(wrapper.text()).toContain('settings.customAvatarColorInvalid');
  });
});
