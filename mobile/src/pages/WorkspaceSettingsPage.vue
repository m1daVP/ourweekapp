<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useWorkspaceStore } from '@/app/stores/workspace';
import type { UserRole } from '@/features/access/types';
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';

const workspaceStore = useWorkspaceStore();
const {
  can,
  currentPermissions,
  currentRoleLabel,
  getRoleLabel,
  getStatusLabel,
} = useWorkspacePermissions();

const workspaceName = ref(workspaceStore.workspace.name);
const statusMessage = ref('');
const errorMessage = ref('');
const inviteDraft = reactive({
  displayName: '',
  email: '',
  role: 'adult_member' as Exclude<UserRole, 'owner'>,
});

const roleOptions: Array<{ label: string; value: Exclude<UserRole, 'owner'> }> =
  [
    { label: 'Adult member', value: 'adult_member' },
    { label: 'Viewer', value: 'viewer' },
  ];

const memberOptions = computed(() =>
  workspaceStore.visibleMembers.filter((member) => member.status !== 'removed')
);
const permissionLabels: Record<string, string> = {
  manageWorkspace: 'Manage workspace',
  inviteMembers: 'Invite or remove members',
  removeMembers: 'Remove members',
  manageSubscription: 'Manage subscription',
  createMeetings: 'Create meetings',
  editMeetings: 'Edit meetings',
  deleteMeetings: 'Delete meetings',
  createTasks: 'Create tasks',
  editTasks: 'Edit tasks',
  deleteTasks: 'Delete tasks',
  viewHistory: 'View meeting history',
  viewSelectedSummariesAndTasks: 'View shared summaries and tasks',
};

watch(
  () => workspaceStore.workspace.name,
  (name) => {
    workspaceName.value = name;
  }
);

function clearMessages() {
  statusMessage.value = '';
  errorMessage.value = '';
}

function saveWorkspaceName() {
  clearMessages();

  if (!can('manageWorkspace')) {
    errorMessage.value = 'Only the owner can rename the workspace.';
    return;
  }

  if (!workspaceStore.updateWorkspaceName(workspaceName.value)) {
    errorMessage.value = 'Add a workspace name first.';
    return;
  }

  statusMessage.value = 'Workspace updated.';
}

function inviteMember() {
  clearMessages();

  if (!can('inviteMembers')) {
    errorMessage.value = 'Only the owner can invite members.';
    return;
  }

  const member = workspaceStore.inviteMember(inviteDraft);

  if (!member) {
    errorMessage.value = 'Add a name first.';
    return;
  }

  inviteDraft.displayName = '';
  inviteDraft.email = '';
  inviteDraft.role = 'adult_member';
  statusMessage.value =
    'Invitation saved locally. No email has been sent in this MVP.';
}

function updateMemberRole(userId: string, event: Event) {
  clearMessages();

  if (!can('manageWorkspace')) {
    errorMessage.value = 'Only the owner can change roles.';
    return;
  }

  const role = (event.target as HTMLSelectElement).value as UserRole;
  workspaceStore.updateMemberRole(userId, role);
  statusMessage.value = 'Member role updated.';
}

function removeMember(userId: string) {
  clearMessages();

  if (!can('removeMembers')) {
    errorMessage.value = 'Only the owner can remove members.';
    return;
  }

  workspaceStore.removeMember(userId);
  statusMessage.value = 'Member removed from the workspace.';
}

function switchCurrentMember(event: Event) {
  const userId = (event.target as HTMLSelectElement).value;
  workspaceStore.setCurrentUser(userId);
}
</script>

