<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  getAggregateSyncStatus,
  retrySync,
} from '@/shared/services/syncService';
import { appConfig } from '@/shared/config/env';

const { t } = useI18n();
const isRetrying = ref(false);
const aggregateStatus = computed(() => getAggregateSyncStatus());
const isVisible = computed(
  () => appConfig.isBackendApiEnabled && aggregateStatus.value.state !== 'idle'
);
const message = computed(() => {
  if (aggregateStatus.value.errorMessage) {
    return aggregateStatus.value.errorMessage;
  }

  return t(`sync.${aggregateStatus.value.state}`);
});
const icon = computed(() => {
  if (aggregateStatus.value.state === 'syncing') {
    return 'sync';
  }

  if (aggregateStatus.value.state === 'failed') {
    return 'error';
  }

  if (aggregateStatus.value.state === 'offline') {
    return 'cloud_off';
  }

  return 'check_circle';
});
const canRetry = computed(
  () =>
    aggregateStatus.value.state === 'failed' ||
    aggregateStatus.value.state === 'offline'
);

async function handleRetry() {
  if (isRetrying.value) {
    return;
  }

  isRetrying.value = true;

  try {
    await retrySync();
  } catch (error) {
    void error;
  } finally {
    isRetrying.value = false;
  }
}
</script>

<template>
  <aside
    v-if="isVisible"
    :class="[
      'sync-status-notice',
      `sync-status-notice--${aggregateStatus.state}`,
    ]"
    aria-live="polite"
  >
    <span class="material-symbols-outlined" aria-hidden="true">
      {{ icon }}
    </span>
    <p>{{ message }}</p>
    <button
      v-if="canRetry"
      type="button"
      :disabled="isRetrying"
      @click="handleRetry"
    >
      {{ isRetrying ? t('sync.retrying') : t('sync.retry') }}
    </button>
  </aside>
</template>
