import { useAuthStore } from '@/app/stores/auth';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
import { appConfig } from '@/shared/config/env';
import {
  isApplyingRemoteSync,
  markLocalChange,
  retrySync,
  type SyncResource,
} from '@/shared/services/syncService';
import { computed, onMounted, onUnmounted, watch } from 'vue';

const SYNC_DEBOUNCE_MS = 1500;

function serializeMeetingState() {
  const meetingsStore = useMeetingsStore();

  return JSON.stringify({
    meetings: meetingsStore.meetings,
    activeMeetingId: meetingsStore.activeMeetingId,
    draftSavedAt: meetingsStore.draftSavedAt,
  });
}

function serializeTaskState() {
  const tasksStore = useTasksStore();

  return JSON.stringify({
    tasks: tasksStore.tasks,
    agreements: tasksStore.agreements,
    reviewDecisions: tasksStore.reviewDecisions,
  });
}

function serializeParticipantState() {
  return JSON.stringify(useParticipantsStore().participants);
}

export function useCoreDataSync() {
  const authStore = useAuthStore();
  const canSync = computed(
    () => appConfig.isBackendApiEnabled && authStore.isAuthenticated
  );
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  const stopWatchers: Array<() => void> = [];

  function clearSyncTimer() {
    if (!syncTimer) {
      return;
    }

    clearTimeout(syncTimer);
    syncTimer = null;
  }

  function scheduleSync() {
    if (!canSync.value) {
      return;
    }

    clearSyncTimer();
    syncTimer = setTimeout(() => {
      syncTimer = null;
      void retrySync().catch(() => undefined);
    }, SYNC_DEBOUNCE_MS);
  }

  function handleLocalChange(resource: SyncResource) {
    if (!canSync.value || isApplyingRemoteSync.value) {
      return;
    }

    markLocalChange(resource);
    scheduleSync();
  }

  function retryWhenOnline() {
    if (!canSync.value) {
      return;
    }

    void retrySync().catch(() => undefined);
  }

  onMounted(() => {
    stopWatchers.push(
      watch(serializeMeetingState, () => handleLocalChange('meetings')),
      watch(serializeTaskState, () => handleLocalChange('tasks')),
      watch(serializeParticipantState, () => handleLocalChange('participants')),
      watch(canSync, (enabled) => {
        if (enabled) {
          void retrySync().catch(() => undefined);
        }
      })
    );

    if (canSync.value) {
      void retrySync().catch(() => undefined);
    }

    window.addEventListener('online', retryWhenOnline);
  });

  onUnmounted(() => {
    clearSyncTimer();
    stopWatchers.forEach((stop) => stop());
    window.removeEventListener('online', retryWhenOnline);
  });
}
