<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SubscriptionPlanOption } from '@/features/subscription/types';

const props = defineProps<{
  plan: SubscriptionPlanOption;
  selected?: boolean;
  disabled?: boolean;
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
</script>

<template>
  <button
    type="button"
    :class="['plan-card', { 'is-selected': selected }]"
    :aria-pressed="selected"
    :disabled="disabled"
    @click="$emit('select', plan.id)"
  >
    <span class="plan-card__header">
      <strong>{{ t(`${planMessageKey}.name`) }}</strong>
      <span>{{ t(`${planMessageKey}.priceLabel`) }}</span>
    </span>
    <span class="plan-card__description">
      {{ t(`${planMessageKey}.description`) }}
    </span>
  </button>
</template>
