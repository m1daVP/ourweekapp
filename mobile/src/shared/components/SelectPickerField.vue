<script setup lang="ts">
import { computed, ref } from 'vue';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';

export type PickerOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    options: ReadonlyArray<PickerOption>;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const isOpen = ref(false);
const selectedLabel = computed(
  () =>
    props.options.find((option) => option.value === props.modelValue)?.label ??
    ''
);

function closePicker() {
  isOpen.value = false;
}

function openPicker() {
  if (!props.disabled) {
    isOpen.value = true;
  }
}

function selectOption(option: PickerOption) {
  if (option.disabled) {
    return;
  }

  emit('update:modelValue', option.value);
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
      <span class="reminder-picker-field__value">{{ selectedLabel }}</span>
      <span class="material-symbols-outlined" aria-hidden="true">
        expand_more
      </span>
    </button>

    <BaseBottomSheet :open="isOpen" :title="label" @close="closePicker">
      <div class="reminder-day-picker">
        <div
          class="reminder-day-picker__options"
          role="group"
          :aria-label="label"
        >
          <button
            v-for="option in options"
            :key="option.value"
            class="reminder-day-picker__option"
            :class="{ 'is-selected': option.value === modelValue }"
            type="button"
            :disabled="option.disabled"
            :data-picker-option="option.value"
            :aria-pressed="option.value === modelValue"
            @click="selectOption(option)"
          >
            <span>{{ option.label }}</span>
            <span
              v-if="option.value === modelValue"
              class="material-symbols-outlined"
              aria-hidden="true"
            >
              check
            </span>
          </button>
        </div>
      </div>
    </BaseBottomSheet>
  </div>
</template>
