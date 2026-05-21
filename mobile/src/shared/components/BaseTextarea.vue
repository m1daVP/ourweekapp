<script setup lang="ts">
withDefaults(
  defineProps<{
    id?: string;
    modelValue?: string;
    rows?: number;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    id: undefined,
    modelValue: '',
    rows: 4,
    placeholder: undefined,
    disabled: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <textarea
    :id="id"
    class="base-textarea"
    :value="modelValue"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="
      emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)
    "
  />
</template>