<template>
  <section class="page-stack workspace-page">
    <div>
      <p class="page-kicker">Workspace</p>
      <h1>Family workspace</h1>
      <p class="page-copy">
        A simple shared space for the people who use Weekly Us together.
      </p>
    </div>

    <section class="content-panel settings-panel">
      <div>
        <h2>Workspace name</h2>
        <p>
          Stored locally for now. Backend sync and real invitations can be added
          later.
        </p>
      </div>
      <label class="workspace-field">
        <span>Name</span>
        <input
          v-model="workspaceName"
          type="text"
          :disabled="!can('manageWorkspace')"
        />
      </label>
      <button
        class="meeting-primary"
        type="button"
        :disabled="!can('manageWorkspace')"
        @click="saveWorkspaceName"
      >
        Save workspace
      </button>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>Members</h2>
        <p>Roles keep editing rules calm and predictable.</p>
      </div>

      <ul class="workspace-member-list">
        <li
          v-for="member in workspaceStore.visibleMembers"
          :key="member.userId"
        >
          <div class="workspace-member-list__body">
            <strong>{{ member.displayName }}</strong>
            <span v-if="member.email">{{ member.email }}</span>
            <small>
              {{ getRoleLabel(member.role) }} -
              {{ getStatusLabel(member.status) }}
              <template v-if="member.userId === workspaceStore.currentUserId">
                - Current view
              </template>
            </small>
          </div>

          <div class="workspace-member-list__actions">
            <select
              :value="member.role"
              :disabled="
                !can('manageWorkspace') ||
                member.userId === workspaceStore.workspace.ownerId
              "
              @change="updateMemberRole(member.userId, $event)"
            >
              <option value="owner">Owner</option>
              <option value="adult_member">Adult member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="button"
              :disabled="
                !can('removeMembers') ||
                member.userId === workspaceStore.workspace.ownerId
              "
              @click="removeMember(member.userId)"
            >
              Remove
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>Invite member</h2>
        <p>This only creates a local placeholder. No email is sent yet.</p>
      </div>
      <form class="workspace-invite-form" @submit.prevent="inviteMember">
        <label>
          <span>Name</span>
          <input
            v-model="inviteDraft.displayName"
            type="text"
            placeholder="Name"
            :disabled="!can('inviteMembers')"
          />
        </label>
        <label>
          <span>Email optional</span>
          <input
            v-model="inviteDraft.email"
            type="email"
            placeholder="name@example.com"
            :disabled="!can('inviteMembers')"
          />
        </label>
        <label>
          <span>Role</span>
          <select v-model="inviteDraft.role" :disabled="!can('inviteMembers')">
            <option
              v-for="role in roleOptions"
              :key="role.value"
              :value="role.value"
            >
              {{ role.label }}
            </option>
          </select>
        </label>
        <button
          class="meeting-primary"
          type="submit"
          :disabled="!can('inviteMembers')"
        >
          Add invite placeholder
        </button>
      </form>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>Current role</h2>
        <p>{{ currentRoleLabel }} access is active in this local MVP.</p>
      </div>
      <label class="workspace-field">
        <span>View as</span>
        <select
          :value="workspaceStore.currentUserId"
          @change="switchCurrentMember"
        >
          <option
            v-for="member in memberOptions"
            :key="member.userId"
            :value="member.userId"
          >
            {{ member.displayName }} - {{ getRoleLabel(member.role) }}
          </option>
        </select>
      </label>
      <ul class="workspace-permission-list">
        <li v-for="permission in currentPermissions" :key="permission">
          {{ permissionLabels[permission] }}
        </li>
      </ul>
      <p class="meeting-help">
        Owners manage the workspace and subscription. Adult members can help run
        meetings and tasks. Viewers are read-only.
      </p>
    </section>

    <section class="content-panel settings-panel">
      <div>
        <h2>Subscription</h2>
        <p>
          {{ can('manageSubscription') ? 'Owner access.' : 'Owner only.' }}
          Real payments are not implemented in this MVP.
        </p>
      </div>
    </section>

    <p v-if="statusMessage" class="meeting-status" role="status">
      {{ statusMessage }}
    </p>
    <p v-if="errorMessage" class="meeting-error" role="alert">
      {{ errorMessage }}
    </p>
  </section>
</template>
