<script setup lang="ts">
import { computed } from 'vue';
import type { FeatureKey } from '@/features/access/types';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';
import UpgradePrompt from './UpgradePrompt.vue';

const props = withDefaults(
  defineProps<{
    feature: FeatureKey;
    title?: string;
    message?: string;
    showPreview?: boolean;
  }>(),
  {
    title: undefined,
    message: undefined,
    showPreview: true,
  }
);

const { canUseFeature, getFeatureAccess } = useFeatureAccess();

const canUse = computed(() => canUseFeature(props.feature));
const featureAccess = computed(() => getFeatureAccess(props.feature));
</script>

<template>
  <slot v-if="canUse" />

  <div
    v-else
    class="premium-lock"
    :aria-label="`${featureAccess.label} locked`"
  >
    <div
      v-if="showPreview"
      class="premium-lock__preview"
      aria-hidden="true"
      inert
    >
      <slot />
    </div>
    <UpgradePrompt
      class="premium-lock__prompt"
      :feature="feature"
      :title="title"
      :message="message"
    />
  </div>
</template>
