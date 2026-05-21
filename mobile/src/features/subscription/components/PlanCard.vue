<script setup lang="ts">
import type { SubscriptionPlanOption } from '@/features/subscription/types';

defineProps<{
  plan: SubscriptionPlanOption;
  selected?: boolean;
}>();

defineEmits<{
  select: [planId: SubscriptionPlanOption['id']];
}>();
</script>

<template>
  <button
    type="button"
    :class="['plan-card', { 'is-selected': selected }]"
    :aria-pressed="selected"
    @click="$emit('select', plan.id)"
  >
    <span class="plan-card__header">
      <strong>{{ plan.name }}</strong>
      <span>{{ plan.priceLabel }}</span>
    </span>
    <span class="plan-card__description">{{ plan.description }}</span>
  </button>
</template>
