<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { AiRecapRecovery } from '../aiSummaryService';

defineProps<{ recovery: AiRecapRecovery }>();

const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="ai-recap-recovery" role="alert">
    <p>{{ t(recovery.messageKey, recovery.messageParams) }}</p>
    <p v-if="recovery.requestId" class="ai-recap-recovery__reference">
      {{ t('ai.recap.supportReference', { requestId: recovery.requestId }) }}
    </p>
    <button
      v-if="recovery.retryable"
      data-testid="retry-meeting-recap"
      type="button"
      @click="emit('retry')"
    >
      {{ t('ai.recap.retry') }}
    </button>
  </div>
</template>

<style scoped>
.ai-recap-recovery {
  display: grid;
  gap: var(--space-2, 8px);
}

.ai-recap-recovery p {
  margin: 0;
}

.ai-recap-recovery__reference {
  font-size: 0.875rem;
}

.ai-recap-recovery button {
  min-height: 48px;
  justify-self: start;
  padding: 8px 16px;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm, 8px);
  color: inherit;
  background: transparent;
  font: inherit;
}
</style>
