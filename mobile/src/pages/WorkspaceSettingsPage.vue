<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useWorkspaceStore } from '@/app/stores/workspace';
import type { UserRole } from '@/features/access/types';
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';

const workspaceStore = useWorkspaceStore();
const { can, getRoleLabel } = useWorkspacePermissions();

const isInviteSheetOpen = ref(false);
const statusMessage = ref('');
const errorMessage = ref('');
const inviteDraft = reactive({
  contact: '',
  role: 'adult_member' as Exclude<UserRole, 'owner'>,
});

const roleOptions: Array<{ label: string; value: Exclude<UserRole, 'owner'> }> =
  [
    { label: 'Member', value: 'adult_member' },
    { label: 'Viewer', value: 'viewer' },
  ];

const activeMembers = computed(() =>
  workspaceStore.visibleMembers.filter((member) => member.status === 'active')
);
const pendingInvites = computed(() =>
  workspaceStore.visibleMembers.filter((member) => member.status === 'invited')
);

function clearMessages() {
  statusMessage.value = '';
  errorMessage.value = '';
}

function openInviteSheet() {
  clearMessages();
  isInviteSheetOpen.value = true;
}

function closeInviteSheet() {
  isInviteSheetOpen.value = false;
}

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

function getMemberTone(index: number) {
  const tones = ['#5d7c60', '#976871', '#7e5622', '#5f7f82'];
  return tones[index % tones.length];
}

function getInviteName(contact: string) {
  const trimmedContact = contact.trim();

  if (!trimmedContact.includes('@')) {
    return trimmedContact;
  }

  return trimmedContact.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Member';
}

function inviteMember() {
  clearMessages();

  if (!can('inviteMembers')) {
    errorMessage.value = 'Only the owner can invite members.';
    return;
  }

  const contact = inviteDraft.contact.trim();

  if (!contact) {
    errorMessage.value = 'Add an email or phone number first.';
    return;
  }

  const member = workspaceStore.inviteMember({
    displayName: getInviteName(contact),
    email: contact.includes('@') ? contact : undefined,
    role: inviteDraft.role,
  });

  if (!member) {
    errorMessage.value = 'Could not save this invite.';
    return;
  }

  inviteDraft.contact = '';
  inviteDraft.role = 'adult_member';
  statusMessage.value =
    'Invitation saved locally. No email has been sent in this MVP.';
  closeInviteSheet();
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
</script>

<template>
  <section class="page-stack workspace-page workspace-members-page">
    <header class="workspace-members-hero">
      <h1>Household Members</h1>
      <p class="page-copy">Manage who has access to your shared space.</p>
    </header>

    <section class="workspace-member-cards" aria-label="Current members">
      <article
        v-for="(member, index) in activeMembers"
        :key="member.userId"
        class="workspace-member-card"
      >
        <span
          class="workspace-member-card__avatar"
          :style="{ backgroundColor: getMemberTone(index) }"
        >
          {{ getInitials(member.displayName) }}
        </span>
        <span class="workspace-member-card__body">
          <strong>{{ member.displayName }}</strong>
          <small>
            {{
              member.role === 'owner'
                ? 'Admin'
                : getRoleLabel(member.role).replace('Adult member', 'Member')
            }}
          </small>
        </span>
        <button
          v-if="member.userId !== workspaceStore.workspace.ownerId"
          class="workspace-member-card__remove material-symbols-outlined"
          type="button"
          aria-label="Remove member"
          @click="removeMember(member.userId)"
        >
          close
        </button>
      </article>
    </section>

    <section
      v-if="pendingInvites.length"
      class="workspace-pending-invites"
      aria-labelledby="pending-invites-title"
    >
      <h2 id="pending-invites-title">Pending Invites</h2>
      <article
        v-for="invite in pendingInvites"
        :key="invite.userId"
        class="workspace-invite-card"
      >
        <span class="workspace-invite-card__icon material-symbols-outlined">
          mail
        </span>
        <span class="workspace-invite-card__body">
          <strong>{{ invite.email ?? invite.displayName }}</strong>
          <small>Saved locally</small>
        </span>
        <button type="button" @click="statusMessage = 'Invite kept locally.'">
          Resend
        </button>
      </article>
    </section>

    <p v-if="statusMessage" class="meeting-status" role="status">
      {{ statusMessage }}
    </p>
    <p v-if="errorMessage" class="meeting-error" role="alert">
      {{ errorMessage }}
    </p>

    <div class="workspace-invite-dock">
      <button
        class="meeting-primary"
        type="button"
        :disabled="!can('inviteMembers')"
        @click="openInviteSheet"
      >
        <span class="material-symbols-outlined" aria-hidden="true">
          person_add
        </span>
        Invite New Member
      </button>
    </div>

    <div
      v-if="isInviteSheetOpen"
      class="workspace-invite-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-sheet-title"
    >
      <button
        class="workspace-invite-sheet__scrim"
        type="button"
        aria-label="Close invite form"
        @click="closeInviteSheet"
      />
      <form
        class="workspace-invite-sheet__panel"
        @submit.prevent="inviteMember"
      >
        <header>
          <button
            class="material-symbols-outlined"
            type="button"
            aria-label="Go back"
            @click="closeInviteSheet"
          >
            arrow_back
          </button>
          <h2 id="invite-sheet-title">Add Member</h2>
        </header>

        <label>
          <span>Email or Phone Number</span>
          <input
            v-model="inviteDraft.contact"
            autocomplete="email"
            inputmode="email"
            type="text"
            placeholder="Enter email or phone number"
          />
        </label>

        <label>
          <span>Role</span>
          <select v-model="inviteDraft.role">
            <option
              v-for="role in roleOptions"
              :key="role.value"
              :value="role.value"
            >
              {{ role.label }}
            </option>
          </select>
        </label>

        <p>
          Invited members will receive a link to join your household's weekly
          ritual once backend invitations are connected.
        </p>

        <p v-if="errorMessage" class="meeting-error" role="alert">
          {{ errorMessage }}
        </p>

        <button class="meeting-primary" type="submit">Send Invitation</button>
      </form>
    </div>
  </section>
</template>
