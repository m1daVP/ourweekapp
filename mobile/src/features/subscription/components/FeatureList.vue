<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { PlanBenefit } from '@/features/subscription/types';

defineProps<{
  features: PlanBenefit[];
}>();

const { t } = useI18n();
</script>

<template>
  <ul class="subscription-feature-list">
    <li v-for="feature in features" :key="feature.label">
      <span class="subscription-feature-list__mark" aria-hidden="true" />
      <p>
        {{
          feature.featureKey
            ? t(`features.${feature.featureKey}.label`)
            : feature.label
        }}
      </p>
    </li>
  </ul>
</template>
