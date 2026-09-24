// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  registerAndroidBackHandler: vi.fn(() => vi.fn()),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/app/composables/useAndroidBackButton', () => ({
  registerAndroidBackHandler: mocks.registerAndroidBackHandler,
}));

import BaseDialog from '../BaseDialog.vue';

afterEach(() => {
  document.body.replaceChildren();
  mocks.registerAndroidBackHandler.mockClear();
});

describe('BaseDialog', () => {
  it('emits close from the scrim and restores focus after closing', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const wrapper = mount(BaseDialog, {
      attachTo: document.body,
      props: { open: true, title: 'Time' },
      slots: { default: '<button type="button">Done</button>' },
    });

    const scrim = document.body.querySelector<HTMLButtonElement>(
      '.base-dialog__scrim'
    );

    scrim?.click();

    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(mocks.registerAndroidBackHandler).toHaveBeenCalledOnce();

    await wrapper.setProps({ open: false });

    expect(document.activeElement).toBe(trigger);
  });
});
