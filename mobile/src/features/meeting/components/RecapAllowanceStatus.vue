<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { canPurchasePremium } from '@/features/access/premiumPurchasePolicy';

interface RecapAllowanceStatusProps {
  showAction: boolean;
  canGenerate: boolean;
  generating: boolean;
  generateLabel: string;
}

const props = defineProps<RecapAllowanceStatusProps>();
const emit = defineEmits<{
  generate: [];
  upgrade: [];
}>();
const subscription = useSubscriptionStore();
const workspace = useWorkspaceStore();
const { t } = useI18n();

const recap = computed(() => subscription.assistantRecap);
const isRoleRestricted = computed(
  () =>
    workspace.currentUserRole === 'viewer' ||
    (recap.value !== null &&
      !recap.value.canGenerate &&
      recap.value.remaining > 0)
);
const hasAllowancePanel = computed(
  () =>
    recap.value !== null &&
    !subscription.isCheckingRecapAllowance &&
    !isRoleRestricted.value
);
const isPremium = computed(() => subscription.currentPlan === 'premium');
const isExhausted = computed(() => (recap.value?.remaining ?? 0) <= 0);
const canOfferUpgrade = computed(
  () =>
    props.showAction &&
    hasAllowancePanel.value &&
    isExhausted.value &&
    canPurchasePremium(workspace.currentUserRole)
);
const canShowGenerateAction = computed(
  () =>
    props.showAction &&
    hasAllowancePanel.value &&
    !isExhausted.value &&
    props.canGenerate
);
const freeDotCount = computed(() =>
  Math.min(3, Math.max(0, recap.value?.limit ?? 0))
);
const filledFreeDotCount = computed(() => {
  if (!recap.value || recap.value.limit <= 0) return 0;

  return Math.min(
    freeDotCount.value,
    Math.ceil((recap.value.remaining / recap.value.limit) * freeDotCount.value)
  );
});
const premiumProgress = computed(() => {
  if (!recap.value || recap.value.limit <= 0) return 0;

  return Math.min(
    100,
    Math.max(0, Math.round((recap.value.remaining / recap.value.limit) * 100))
  );
});
const fallbackMessage = computed(() => {
  if (workspace.currentUserRole === 'viewer') return t('ai.recap.restricted');
  if (subscription.isCheckingRecapAllowance) return t('ai.recap.checking');
  if (!recap.value) return t('ai.recap.unavailable');
  return t('ai.recap.restricted');
});
const canRefresh = computed(
  () =>
    !hasAllowancePanel.value &&
    workspace.currentUserRole !== 'viewer' &&
    !subscription.canGenerateAssistantRecap
);
</script>

