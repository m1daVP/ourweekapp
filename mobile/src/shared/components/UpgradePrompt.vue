<script setup lang="ts">
import { computed } from 'vue';
import type { FeatureKey } from '@/features/access/types';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';

const props = defineProps<{
  feature?: FeatureKey;
  title?: string;
  message?: string;
}>();

defineEmits<{
  upgrade: [];
}>();

const { getFeatureAccess } = useFeatureAccess();

const featureAccess = computed(() =>
  props.feature ? getFeatureAccess(props.feature) : undefined
);
const promptTitle = computed(
  () =>
    props.title ??
    `${featureAccess.value?.label ?? 'Premium feature'} is premium`
);
const promptMessage = computed(
  () =>
    props.message ??
    featureAccess.value?.lockedReason ??
    'Upgrade to use this feature.'
);
</script>

<template>
  <div class="upgrade-prompt">
    <div>
      <p class="upgrade-prompt__eyebrow">Premium</p>
      <h2>{{ promptTitle }}</h2>
      <p>{{ promptMessage }}</p>
    </div>
    <button class="secondary-button" type="button" @click="$emit('upgrade')">
      Upgrade
    </button>
  </div>
</template>
