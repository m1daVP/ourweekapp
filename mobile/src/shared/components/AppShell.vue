<script setup lang="ts">
import { computed } from 'vue';
import BottomNavigation from '@/shared/components/BottomNavigation.vue';
import {
  clearStorageRecoveryMessages,
  storageRecoveryState,
} from '@/shared/services/storageService';

withDefaults(
  defineProps<{
    showNavigation?: boolean;
  }>(),
  {
    showNavigation: true,
  }
);

const recoveryMessages = computed(() => storageRecoveryState.value.messages);
</script>

<template>
  <div class="app-shell">
    <main class="app-main">
      <aside
        v-if="recoveryMessages.length"
        class="storage-recovery-notice"
        aria-live="polite"
      >
        <div>
          <strong>Some saved data needs attention</strong>
          <p>
            {{ recoveryMessages[0] }}
          </p>
        </div>
        <button type="button" @click="clearStorageRecoveryMessages">
          Dismiss
        </button>
      </aside>
      <slot />
    </main>
    <BottomNavigation v-if="showNavigation" />
  </div>
</template>
