<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  participantColors,
  useParticipantsStore,
} from '@/app/stores/participants';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useTasksStore } from '@/app/stores/tasks';
import type {
  Participant,
  ParticipantType,
} from '@/features/participants/types';
import type { AvatarType } from '@/features/participants/avatarCatalog';
import ParticipantAvatar from './ParticipantAvatar.vue';
import {
  canOfferParticipantInvitation,
  canRevokeParticipantInvitation,
  shouldShowParticipantAccessStatus,
} from '@/features/participants/participantInvitationEligibility';
import type { ParticipantAccessState } from '@/features/workspace/types';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';
import SelectPickerField from '@/shared/components/SelectPickerField.vue';
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';
import { useInAppNotification } from '@/shared/composables/useInAppNotification';
import AvatarPickerSheet from './AvatarPickerSheet.vue';

type SheetMode = 'create' | 'edit' | 'invite' | 'revoke';

const { t } = useI18n();
const participantsStore = useParticipantsStore();
const workspaceStore = useWorkspaceStore();
const subscriptionStore = useSubscriptionStore();
const meetingsStore = useMeetingsStore();
const tasksStore = useTasksStore();
const { can } = useWorkspacePermissions();
const { showInAppNotification } = useInAppNotification();
const canManageHouseholdParticipants = computed(() => can('manageWorkspace'));

const isSheetOpen = ref(false);
const sheetMode = ref<SheetMode>('create');
const selectedParticipantId = ref<string | null>(null);
const originalParticipantDisplayKey = ref<string | null>(null);
const isInitialsEditorOpen = ref(false);
const isHouseholdNameSheetOpen = ref(false);
const householdNameDraft = ref('');
const householdNameError = ref('');
const isAvatarPickerOpen = ref(false);
const inviteEmail = ref('');
const inviteError = ref('');
const participantMessage = reactive({
  text: '',
  tone: 'status' as 'status' | 'error',
});
const participantDraft = reactive({
  name: '',
  initials: '',
  initialName: '',
  avatarColor: participantColors[0],
  avatarType: null as AvatarType | null,
  type: 'adult' as ParticipantType,
});

function getParticipantDisplayKey(participant: Participant) {
  return [
    participant.name.trim().toLocaleLowerCase(),
    participant.initials.trim().toLocaleUpperCase(),
    participant.avatarColor.trim().toLocaleLowerCase(),
    participant.avatarType ?? '',
    participant.type,
  ].join('|');
}

const visibleParticipants = computed(
  () => participantsStore.householdParticipants
);
const memberLimit = computed(() =>
  subscriptionStore.currentPlan === 'premium' ? 8 : 4
);
const memberCapacityLabel = computed(
  () => `${workspaceStore.activeMembers.length} of ${memberLimit.value} members`
);
const selectedParticipant = computed(() =>
  selectedParticipantId.value
    ? participantsStore.getParticipantById(selectedParticipantId.value)
    : null
);
const sheetTitle = computed(() => {
  if (sheetMode.value === 'revoke') {
    return t('settings.revokeInvitationTitle');
  }

  if (sheetMode.value === 'invite') {
    return t('settings.invitePerson', {
      name: selectedParticipant.value?.name ?? '',
    });
  }

  return sheetMode.value === 'create'
    ? t('settings.addPerson')
    : t('settings.editPerson');
});
const selectedParticipantAccess = computed<ParticipantAccessState>(() =>
  selectedParticipantId.value
    ? workspaceStore.getParticipantAccessState(selectedParticipantId.value)
    : { status: 'none' }
);
const canEditSelectedParticipantAvatar = computed(() => {
  if (!selectedParticipant.value) {
    return canManageHouseholdParticipants.value;
  }

  if (participantsStore.isCurrentParticipant(selectedParticipant.value.id)) {
    return true;
  }

  return (
    canManageHouseholdParticipants.value &&
    selectedParticipantAccess.value.status !== 'active'
  );
});
const selectedPendingInvitation = computed(() =>
  selectedParticipantId.value
    ? workspaceStore.getParticipantPendingInvitation(
        selectedParticipantId.value
      )
    : null
);
const showSelectedParticipantAccess = computed(() =>
  shouldShowParticipantAccessStatus(
    getInvitationEligibilityInput(selectedParticipant.value)
  )
);
const typeOptions = computed<Array<{ label: string; value: ParticipantType }>>(
  () => [
    { label: t('settings.participantType.adult'), value: 'adult' },
    { label: t('settings.participantType.child'), value: 'child' },
    { label: t('settings.participantType.other'), value: 'other' },
  ]
);

