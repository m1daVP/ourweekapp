<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();
const { getFeatureAccess, getFeatureAccessState } = useFeatureAccess();

const featureAccess = computed(() =>
  props.feature ? getFeatureAccess(props.feature) : undefined
);
const canOfferUpgrade = computed(
  () => !props.feature || getFeatureAccessState(props.feature) === 'upgradeRequired'
);
const promptTitle = computed(
  () =>
    props.title ??
    t('premium.title', {
      feature: featureAccess.value?.label ?? t('premium.feature'),
    })
);
const promptMessage = computed(
  () =>
    props.message ?? featureAccess.value?.lockedReason ?? t('premium.message')
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
    <button
      v-if="canOfferUpgrade"
      class="secondary-button"
      type="button"
      @click="openUpgrade"
    >
      {{ t('premium.viewPremium') }}
    </button>
  </div>
</template>
