<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseDialog from '@/shared/components/BaseDialog.vue';

type CalendarCell = {
  isoDate: string;
  day: number;
};

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const { t, locale } = useI18n();
const isOpen = ref(false);
const displayedYear = ref(0);
const displayedMonth = ref(0);
const stagedValue = ref('');

const displayedMonthLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(displayedYear.value, displayedMonth.value, 1)))
);
const weekdayLabels = computed(() =>
  Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale.value, {
      weekday: 'narrow',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2023, 0, 1 + index)))
  )
);
const calendarCells = computed<Array<CalendarCell | null>>(() => {
  const firstWeekday = new Date(
    Date.UTC(displayedYear.value, displayedMonth.value, 1)
  ).getUTCDay();
  const daysInMonth = new Date(
    Date.UTC(displayedYear.value, displayedMonth.value + 1, 0)
  ).getUTCDate();

  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;

    return day > 0 && day <= daysInMonth
      ? {
          day,
          isoDate: toIsoDate(displayedYear.value, displayedMonth.value, day),
        }
      : null;
  });
});
const triggerValue = computed(() => {
  const parsedDate = parseIsoDate(props.modelValue);

  return parsedDate
    ? new Intl.DateTimeFormat(locale.value, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(parsedDate)
    : t('common.noDate');
});

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsedDate = new Date(Date.UTC(year, month, day));

  return parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month &&
    parsedDate.getUTCDate() === day
    ? parsedDate
    : null;
}

function openPicker() {
  if (props.disabled) return;

  const selectedDate = parseIsoDate(props.modelValue);
  const currentDate = new Date();
  const initialDate =
    selectedDate ??
    new Date(
      Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate()
      )
    );

  displayedYear.value = initialDate.getUTCFullYear();
  displayedMonth.value = initialDate.getUTCMonth();
  stagedValue.value = selectedDate ? props.modelValue : '';
  isOpen.value = true;
}

function closePicker() {
  isOpen.value = false;
}

function moveMonth(offset: number) {
  const nextDate = new Date(
    Date.UTC(displayedYear.value, displayedMonth.value + offset, 1)
  );
  displayedYear.value = nextDate.getUTCFullYear();
  displayedMonth.value = nextDate.getUTCMonth();
}

function confirmDate() {
  emit('update:modelValue', stagedValue.value);
  closePicker();
}
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
      <span class="reminder-picker-field__value">{{ triggerValue }}</span>
      <span class="material-symbols-outlined" aria-hidden="true">
        calendar_month
      </span>
    </button>

    <BaseDialog :open="isOpen" :title="label" @close="closePicker">
      <div class="date-picker">
        <header class="date-picker__header">
          <button
            type="button"
            :aria-label="t('common.back')"
            @click="moveMonth(-1)"
          >
            <span class="material-symbols-outlined" aria-hidden="true">
              chevron_left
            </span>
          </button>
          <h3>{{ displayedMonthLabel }}</h3>
          <button
            type="button"
            :aria-label="t('common.next')"
            @click="moveMonth(1)"
          >
            <span class="material-symbols-outlined" aria-hidden="true">
              chevron_right
            </span>
          </button>
        </header>

        <div class="date-picker__weekdays" aria-hidden="true">
          <span v-for="weekday in weekdayLabels" :key="weekday">
            {{ weekday }}
          </span>
        </div>
        <div class="date-picker__grid" role="grid" :aria-label="label">
          <template v-for="(cell, index) in calendarCells" :key="index">
            <button
              v-if="cell"
              class="date-picker__day"
              :class="{ 'is-selected': cell.isoDate === stagedValue }"
              type="button"
              role="gridcell"
              :data-picker-date="cell.isoDate"
              :aria-pressed="cell.isoDate === stagedValue"
              @click="stagedValue = cell.isoDate"
            >
              {{ cell.day }}
            </button>
            <span v-else class="date-picker__filler" aria-hidden="true" />
          </template>
        </div>

        <div class="date-picker__actions">
          <button
            class="secondary-button"
            type="button"
            data-testid="date-picker-clear"
            @click="stagedValue = ''"
          >
            {{ t('common.clear') }}
          </button>
          <button
            class="secondary-button"
            type="button"
            data-testid="date-picker-cancel"
            @click="closePicker"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            class="meeting-primary"
            type="button"
            data-testid="date-picker-done"
            @click="confirmDate"
          >
            {{ t('common.done') }}
          </button>
        </div>
      </div>
    </BaseDialog>
  </div>
</template>
