<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { FeatureKey } from '@/features/access/types';
import PremiumBadge from '@/shared/components/PremiumBadge.vue';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';

const props = defineProps<{
  feature?: FeatureKey;
  title?: string;
  message?: string;
}>();

const emit = defineEmits<{
  upgrade: [];
}>();

const router = useRouter();
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

function openUpgrade() {
  emit('upgrade');
  router.push({ name: 'upgrade' });
}
</script>

<template>
  <div class="upgrade-prompt">
    <div>
      <PremiumBadge />
      <h2>{{ promptTitle }}</h2>
      <p>{{ promptMessage }}</p>
    </div>
    <button class="secondary-button" type="button" @click="openUpgrade">
      View Premium
    </button>
  </div>
</template>
