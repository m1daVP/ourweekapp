<script setup lang="ts">
import type { PlanBenefit } from '@/features/subscription/types';

defineProps<{
  features: PlanBenefit[];
}>();
</script>

<template>
  <ul class="subscription-feature-list">
    <li v-for="feature in features" :key="feature.label">
      <span class="subscription-feature-list__mark" aria-hidden="true" />
      <p>{{ feature.label }}</p>
    </li>
  </ul>
</template>
