import { shallowRef } from 'vue';

export type SyncResource = 'meetings' | 'tasks' | 'participants';
export type SyncState =
  'idle' | 'savedLocally' | 'syncing' | 'synced' | 'failed' | 'offline';

export interface ResourceSyncStatus {
  state: SyncState;
  lastSyncedAt?: string;
  lastAttemptedAt?: string;
  conflictCount: number;
  errorMessage?: string;
}

export const syncStatus = shallowRef<Record<SyncResource, ResourceSyncStatus>>({
  meetings: { state: 'idle', conflictCount: 0 },
  tasks: { state: 'idle', conflictCount: 0 },
  participants: { state: 'idle', conflictCount: 0 },
});
export const isApplyingRemoteSync = shallowRef(false);

let remoteSyncDepth = 0;
let remoteSyncClearTimeout: ReturnType<typeof setTimeout> | null = null;
let hasCompletedInitialHydration = false;

export function beginRemoteSync() {
  if (remoteSyncClearTimeout) {
    clearTimeout(remoteSyncClearTimeout);
    remoteSyncClearTimeout = null;
  }

  remoteSyncDepth += 1;
  isApplyingRemoteSync.value = true;
}

export function endRemoteSyncSoon() {
  remoteSyncClearTimeout = setTimeout(() => {
    remoteSyncDepth = Math.max(0, remoteSyncDepth - 1);

    if (remoteSyncDepth === 0) {
      isApplyingRemoteSync.value = false;
    }
  }, 0);
}

export function hasInitialHydrationCompleted() {
  return hasCompletedInitialHydration;
}

export function markInitialHydrationComplete() {
  hasCompletedInitialHydration = true;
}

export function resetSyncRuntimeState() {
  if (remoteSyncClearTimeout) {
    clearTimeout(remoteSyncClearTimeout);
    remoteSyncClearTimeout = null;
  }

  hasCompletedInitialHydration = false;
  remoteSyncDepth = 0;
  isApplyingRemoteSync.value = false;
  syncStatus.value = {
    meetings: { state: 'idle', conflictCount: 0 },
    tasks: { state: 'idle', conflictCount: 0 },
    participants: { state: 'idle', conflictCount: 0 },
  };
}
