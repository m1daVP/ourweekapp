<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useWorkspaceStore } from '@/app/stores/workspace';

const subscription = useSubscriptionStore();
const workspace = useWorkspaceStore();
const { t, locale } = useI18n();
const statusMessage = computed(() => {
  if (workspace.currentUserRole === 'viewer') return t('ai.recap.restricted');
  if (subscription.isCheckingRecapAllowance) return t('ai.recap.checking');
  const recap = subscription.assistantRecap;
  if (!recap) return t('ai.recap.unavailable');
  if (!recap.canGenerate && recap.remaining > 0)
    return t('ai.recap.restricted');
  if (recap.periodEndsAt === null) {
    return recap.remaining > 0
      ? t('ai.recap.freeRemaining', { count: recap.remaining })
      : t('ai.recap.freeExhausted');
  }
  const renewal = new Date(recap.periodEndsAt);
  if (Number.isNaN(renewal.getTime())) {
    return t('ai.recap.premiumNoDate', {
      count: recap.remaining,
      limit: recap.limit,
    });
  }
  const date = new Intl.DateTimeFormat(locale.value, {
    day: 'numeric',
    month: 'long',
  }).format(renewal);
  return recap.remaining > 0
    ? t('ai.recap.premiumRemaining', {
        count: recap.remaining,
        limit: recap.limit,
        date,
      })
    : t('ai.recap.premiumExhausted', { date });
});
const canRefresh = computed(
  () =>
    workspace.currentUserRole !== 'viewer' &&
    !subscription.canGenerateAssistantRecap
);
</script>

<template>
  <div class="recap-allowance-status">
    <p role="status">{{ statusMessage }}</p>
    <button
      v-if="canRefresh"
      type="button"
      :disabled="subscription.isCheckingRecapAllowance"
      @click="subscription.refreshCurrentPlan()"
    >
      {{ t('ai.recap.refresh') }}
    </button>
  </div>
</template>

<style scoped>
.recap-allowance-status {
  display: grid;
  gap: var(--space-2, 8px);
  margin-block: var(--space-2, 8px);
}
.recap-allowance-status p {
  margin: 0;
  font-size: 0.875rem;
}
.recap-allowance-status button {
  min-height: 48px;
  justify-self: start;
  padding: 8px 16px;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm, 8px);
  color: inherit;
  background: transparent;
  font: inherit;
}
.recap-allowance-status button:disabled {
  opacity: 0.65;
}
</style>