function updateParticipantType(value: string) {
  if (value === 'adult' || value === 'child' || value === 'other') {
    participantDraft.type = value;
  }
}
const initialsPreview = computed(
  () => participantDraft.initials || getInitials(participantDraft.name)
);
function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (!words.length) {
    return '?';
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function openAvatarPicker() {
  isAvatarPickerOpen.value = true;
}

function closeAvatarPicker() {
  isAvatarPickerOpen.value = false;
}

function selectAvatarColor(color: string) {
  participantDraft.avatarColor = color;
  participantDraft.avatarType = null;
}

function selectAvatarType(avatarType: AvatarType) {
  participantDraft.avatarType = avatarType;
}

function getTypeLabel(type: ParticipantType) {
  return t(`settings.participantType.${type}`);
}

function setParticipantMessage(
  text: string,
  tone: 'status' | 'error' = 'status'
) {
  participantMessage.text = text;
  participantMessage.tone = tone;
}

function resetDraftForCreate() {
  participantDraft.name = '';
  participantDraft.initials = '';
  participantDraft.initialName = '';
  participantDraft.avatarColor =
    participantColors[
      participantsStore.participants.length % participantColors.length
    ];
  participantDraft.avatarType = null;
  participantDraft.type = 'adult';
  isInitialsEditorOpen.value = false;
}

function openCreateSheet() {
  if (!canManageHouseholdParticipants.value) {
    return;
  }

  participantMessage.text = '';
  sheetMode.value = 'create';
  selectedParticipantId.value = null;
  originalParticipantDisplayKey.value = null;
  inviteError.value = '';
  resetDraftForCreate();
  isSheetOpen.value = true;
}

function openEditSheet(participant: Participant) {
  participantMessage.text = '';
  sheetMode.value = 'edit';
  selectedParticipantId.value = participant.id;
  originalParticipantDisplayKey.value = getParticipantDisplayKey(participant);
  participantDraft.name = participant.name;
  participantDraft.initials = participant.initials;
  participantDraft.initialName = participant.name;
  participantDraft.avatarColor = participant.avatarColor;
  participantDraft.avatarType = participant.avatarType ?? null;
  participantDraft.type = participant.type;
  inviteError.value = '';
  isInitialsEditorOpen.value = false;
  isSheetOpen.value = true;
}

function closeSheet() {
  if (
    (sheetMode.value === 'invite' || sheetMode.value === 'revoke') &&
    workspaceStore.isSaving
  ) {
    return;
  }

  if (sheetMode.value === 'revoke') {
    sheetMode.value = 'edit';
    return;
  }

  inviteError.value = '';
  closeAvatarPicker();
  isSheetOpen.value = false;
}

function getInvitationEligibilityInput(participant: Participant | null) {
  const accessStatus = participant
    ? workspaceStore.getParticipantAccessState(participant.id).status
    : 'none';

  return {
    participant,
    isCurrentParticipant: participant
      ? participantsStore.isCurrentParticipant(participant.id)
      : false,
    canInviteMembers: can('inviteMembers'),
    accessStatus,
    activeMemberCount: workspaceStore.activeMembers.length,
    memberLimit: memberLimit.value,
  };
}

function canInviteParticipant(participant: Participant | null) {
  return canOfferParticipantInvitation(
    getInvitationEligibilityInput(participant)
  );
}

function canRevokeSelectedInvitation() {
  return canRevokeParticipantInvitation({
    ...getInvitationEligibilityInput(selectedParticipant.value),
    hasPendingInvitation: Boolean(selectedPendingInvitation.value),
  });
}

function openInviteStep(participant: Participant) {
  if (!canInviteParticipant(participant)) {
    return;
  }

  selectedParticipantId.value = participant.id;
  sheetMode.value = 'invite';
  inviteEmail.value = '';
  inviteError.value = '';
  isSheetOpen.value = true;
}

function skipInvite() {
  inviteError.value = '';
  closeSheet();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sendInvite() {
  const participant = selectedParticipant.value;
  const email = inviteEmail.value.trim();

  if (!participant) {
    inviteError.value = t('settings.invitePersonMissing');
    return;
  }

  if (!isEmail(email)) {
    inviteError.value = t('workspace.addEmailFirst');
    return;
  }

  inviteError.value = '';
  const accessRecord = await workspaceStore.inviteParticipant(
    participant.id,
    email
  );

  if (!accessRecord) {
    showInAppNotification(
      workspaceStore.errorMessage || t('workspace.saveInviteFailed'),
      { tone: 'error' }
    );
    return;
  }

  const deliveryFailed =
    'deliveryStatus' in accessRecord &&
    accessRecord.deliveryStatus === 'failed';
  participantMessage.text = '';
  showInAppNotification(
    accessRecord.status === 'active'
      ? t('settings.appAccessLinked')
      : deliveryFailed
        ? workspaceStore.errorMessage || t('workspace.saveInviteFailed')
        : t('settings.invitationSent'),
    { tone: deliveryFailed ? 'error' : 'status' }
  );
  closeSheet();
}

async function resendSelectedInvitation() {
  const participant = selectedParticipant.value;

  if (!participant) {
    return;
  }

  const resent = await workspaceStore.resendParticipantInvitation(
    participant.id
  );

  if (resent) {
    participantMessage.text = '';
    showInAppNotification(t('settings.invitationSent'));
  } else {
    showInAppNotification(
      workspaceStore.errorMessage || t('workspace.saveInviteFailed'),
      { tone: 'error' }
    );
  }
}

function openRevokeStep() {
  if (!canRevokeSelectedInvitation()) {
    return;
  }

  sheetMode.value = 'revoke';
}

function cancelRevoke() {
  if (workspaceStore.isSaving) {
    return;
  }

  sheetMode.value = 'edit';
}

async function confirmRevoke() {
  const participant = selectedParticipant.value;

  if (!participant) {
    cancelRevoke();
    return;
  }

  const revoked = await workspaceStore.revokeParticipantInvitation(
    participant.id
  );

  if (revoked) {
    participantMessage.text = '';
    showInAppNotification(t('settings.invitationRevoked'));
    sheetMode.value = 'edit';
    return;
  }

  if (!workspaceStore.getParticipantPendingInvitation(participant.id)) {
    participantMessage.text = '';
    showInAppNotification(t('workspace.invitationNoLongerPending'));
    sheetMode.value = 'edit';
    return;
  }

  showInAppNotification(
    workspaceStore.errorMessage || t('workspace.revokeInvitationFailed'),
    { tone: 'error' }
  );
}

function openHouseholdNameSheet() {
  if (!canManageHouseholdParticipants.value) {
    return;
  }

  householdNameDraft.value = workspaceStore.workspace.name;
  householdNameError.value = '';
  isHouseholdNameSheetOpen.value = true;
}

function closeHouseholdNameSheet() {
  isHouseholdNameSheetOpen.value = false;
  householdNameError.value = '';
}

async function saveHouseholdName() {
  if (!canManageHouseholdParticipants.value) {
    return;
  }

  if (!householdNameDraft.value.trim()) {
    householdNameError.value = t('settings.addHouseholdName');
    return;
  }

  const saved = await workspaceStore.saveWorkspaceName(
    householdNameDraft.value
  );

  if (!saved) {
    showInAppNotification(
      workspaceStore.errorMessage || t('workspace.saveWorkspaceFailed'),
      { tone: 'error' }
    );
    return;
  }

  closeHouseholdNameSheet();
}

function getSelectedDuplicateGroup() {
  if (!originalParticipantDisplayKey.value) {
    return selectedParticipant.value ? [selectedParticipant.value] : [];
  }

  return participantsStore.participants.filter(
    (participant) =>
      !participant.deletedAt &&
      getParticipantDisplayKey(participant) ===
        originalParticipantDisplayKey.value
  );
}

function saveParticipantDraft() {
  const shouldUpdateName =
    sheetMode.value === 'create' ||
    participantDraft.name.trim() !== participantDraft.initialName.trim();
  const payload = {
    name: shouldUpdateName ? participantDraft.name : undefined,
    initials: isInitialsEditorOpen.value
      ? participantDraft.initials
      : shouldUpdateName
        ? ''
        : undefined,
    avatarColor: participantDraft.avatarColor,
    avatarType: participantDraft.avatarType,
    type: participantDraft.type,
  };

  if (sheetMode.value === 'create') {
    if (!canManageHouseholdParticipants.value) {
      return;
    }

    const participant = participantsStore.createParticipant({
      name: participantDraft.name,
      initials: participantDraft.initials,
      avatarColor: participantDraft.avatarColor,
      avatarType: participantDraft.avatarType,
      type: participantDraft.type,
    });

    if (!participant) {
      setParticipantMessage(t('settings.addNameFirst'), 'error');
      return;
    }

    participantMessage.text = '';
    showInAppNotification(t('settings.participantAdded'));

    if (canInviteParticipant(participant)) {
      openInviteStep(participant);
    } else {
      closeSheet();
    }
    return;
  }

  if (!selectedParticipantId.value) {
    return;
  }

  const shouldOfferInviteAfterSave =
    selectedParticipant.value?.type !== 'adult' &&
    participantDraft.type === 'adult';
  const participants = getSelectedDuplicateGroup();
  const updatedParticipants = participants.map((participant) =>
    participantsStore.updateParticipant(participant.id, payload)
  );

  if (updatedParticipants.some((participant) => !participant)) {
    setParticipantMessage(t('settings.addNameFirst'), 'error');
    return;
  }

  participantMessage.text = '';
  showInAppNotification(t('settings.participantUpdated'));
  const updatedParticipant = selectedParticipant.value;

  if (
    shouldOfferInviteAfterSave &&
    updatedParticipant &&
    canInviteParticipant(updatedParticipant)
  ) {
    openInviteStep(updatedParticipant);
  } else {
    closeSheet();
  }
}

function participantIsUsed(participantId: string) {
  return (
    tasksStore.tasks.some((task) =>
      task.responsibleParticipantIds.includes(participantId)
    ) ||
    tasksStore.agreements.some((agreement) =>
      agreement.participantIds.includes(participantId)
    ) ||
    meetingsStore.meetings.some((meeting) =>
      meeting.sections.some(
        (section) =>
          section.notes.some((note) => note.participantId === participantId) ||
          section.tasks.some((task) =>
            task.responsibleParticipantIds.includes(participantId)
          ) ||
          section.agreements.some((agreement) =>
            agreement.participantIds.includes(participantId)
          )
      )
    )
  );
}

function hideOrRemoveParticipant(participantId: string) {
  const participant = participantsStore.getParticipantById(participantId);

  if (!participant) {
    return;
  }

  if (participantIsUsed(participantId)) {
    participantsStore.disableParticipant(participantId);
    participantMessage.text = '';
    showInAppNotification(t('settings.participantDisabled'));
    closeSheet();
    return;
  }

  participantsStore.removeParticipant(participantId);
  participantMessage.text = '';
  showInAppNotification(t('settings.participantRemoved'));
  closeSheet();
}

function enableParticipant(participantId: string) {
  participantsStore.enableParticipant(participantId);
  participantMessage.text = '';
  showInAppNotification(t('settings.participantEnabled'));
  closeSheet();
}
</script>

<template>
  <section class="settings-redesign-section household-members-panel">
    <h2 class="settings-redesign-section__title">
      {{ t('settings.sections.household') }}
    </h2>

    <article class="settings-redesign-card household-settings-card">
      <div class="household-settings-name">
        <span class="settings-field-label">
          {{ t('settings.householdName') }}
        </span>
        <div class="household-settings-name__row">
          <strong>{{ workspaceStore.workspace.name }}</strong>
          <button
            v-if="canManageHouseholdParticipants"
            class="household-settings-edit"
            type="button"
            :aria-label="t('settings.editHouseholdName')"
            @click="openHouseholdNameSheet"
          >
            <span class="material-symbols-outlined" aria-hidden="true">
              edit
            </span>
          </button>
        </div>
      </div>

      <div class="household-settings-members">
        <span class="settings-field-label">{{ t('settings.members') }}</span>
        <small>{{ memberCapacityLabel }}</small>

        <ul class="household-member-list">
          <li
            v-for="participant in visibleParticipants"
            :key="participant.id"
            :class="{ 'is-disabled': !participant.isActive }"
          >
            <button
              class="household-member-row"
              type="button"
              :aria-label="
                t('settings.editParticipantLabel', { name: participant.name })
              "
              @click="openEditSheet(participant)"
            >
              <ParticipantAvatar
                :participant="participant"
                size="large"
                decorative
              />
              <span class="household-member-row__body">
                <strong>{{ participant.name }}</strong>
                <small>{{ getTypeLabel(participant.type) }}</small>
                <small v-if="!participant.isActive">
                  {{ t('settings.hiddenFromNewMeetings') }}
                </small>
              </span>
            </button>
          </li>
        </ul>
      </div>

      <button
        v-if="canManageHouseholdParticipants"
        class="household-settings-add-button"
        type="button"
        @click="openCreateSheet"
      >
        <span class="material-symbols-outlined" aria-hidden="true">
          person_add
        </span>
        {{ t('settings.addPerson') }}
      </button>
    </article>

    <p
      v-if="participantMessage.text && !isSheetOpen"
      :class="
        participantMessage.tone === 'error' ? 'meeting-error' : 'meeting-status'
      "
      role="status"
    >
      {{ participantMessage.text }}
    </p>

    <BaseBottomSheet
      :open="isSheetOpen"
      :title="sheetTitle"
      @close="closeSheet"
    >
      <form
        v-if="sheetMode === 'invite'"
        class="participant-invite-form task-editor-form"
        @submit.prevent="sendInvite"
      >
        <p class="meeting-help">
          {{
            t('settings.invitePersonHelp', {
              name: selectedParticipant?.name ?? '',
            })
          }}
        </p>

        <label>
          <span>{{ t('workspace.contact') }}</span>
          <input
            v-model="inviteEmail"
            autocomplete="email"
            inputmode="email"
            type="email"
            :aria-describedby="
              inviteError ? 'participant-invite-error' : undefined
            "
            :aria-invalid="Boolean(inviteError)"
            :placeholder="t('workspace.contactPlaceholder')"
          />
        </label>

        <p
          v-if="inviteError"
          id="participant-invite-error"
          class="meeting-error"
          role="alert"
        >
          {{ inviteError }}
        </p>

        <div class="participant-sheet-form__actions">
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
          <button
            class="secondary-button"
            type="button"
            :disabled="workspaceStore.isSaving"
            @click="skipInvite"
          >
            {{ t('settings.notNow') }}
          </button>
        </div>
      </form>

      <form
        v-else-if="sheetMode === 'revoke'"
        class="participant-revoke-form task-editor-form"
        @submit.prevent="confirmRevoke"
      >
        <p class="meeting-help">
          {{
            t('settings.revokeInvitationMessage', {
              email: selectedPendingInvitation?.email ?? '',
            })
          }}
        </p>

        <div class="participant-sheet-form__actions">
          <button
            class="base-button base-button--danger"
            type="submit"
            :disabled="workspaceStore.isSaving"
          >
            {{
              workspaceStore.isSaving
                ? t('settings.revokingInvitation')
                : t('settings.revokeInvitation')
            }}
          </button>
          <button
            class="secondary-button"
            type="button"
            :disabled="workspaceStore.isSaving"
            @click="cancelRevoke"
          >
            {{ t('settings.keepInvitation') }}
          </button>
        </div>
      </form>

      <form
        v-else
        class="participant-sheet-form task-editor-form"
        @submit.prevent="saveParticipantDraft"
      >
        <p
          v-if="participantMessage.text"
          :class="
            participantMessage.tone === 'error'
              ? 'meeting-error'
              : 'meeting-status'
          "
          role="status"
        >
          {{ participantMessage.text }}
        </p>

        <button
          v-if="canEditSelectedParticipantAvatar"
          class="participant-avatar-choice"
          type="button"
          @click="openAvatarPicker"
        >
          <ParticipantAvatar
            :participant="{
              name: participantDraft.name || t('settings.name'),
              initials: initialsPreview,
              avatarColor: participantDraft.avatarColor,
              avatarType: participantDraft.avatarType,
            }"
            size="large"
            decorative
          />
          <span class="participant-avatar-choice__body">
            <strong>{{ t('settings.avatar') }}</strong>
          </span>
          <span class="material-symbols-outlined" aria-hidden="true"
            >chevron_right</span
          >
        </button>
        <ParticipantAvatar
          v-else
          :participant="{
            name: participantDraft.name || t('settings.name'),
            initials: initialsPreview,
            avatarColor: participantDraft.avatarColor,
            avatarType: participantDraft.avatarType,
          }"
          size="large"
        />

        <label>
          <span>{{ t('settings.name') }}</span>
          <input
            v-model="participantDraft.name"
            autocomplete="name"
            type="text"
            :placeholder="t('settings.name')"
          />
        </label>

        <label>
          <span>{{ t('settings.type') }}</span>
          <SelectPickerField
            :model-value="participantDraft.type"
            :label="t('settings.type')"
            :options="typeOptions"
            @update:model-value="updateParticipantType"
          />
        </label>

        <!-- <button
          v-if="!isInitialsEditorOpen"
          class="participant-initials-toggle"
          type="button"
          @click="isInitialsEditorOpen = true"
        >
          {{
            t('settings.editInitialsWithValue', { initials: initialsPreview })
          }}
        </button>
        <label v-else>
          <span>{{ t('settings.initials') }}</span>
          <input
            v-model="participantDraft.initials"
            type="text"
            maxlength="3"
            :placeholder="t('settings.auto')"
          />
        </label> -->

        <p
          v-if="
            selectedParticipant &&
            selectedParticipant.isActive &&
            participantIsUsed(selectedParticipant.id)
          "
          class="meeting-help"
        >
          {{ t('settings.pastMeetingsKeepName') }}
        </p>

        <div class="participant-sheet-form__actions">
          <button class="meeting-primary" type="submit">
            {{ t('common.save') }}
          </button>
          <button class="secondary-button" type="button" @click="closeSheet">
            {{ t('common.cancel') }}
          </button>
        </div>

        <button
          v-if="canInviteParticipant(selectedParticipant)"
          class="participant-access-action"
          type="button"
          @click="selectedParticipant && openInviteStep(selectedParticipant)"
        >
          <span class="material-symbols-outlined" aria-hidden="true">
            person_add
          </span>
          {{ t('settings.giveAppAccess') }}
        </button>

        <div
          v-else-if="showSelectedParticipantAccess"
          class="participant-access-status"
        >
          <p role="status">
            <strong>
              {{
                selectedParticipantAccess.status === 'active'
                  ? t('settings.hasAppAccess')
                  : t('settings.invitationPending')
              }}
            </strong>
            <span>{{ selectedParticipantAccess.email }}</span>
          </p>
          <button
            v-if="canRevokeSelectedInvitation()"
            class="participant-secondary-action"
            type="button"
            @click="openRevokeStep"
          >
            {{ t('settings.revokeInvitation') }}
          </button>
          <button
            v-if="selectedPendingInvitation?.deliveryStatus === 'failed'"
            class="participant-secondary-action"
            type="button"
            :disabled="workspaceStore.isSaving"
            @click="resendSelectedInvitation"
          >
            {{ t('workspace.sendInvitation') }}
          </button>
        </div>

        <button
          v-if="selectedParticipant?.isActive"
          class="participant-secondary-action"
          type="button"
          @click="hideOrRemoveParticipant(selectedParticipant.id)"
        >
          {{
            participantIsUsed(selectedParticipant.id)
              ? t('settings.hideFromNewMeetings')
              : t('common.remove')
          }}
        </button>
        <button
          v-else-if="selectedParticipant"
          class="participant-secondary-action"
          type="button"
          @click="enableParticipant(selectedParticipant.id)"
        >
          {{ t('settings.showInNewMeetings') }}
        </button>
      </form>
    </BaseBottomSheet>

    <AvatarPickerSheet
      :open="isAvatarPickerOpen"
      :avatar-type="participantDraft.avatarType"
      :avatar-color="participantDraft.avatarColor"
      @close="closeAvatarPicker"
      @select-avatar="selectAvatarType"
      @select-color="selectAvatarColor"
    />

    <BaseBottomSheet
      :open="isHouseholdNameSheetOpen"
      :title="t('settings.householdName')"
      @close="closeHouseholdNameSheet"
    >
      <form class="task-editor-form" @submit.prevent="saveHouseholdName">
        <label>
          <span>{{ t('settings.householdName') }}</span>
          <input
            v-model="householdNameDraft"
            autocomplete="organization"
            type="text"
            :aria-describedby="
              householdNameError ? 'household-name-error' : undefined
            "
            :aria-invalid="Boolean(householdNameError)"
          />
        </label>

        <p
          v-if="householdNameError"
          id="household-name-error"
          class="meeting-error"
          role="alert"
        >
          {{ householdNameError }}
        </p>

        <div class="participant-sheet-form__actions">
          <button
            class="meeting-primary"
            type="submit"
            :disabled="workspaceStore.isSaving"
          >
            {{ t('common.save') }}
          </button>
          <button
            class="secondary-button"
            type="button"
            :disabled="workspaceStore.isSaving"
            @click="closeHouseholdNameSheet"
          >
            {{ t('common.cancel') }}
          </button>
        </div>
      </form>
    </BaseBottomSheet>
  </section>
</template>

<style scoped>
.participant-avatar-choice {
  display: grid;
  width: 100%;
  min-height: 64px;
  grid-template-columns: auto 1fr auto;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  background: var(--color-surface-low);
  color: var(--color-on-surface);
  text-align: left;
}

.participant-avatar-choice__body {
  display: grid;
  gap: 2px;
}
.participant-avatar-choice__body small {
  color: var(--color-on-surface-variant);
}
</style>
