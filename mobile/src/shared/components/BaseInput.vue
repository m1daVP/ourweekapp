<script setup lang="ts">
withDefaults(
  defineProps<{
    id?: string;
    modelValue?: string;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    autocomplete?: string;
  }>(),
  {
    id: undefined,
    modelValue: '',
    type: 'text',
    placeholder: undefined,
    disabled: false,
    autocomplete: undefined,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <input
    :id="id"
    class="base-input"
    :value="modelValue"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :autocomplete="autocomplete"
    @input="
      emit('update:modelValue', ($event.target as HTMLInputElement).value)
    "
  />
</template>
