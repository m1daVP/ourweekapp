<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseDialog from '@/shared/components/BaseDialog.vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    stepMinutes: number;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const { t } = useI18n();
const isOpen = ref(false);
const selectedHour = ref(9);
const selectedMinute = ref(0);
const hourWheelElement = ref<HTMLElement | null>(null);
const minuteWheelElement = ref<HTMLElement | null>(null);
const wheelOptionHeight = 56;

const minuteStep = computed(() => {
  const roundedStep = Math.round(props.stepMinutes);

  return roundedStep > 0 && 60 % roundedStep === 0 ? roundedStep : 5;
});
const hourOptions = Array.from({ length: 24 }, (_, hour) => hour);
const minuteOptions = computed(() =>
  Array.from(
    { length: 60 / minuteStep.value },
    (_, index) => index * minuteStep.value
  )
);
const formattedValue = computed(() =>
  formatTime(selectedHour.value, selectedMinute.value)
);

function padTimePart(value: number) {
  return String(value).padStart(2, '0');
}

function formatTime(hour: number, minute: number) {
  return `${padTimePart(hour)}:${padTimePart(minute)}`;
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

function closestMinute(minute: number) {
  return minuteOptions.value.reduce((closest, option) =>
    Math.abs(option - minute) < Math.abs(closest - minute) ? option : closest
  );
}

function scrollWheel(element: HTMLElement | null, valueIndex: number) {
  if (element) element.scrollTop = valueIndex * wheelOptionHeight;
}

function selectClosestValue(options: ReadonlyArray<number>, scrollTop: number) {
  return options[Math.round(scrollTop / wheelOptionHeight)] ?? options[0];
}

function handleHourScroll(event: Event) {
  selectedHour.value = selectClosestValue(
    hourOptions,
    (event.currentTarget as HTMLElement).scrollTop
  );
}

function handleMinuteScroll(event: Event) {
  selectedMinute.value = selectClosestValue(
    minuteOptions.value,
    (event.currentTarget as HTMLElement).scrollTop
  );
}

function openPicker() {
  if (props.disabled) return;

  const parsedTime = parseTime(props.modelValue);
  selectedHour.value = parsedTime?.hour ?? 9;
  selectedMinute.value = parsedTime
    ? closestMinute(parsedTime.minute)
    : minuteOptions.value[0];
  isOpen.value = true;
}

function closePicker() {
  isOpen.value = false;
}

function selectHour(hour: number) {
  selectedHour.value = hour;
  scrollWheel(hourWheelElement.value, hour);
}

function selectMinute(minute: number) {
  selectedMinute.value = minute;
  scrollWheel(minuteWheelElement.value, minuteOptions.value.indexOf(minute));
}

function confirmTime() {
  emit('update:modelValue', formattedValue.value);
  closePicker();
}

watch(isOpen, async (isPickerOpen) => {
  if (!isPickerOpen) return;

  await nextTick();
  scrollWheel(hourWheelElement.value, selectedHour.value);
  scrollWheel(
    minuteWheelElement.value,
    minuteOptions.value.indexOf(selectedMinute.value)
  );
});
</script>

<template>
  <div class="reminder-picker-field">
    <button
      class="reminder-picker-field__trigger"
      type="button"
      :disabled="disabled"
      :aria-label="label"
      :aria-expanded="isOpen"
      @click="openPicker"
    >
      <span class="reminder-picker-field__value">{{ modelValue }}</span>
      <span class="material-symbols-outlined" aria-hidden="true">
        schedule
      </span>
    </button>

    <BaseDialog :open="isOpen" :title="label" @close="closePicker">
      <div class="reminder-time-picker">
        <p class="reminder-time-picker__preview" role="status">
          {{ formattedValue }}
        </p>

        <div class="reminder-time-picker__wheels">
          <section
            class="reminder-time-picker__wheel-wrap"
            :aria-label="t('settings.hours')"
          >
            <div
              ref="hourWheelElement"
              class="reminder-time-picker__wheel"
              role="listbox"
              :aria-label="t('settings.hours')"
              @scroll="handleHourScroll"
            >
              <button
                v-for="hour in hourOptions"
                :key="hour"
                class="reminder-time-picker__option"
                :class="{ 'is-selected': hour === selectedHour }"
                type="button"
                role="option"
                :aria-selected="hour === selectedHour"
                @click="selectHour(hour)"
              >
                {{ padTimePart(hour) }}
              </button>
            </div>
          </section>
          <span class="reminder-time-picker__separator" aria-hidden="true">
            :
          </span>
          <section
            class="reminder-time-picker__wheel-wrap"
            :aria-label="t('settings.minutes')"
          >
            <div
              ref="minuteWheelElement"
              class="reminder-time-picker__wheel"
              role="listbox"
              :aria-label="t('settings.minutes')"
              @scroll="handleMinuteScroll"
            >
              <button
                v-for="minute in minuteOptions"
                :key="minute"
                class="reminder-time-picker__option"
                :class="{ 'is-selected': minute === selectedMinute }"
                type="button"
                role="option"
                :aria-selected="minute === selectedMinute"
                @click="selectMinute(minute)"
              >
                {{ padTimePart(minute) }}
              </button>
            </div>
          </section>
        </div>

        <div class="reminder-time-picker__actions">
          <button
            class="secondary-button"
            type="button"
            data-testid="time-picker-cancel"
            @click="closePicker"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            class="meeting-primary"
            type="button"
            data-testid="time-picker-done"
            @click="confirmTime"
          >
            {{ t('common.done') }}
          </button>
        </div>
      </div>
    </BaseDialog>
  </div>
</template>