<template>
  <div class="recap-allowance-status">
    <template v-if="hasAllowancePanel && recap">
      <section
        v-if="!isPremium"
        class="recap-allowance-status__panel recap-allowance-status__panel--free"
        role="status"
      >
        <div class="recap-allowance-status__free-header">
          <strong data-testid="recap-allowance-counter">
            {{
              t('ai.recap.freeCounter', {
                remaining: recap.remaining,
                limit: recap.limit,
              })
            }}
          </strong>
          <span
            v-if="recap.remaining === 1"
            class="recap-allowance-status__badge"
            data-testid="recap-allowance-last"
          >
            {{ t('ai.recap.freeLast') }}
          </span>
          <span v-else-if="isExhausted" class="recap-allowance-status__badge">
            {{ t('ai.recap.freeExhaustedLabel') }}
          </span>
          <span v-else class="recap-allowance-status__dots" aria-hidden="true">
            <i
              v-for="dot in freeDotCount"
              :key="dot"
              :class="{ 'is-filled': dot <= filledFreeDotCount }"
            />
          </span>
        </div>
        <p v-if="isExhausted" class="recap-allowance-status__description">
          {{ t('ai.recap.freeExhaustedBody') }}
        </p>
      </section>

      <section
        v-else
        class="recap-allowance-status__panel recap-allowance-status__panel--premium"
        role="status"
      >
        <div class="recap-allowance-status__premium-header">
          <span class="recap-allowance-status__plan-label">
            <span class="material-symbols-outlined" aria-hidden="true">
              auto_awesome
            </span>
            {{ t('ai.recap.premiumAvailable') }}
          </span>
          <strong data-testid="recap-allowance-counter">
            {{
              t('ai.recap.premiumCounter', {
                remaining: recap.remaining,
                limit: recap.limit,
              })
            }}
          </strong>
        </div>
        <div class="recap-allowance-status__premium-progress-row">
          <div
            class="recap-allowance-status__progress"
            data-testid="recap-allowance-progress"
            role="progressbar"
            :aria-valuenow="premiumProgress"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span :style="{ width: `${premiumProgress}%` }" />
          </div>
          <span class="recap-allowance-status__progress-label">
            {{
              isExhausted
                ? t('ai.recap.premiumExhaustedLabel')
                : recap.remaining === recap.limit
                  ? t('ai.recap.premiumFull', { limit: recap.limit })
                  : t('ai.recap.premiumRemainingLabel', {
                      remaining: recap.remaining,
                    })
            }}
          </span>
        </div>
        <p v-if="isExhausted" class="recap-allowance-status__description">
          {{ t('ai.recap.premiumExhaustedBody') }}
        </p>
      </section>

      <button
        v-if="canShowGenerateAction"
        class="meeting-summary-ai-card__button recap-allowance-status__action"
        data-testid="recap-allowance-generate"
        type="button"
        :disabled="generating"
        @click="emit('generate')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">
          auto_awesome
        </span>
        {{ generateLabel }}
      </button>
      <button
        v-else-if="canOfferUpgrade"
        class="meeting-summary-ai-card__button recap-allowance-status__action"
        data-testid="recap-allowance-upgrade"
        type="button"
        @click="emit('upgrade')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">
          auto_awesome
        </span>
        {{
          isPremium ? t('ai.recap.updatePlan') : t('ai.recap.upgradeToPremium')
        }}
      </button>
    </template>

    <template v-else>
      <p role="status">{{ fallbackMessage }}</p>
      <button
        v-if="canRefresh"
        type="button"
        :disabled="subscription.isCheckingRecapAllowance"
        @click="subscription.refreshCurrentPlan()"
      >
        {{ t('ai.recap.refresh') }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.recap-allowance-status {
  display: grid;
  gap: var(--space-3, 12px);
}

.recap-allowance-status__panel {
  display: grid;
  gap: var(--space-3, 12px);
  border: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 38%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(
    in srgb,
    var(--color-surface-container) 72%,
    var(--color-surface-lowest)
  );
  padding: 16px;
  color: var(--color-on-surface);
}

.recap-allowance-status__free-header,
.recap-allowance-status__premium-header,
.recap-allowance-status__premium-progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3, 12px);
}

.recap-allowance-status__free-header strong,
.recap-allowance-status__plan-label,
.recap-allowance-status__progress-label {
  font-size: var(--font-size-label-lg);
  font-weight: 700;
  line-height: 1.35;
}

.recap-allowance-status__free-header strong {
  min-width: 0;
}

.recap-allowance-status__badge,
.recap-allowance-status__premium-header > strong {
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--color-secondary) 30%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(
    in srgb,
    var(--color-secondary-container) 42%,
    var(--color-surface-lowest)
  );
  padding: 5px 10px;
  color: var(--color-secondary);
  font-size: var(--font-size-label-md);
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.recap-allowance-status__dots {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
}

.recap-allowance-status__dots i {
  width: 10px;
  height: 10px;
  border: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 56%, transparent);
  border-radius: var(--radius-pill);
  background: var(--color-surface-lowest);
}

.recap-allowance-status__dots i.is-filled {
  border-color: var(--color-secondary);
  background: var(--color-secondary);
}

.recap-allowance-status__plan-label {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.recap-allowance-status__plan-label .material-symbols-outlined {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--radius-pill);
  background: color-mix(
    in srgb,
    var(--color-secondary-container) 46%,
    var(--color-surface-lowest)
  );
  color: var(--color-secondary);
  font-size: 1rem;
}

.recap-allowance-status__premium-progress-row {
  align-items: center;
}

.recap-allowance-status__progress {
  height: 8px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: color-mix(
    in srgb,
    var(--color-outline-variant) 24%,
    var(--color-surface-lowest)
  );
}

.recap-allowance-status__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-secondary);
  transition: width 160ms ease;
}

.recap-allowance-status__progress-label {
  flex: 0 0 auto;
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label-md);
}

.recap-allowance-status__description {
  margin: 0;
  border-top: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 34%, transparent);
  padding-top: var(--space-3, 12px);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-body-sm);
  line-height: 1.55;
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

.recap-allowance-status__action.recap-allowance-status__action {
  justify-self: stretch;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  padding: 0 20px;
  color: var(--color-on-primary);
}

.recap-allowance-status button:disabled {
  opacity: 0.65;
}

@media (max-width: 360px) {
  .recap-allowance-status__panel {
    padding: 14px;
  }

  .recap-allowance-status__free-header,
  .recap-allowance-status__premium-header {
    align-items: flex-start;
  }

  .recap-allowance-status__free-header strong,
  .recap-allowance-status__plan-label {
    font-size: var(--font-size-label-md);
  }
}
</style>
