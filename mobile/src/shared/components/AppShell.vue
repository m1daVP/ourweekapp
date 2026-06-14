<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import BottomNavigation from '@/shared/components/BottomNavigation.vue';
import SyncStatusNotice from '@/shared/components/SyncStatusNotice.vue';
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
const { t } = useI18n();
const mainElement = ref<HTMLElement | null>(null);
const participantsStore = useParticipantsStore();
const recoveryMessages = computed(() => storageRecoveryState.value.messages);
const activeParticipants = computed(() => participantsStore.activeParticipants);
const firstParticipant = computed(() => activeParticipants.value[0] ?? null);
const isMeetingRoute = computed(() => route.name === 'meeting');
const pageTitle = computed(() => {
  const routeName = String(route.name ?? '');

  const titles: Record<string, string> = {
    home: t('app.routeTitles.home'),
    meeting: t('app.routeTitles.meeting'),
    'meeting-templates': t('app.routeTitles.meetingTemplates'),
    tasks: t('app.routeTitles.tasks'),
    history: t('app.routeTitles.history'),
    settings: t('app.routeTitles.settings'),
    upgrade: t('app.routeTitles.upgrade'),
    'private-notes': t('app.routeTitles.privateNotes'),
    'calendar-sync': t('app.routeTitles.calendarSync'),
    'workspace-settings': t('app.routeTitles.workspaceSettings'),
    account: t('app.routeTitles.account'),
    'support-diagnostics': t('app.routeTitles.supportDiagnostics'),
    'meeting-details': t('app.routeTitles.meetingDetails'),
    'meeting-summary': t('app.routeTitles.meetingSummary'),
  };

  return titles[routeName] ?? t('app.name');
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
  <div
    :class="[
      'app-shell',
      {
        'app-shell--with-navigation': showNavigation,
        'app-shell--meeting': isMeetingRoute,
      },
    ]"
  >
    <header v-if="showNavigation" class="app-top-bar">
      <RouterLink
        class="app-top-bar__avatar"
        :to="{ name: 'settings' }"
        :aria-label="t('app.openSettings')"
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
        :aria-label="t('app.householdMembers')"
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
          <strong>{{ t('app.storageAttention') }}</strong>
          <p>
            {{ recoveryMessages[0] }}
          </p>
        </div>
        <button type="button" @click="clearStorageRecoveryMessages">
          {{ t('app.dismiss') }}
        </button>
      </aside>
      <SyncStatusNotice />
      <slot />
    </main>
    <BottomNavigation v-if="showNavigation" />
  </div>
</template>
