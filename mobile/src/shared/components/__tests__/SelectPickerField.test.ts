// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SelectPickerField from '../SelectPickerField.vue';

const options = [
  { value: 'shared', label: 'Shared' },
  { value: 'alex', label: 'Alex' },
];

describe('SelectPickerField', () => {
  it('emits an enabled choice and closes', async () => {
    const wrapper = mount(SelectPickerField, {
      props: { modelValue: 'shared', label: 'Responsible', options },
      global: {
        stubs: {
          BaseBottomSheet: {
            props: ['open'],
            template:
              '<div v-if="open" class="base-bottom-sheet"><slot /></div>',
          },
        },
      },
    });

    await wrapper.get('.reminder-picker-field__trigger').trigger('click');
    await wrapper.get('[data-picker-option="alex"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([['alex']]);
    expect(wrapper.find('.base-bottom-sheet').exists()).toBe(false);
  });
});
