<script setup lang="ts">
import type { ButtonHTMLAttributes } from 'vue';

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    type?: ButtonHTMLAttributes['type'];
    disabled?: boolean;
  }>(),
  {
    variant: 'primary',
    type: 'button',
    disabled: false,
  }
);
</script>

<template>
  <button
    :class="['base-button', `base-button--${variant}`]"
    :type="type"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
