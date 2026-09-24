import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkspaceStore } from '@/app/stores/workspace';
import {
  getWorkspaceRolePermissions,
  roleCan,
  workspaceStatusLabels,
} from '@/features/workspace/permissions';
import type { UserRole } from '@/features/access/types';
import type { WorkspacePermission } from '@/features/workspace/types';

export function useWorkspacePermissions() {
  const workspaceStore = useWorkspaceStore();
  const { t } = useI18n();

  const currentRole = computed(() => workspaceStore.currentUserRole);
  const currentRoleLabel = computed(() => getRoleLabel(currentRole.value));
  const currentPermissions = computed(() =>
    getWorkspaceRolePermissions(currentRole.value)
  );

  function can(permission: WorkspacePermission) {
    return roleCan(currentRole.value, permission);
  }

  function getRoleLabel(role: UserRole) {
    if (role === 'owner') {
      return t('settings.role.owner');
    }

    if (role === 'adult_member') {
      return t('settings.role.adultMember');
    }

    return t('settings.role.viewer');
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
