import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
import { useWorkspaceStore } from '@/app/stores/workspace';
import {
  bindSyncOwner,
  readSyncMetadata,
  resetSyncedAppDataForOwner,
} from '@/shared/services/storageService';
import { resetSyncRuntimeState } from '@/shared/services/syncRuntimeService';

export function prepareSyncForAuthenticatedUser(userId: string) {
  const currentMetadata = readSyncMetadata();

  resetSyncRuntimeState();

  if (currentMetadata.ownerUserId === userId) {
    bindSyncOwner(userId, currentMetadata.ownerWorkspaceId);
    return { didResetSyncedData: false };
  }

  resetSyncedAppDataForOwner(userId);

  const meetingsStore = useMeetingsStore();
  const tasksStore = useTasksStore();
  const participantsStore = useParticipantsStore();
  const workspaceStore = useWorkspaceStore();

  meetingsStore.meetings = [];
  meetingsStore.activeMeetingId = null;
  meetingsStore.draftSavedAt = null;
  tasksStore.tasks = [];
  tasksStore.agreements = [];
  tasksStore.reviewDecisions = [];
  participantsStore.participants = [];
  workspaceStore.resetForAuthenticatedUser(userId);

  return { didResetSyncedData: true };
}

export { resetSyncRuntimeState };
