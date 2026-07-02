<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkspaceStore } from '@/app/stores/workspace';
import type { UserRole } from '@/features/access/types';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';

const workspaceStore = useWorkspaceStore();
const { can, getRoleLabel } = useWorkspacePermissions();
const { t } = useI18n();

const isInviteSheetOpen = ref(false);
const statusMessage = ref('');
const errorMessage = ref('');
const inviteDraft = reactive({
  contact: '',
  role: 'adult_member' as Exclude<UserRole, 'owner'>,
});

const roleOptions: Array<{ label: string; value: Exclude<UserRole, 'owner'> }> =
  [
    { label: t('workspace.member'), value: 'adult_member' },
    { label: t('workspace.viewer'), value: 'viewer' },
  ];

const activeMembers = computed(() =>
  workspaceStore.visibleMembers.filter((member) => member.status === 'active')
);
const pendingInvites = computed(() =>
  workspaceStore.visibleMembers.filter((member) => member.status === 'invited')
);
const visibleErrorMessage = computed(
  () => errorMessage.value || workspaceStore.errorMessage
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

  return (
    trimmedContact.split('@')[0]?.replace(/[._-]+/g, ' ') ||
    t('workspace.member')
  );
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function inviteMember() {
  clearMessages();

  if (!can('inviteMembers')) {
    errorMessage.value = t('workspace.ownerInviteOnly');
    return;
  }

  const contact = inviteDraft.contact.trim();

  if (!contact) {
    errorMessage.value = t('workspace.addContactFirst');
    return;
  }

  if (!isEmail(contact)) {
    errorMessage.value = t('workspace.addEmailFirst');
    return;
  }

  const member = await workspaceStore.inviteWorkspaceMember({
    displayName: getInviteName(contact),
    email: contact,
    role: inviteDraft.role,
  });

  if (!member) {
    errorMessage.value =
      workspaceStore.errorMessage || t('workspace.saveInviteFailed');
    return;
  }

  inviteDraft.contact = '';
  inviteDraft.role = 'adult_member';
  statusMessage.value = t('workspace.invitationSaved');
  closeInviteSheet();
}

async function removeMember(userId: string) {
  clearMessages();

  if (!can('removeMembers')) {
    errorMessage.value = t('workspace.ownerRemoveOnly');
    return;
  }

  const removed = await workspaceStore.removeWorkspaceMember(userId);

  if (!removed) {
    errorMessage.value =
      workspaceStore.errorMessage || t('workspace.removeMemberFailed');
    return;
  }

  statusMessage.value = t('workspace.memberRemoved');
}

onMounted(() => {
  void workspaceStore.loadWorkspace();
});
</script>

<template>
  <section class="page-stack workspace-page workspace-members-page">
    <header class="workspace-members-hero">
      <h1>{{ t('workspace.title') }}</h1>
      <p class="page-copy">{{ t('workspace.intro') }}</p>
    </header>

    <section
      v-if="workspaceStore.isLoading"
      class="workspace-loading"
      role="status"
    >
      {{ t('workspace.loading') }}
    </section>

    <section
      v-else
      class="workspace-member-cards"
      :aria-label="t('workspace.currentMembersLabel')"
    >
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
                ? t('workspace.admin')
                : getRoleLabel(member.role).replace(
                    'Adult member',
                    t('workspace.member')
                  )
            }}
          </small>
        </span>
        <button
          v-if="member.userId !== workspaceStore.workspace.ownerId"
          class="workspace-member-card__remove material-symbols-outlined"
          type="button"
          :disabled="workspaceStore.isSaving"
          :aria-label="t('workspace.removeMember')"
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
      <h2 id="pending-invites-title">{{ t('workspace.pendingInvites') }}</h2>
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
          <small>{{ t('workspace.invitationPending') }}</small>
        </span>
        <button
          type="button"
          :disabled="workspaceStore.isSaving"
          @click="statusMessage = t('workspace.inviteReady')"
        >
          {{ t('workspace.resend') }}
        </button>
      </article>
    </section>

    <p v-if="statusMessage" class="meeting-status" role="status">
      {{ statusMessage }}
    </p>
    <p v-if="visibleErrorMessage" class="meeting-error" role="alert">
      {{ visibleErrorMessage }}
    </p>

    <div class="templates-cta">
      <button
        class="meeting-primary templates-cta__button"
        type="button"
        :disabled="!can('inviteMembers') || workspaceStore.isSaving"
        @click="openInviteSheet"
      >
        <span class="material-symbols-outlined" aria-hidden="true">
          person_add
        </span>
        {{ t('workspace.inviteNewMember') }}
      </button>
    </div>

    <BaseBottomSheet
      :open="isInviteSheetOpen"
      :title="t('workspace.addMember')"
      @close="closeInviteSheet"
    >
      <form
        class="workspace-invite-sheet-form task-editor-form"
        @submit.prevent="inviteMember"
      >
        <label>
          <span>{{ t('workspace.contact') }}</span>
          <input
            v-model="inviteDraft.contact"
            autocomplete="email"
            inputmode="email"
            type="email"
            :placeholder="t('workspace.contactPlaceholder')"
          />
        </label>

        <label>
          <span>{{ t('workspace.role') }}</span>
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
          {{ t('workspace.inviteHelp') }}
        </p>

        <p v-if="visibleErrorMessage" class="meeting-error" role="alert">
          {{ visibleErrorMessage }}
        </p>

        <button
          class="meeting-primary"
          type="submit"
          :disabled="workspaceStore.isSaving"
        >
          {{
            workspaceStore.isSaving
              ? t('workspace.sendingInvitation')
              : t('workspace.sendInvitation')
          }}
        </button>
      </form>
    </BaseBottomSheet>
  </section>
</template>
