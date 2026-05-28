<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{
  status: 'open' | 'done' | 'skipped' | 'draft' | 'finished' | 'premium';
}>();

const { t } = useI18n();

const statusLabel = computed(() => ({
  open: t('common.open'),
  done: t('common.done'),
  skipped: t('common.skipped'),
  draft: t('common.draft'),
  finished: t('common.finished'),
  premium: t('premium.badge'),
}));
</script>

<template>
  <span :class="['status-badge', `status-badge--${status}`]">
    {{ statusLabel[status] }}
  </span>
</template>
