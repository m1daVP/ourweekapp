// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

const haptics = vi.hoisted(() => ({
  wheelStart: vi.fn(),
  wheelChange: vi.fn(),
  wheelEnd: vi.fn(),
}));

vi.mock('@/shared/services/hapticsService', () => ({ haptics }));
vi.mock('@/shared/components/BaseDialog.vue', () => ({
  default: {
    props: ['open', 'title'],
    template: '<div v-if="open"><slot /></div>',
  },
}));
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

import TimePickerField from '../TimePickerField.vue';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TimePickerField wheel haptics', () => {
  it('ticks once for each changed hour value during user scrolling', async () => {
    vi.useFakeTimers();
    const wrapper = mount(TimePickerField, {
      props: {
        modelValue: '09:00',
        label: 'Reminder time',
        stepMinutes: 5,
      },
    });

    await wrapper.get('.reminder-picker-field__trigger').trigger('click');
    await nextTick();

    const hourWheel = wrapper.findAll('.reminder-time-picker__wheel')[0]
      ?.element as HTMLElement;

    expect(haptics.wheelStart).not.toHaveBeenCalled();
    expect(haptics.wheelChange).not.toHaveBeenCalled();

    hourWheel.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    hourWheel.scrollTop = 10 * 56;
    hourWheel.dispatchEvent(new Event('scroll', { bubbles: true }));
    hourWheel.dispatchEvent(new Event('scroll', { bubbles: true }));
    hourWheel.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    vi.advanceTimersByTime(120);

    expect(haptics.wheelStart).toHaveBeenCalledOnce();
    expect(haptics.wheelChange).toHaveBeenCalledOnce();
    expect(haptics.wheelEnd).toHaveBeenCalledOnce();
  });

  it('ticks for changed minute values using the configured step', async () => {
    vi.useFakeTimers();
    const wrapper = mount(TimePickerField, {
      props: {
        modelValue: '09:00',
        label: 'Reminder time',
        stepMinutes: 5,
      },
    });

    await wrapper.get('.reminder-picker-field__trigger').trigger('click');
    await nextTick();

    const minuteWheel = wrapper.findAll('.reminder-time-picker__wheel')[1]
      ?.element as HTMLElement;

    minuteWheel.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true })
    );
    minuteWheel.scrollTop = 2 * 56;
    minuteWheel.dispatchEvent(new Event('scroll', { bubbles: true }));
    minuteWheel.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    vi.advanceTimersByTime(120);

    expect(haptics.wheelStart).toHaveBeenCalledOnce();
    expect(haptics.wheelChange).toHaveBeenCalledOnce();
    expect(haptics.wheelEnd).toHaveBeenCalledOnce();
  });
});
