<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { canUseFeature, getFeatureAccess, getFeatureAccessState } = useFeatureAccess();
const { t } = useI18n();

const canUse = computed(() => canUseFeature(props.feature));
const featureAccess = computed(() => getFeatureAccess(props.feature));
const accessState = computed(() => getFeatureAccessState(props.feature));
const blockedMessage = computed(() => {
  if (accessState.value === 'roleRestricted') {
    return t('premium.roleRestricted');
  }

  if (accessState.value === 'notYetAvailable') {
    return t('premium.notYetAvailable');
  }

  return t('premium.unavailable');
});
</script>

<template>
  <slot v-if="canUse" />

  <div
    v-else
    class="premium-lock"
    :aria-label="`${featureAccess.label} ${t('common.locked')}`"
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
      v-if="accessState === 'upgradeRequired'"
      class="premium-lock__prompt"
      :feature="feature"
      :title="title"
      :message="message"
    />
    <p v-else class="premium-lock__prompt">{{ blockedMessage }}</p>
  </div>
</template>
