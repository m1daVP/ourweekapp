// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ locale: { value: 'en' }, t: (key: string) => key }),
}));

import DatePickerField from '../DatePickerField.vue';

const global = {
  stubs: {
    BaseDialog: {
      props: ['open'],
      template: '<div v-if="open" class="base-dialog"><slot /></div>',
    },
  },
};

describe('DatePickerField', () => {
  it('stages a selected ISO date until Done', async () => {
    const wrapper = mount(DatePickerField, {
      props: { modelValue: '', label: 'Due date' },
      global,
    });

    await wrapper.get('.reminder-picker-field__trigger').trigger('click');
    const dateButton = wrapper.get('[data-picker-date]');
    const selectedDate = dateButton.attributes('data-picker-date');
    await dateButton.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await wrapper.get('[data-testid="date-picker-done"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([[selectedDate]]);
  });
});
