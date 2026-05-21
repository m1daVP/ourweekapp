import { computed } from 'vue';
import { useWorkspaceStore } from '@/app/stores/workspace';
import {
  getWorkspaceRolePermissions,
  roleCan,
  workspaceRoleLabels,
  workspaceStatusLabels,
} from '@/features/workspace/permissions';
import type { UserRole } from '@/features/access/types';
import type { WorkspacePermission } from '@/features/workspace/types';

export function useWorkspacePermissions() {
  const workspaceStore = useWorkspaceStore();

  const currentRole = computed(() => workspaceStore.currentUserRole);
  const currentRoleLabel = computed(
    () => workspaceRoleLabels[currentRole.value]
  );
  const currentPermissions = computed(() =>
    getWorkspaceRolePermissions(currentRole.value)
  );

  function can(permission: WorkspacePermission) {
    return roleCan(currentRole.value, permission);
  }

  function getRoleLabel(role: UserRole) {
    return workspaceRoleLabels[role];
  }

  function getStatusLabel(status: keyof typeof workspaceStatusLabels): string {
    return workspaceStatusLabels[status];
  }

  return {
    currentRole,
    currentRoleLabel,
    currentPermissions,
    can,
    getRoleLabel,
    getStatusLabel,
  };
}
