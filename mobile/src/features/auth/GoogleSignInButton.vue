<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  disabled?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();

const { t } = useI18n();
</script>

<template>
  <button
    class="google-sign-in-button"
    type="button"
    :disabled="disabled || loading"
    :aria-label="t('auth.continueWithGoogle')"
    @click="emit('click')"
  >
    <span class="google-sign-in-button__mark" aria-hidden="true">G</span>
    <span>
      {{
        loading ? t('auth.continuingWithGoogle') : t('auth.continueWithGoogle')
      }}
    </span>
  </button>
</template>

<style scoped>
.google-sign-in-button {
  display: inline-flex;
  min-height: 48px;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  border: 1px solid rgba(47, 43, 38, 0.18);
  border-radius: var(--radius-sm);
  background: #fff;
  color: var(--color-text);
  font: inherit;
  font-weight: 700;
}

.google-sign-in-button:active {
  transform: translateY(1px);
}

.google-sign-in-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.google-sign-in-button__mark {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: #f6f7f9;
  color: #1f1b16;
  font-size: 1rem;
  font-weight: 800;
}
</style>
