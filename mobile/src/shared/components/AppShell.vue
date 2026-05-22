<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import BottomNavigation from '@/shared/components/BottomNavigation.vue';
import { useParticipantsStore } from '@/app/stores/participants';
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

const route = useRoute();
const mainElement = ref<HTMLElement | null>(null);
const participantsStore = useParticipantsStore();
const recoveryMessages = computed(() => storageRecoveryState.value.messages);
const activeParticipants = computed(() => participantsStore.activeParticipants);
const firstParticipant = computed(() => activeParticipants.value[0] ?? null);
const pageTitle = computed(() => {
  const routeName = String(route.name ?? '');

  const titles: Record<string, string> = {
    home: 'Weekly Us',
    meeting: 'Weekly Ritual',
    'meeting-templates': 'Choose a Template',
    tasks: 'Tasks',
    history: 'History',
    settings: 'Settings',
    upgrade: 'Premium',
    'private-notes': 'Private Notes',
    'calendar-sync': 'Calendar Sync',
    'workspace-settings': 'Household',
    account: 'Account',
    'meeting-details': 'Meeting Summary',
  };

  return titles[routeName] ?? 'Weekly Us';
});

watch(
  () => route.fullPath,
  async () => {
    await nextTick();
    mainElement.value?.scrollTo({ top: 0, left: 0 });
  }
);
</script>

<template>
  <div class="app-shell">
    <header v-if="showNavigation" class="app-top-bar">
      <RouterLink
        class="app-top-bar__avatar"
        :to="{ name: 'settings' }"
        aria-label="Open settings"
      >
        <span
          v-if="firstParticipant"
          :style="{ backgroundColor: firstParticipant.avatarColor }"
        >
          {{ firstParticipant.initials }}
        </span>
        <span v-else>WU</span>
      </RouterLink>
      <h1>{{ pageTitle }}</h1>
      <RouterLink
        class="app-top-bar__icon material-symbols-outlined"
        :to="{ name: 'workspace-settings' }"
        aria-label="Household members"
      >
        group_work
      </RouterLink>
    </header>
    <main ref="mainElement" class="app-main">
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
