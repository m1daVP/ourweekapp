<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SubscriptionPlanOption } from '@/features/subscription/types';

const props = defineProps<{
  plan: SubscriptionPlanOption;
  selected?: boolean;
  disabled?: boolean;
  interactive?: boolean;
}>();

const { t } = useI18n();

defineEmits<{
  select: [planId: SubscriptionPlanOption['id']];
}>();

const planMessageKey = computed(() =>
  props.plan.id === 'premium_yearly'
    ? 'upgrade.plans.premiumYearly'
    : 'upgrade.plans.premiumMonthly'
);
const planTitleId = computed(() => `plan-card-title-${props.plan.id}`);
</script>

<template>
  <button
    v-if="interactive !== false"
    type="button"
    :class="['plan-card', { 'is-selected': selected }]"
    :aria-pressed="selected"
    :disabled="disabled"
    @click="$emit('select', plan.id)"
  >
    <span class="plan-card__header">
      <strong>{{ t(`${planMessageKey}.name`) }}</strong>
      <span>{{ plan.priceLabel }}</span>
    </span>
    <span class="plan-card__description">
      {{ t(`${planMessageKey}.description`) }}
    </span>
  </button>

  <article v-else class="plan-card" :aria-labelledby="planTitleId">
    <span class="plan-card__header">
      <strong :id="planTitleId">{{ t(`${planMessageKey}.name`) }}</strong>
      <span>{{ plan.priceLabel }}</span>
    </span>
    <span class="plan-card__description">
      {{ t(`${planMessageKey}.description`) }}
    </span>
  </article>
</template>
