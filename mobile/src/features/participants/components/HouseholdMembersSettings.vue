<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  participantColors,
  useParticipantsStore,
} from '@/app/stores/participants';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useTasksStore } from '@/app/stores/tasks';
import type {
  Participant,
  ParticipantType,
} from '@/features/participants/types';
import {
  canOfferParticipantInvitation,
  canRevokeParticipantInvitation,
  shouldShowParticipantAccessStatus,
} from '@/features/participants/participantInvitationEligibility';
import type { ParticipantAccessState } from '@/features/workspace/types';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';

type SheetMode = 'create' | 'edit' | 'invite' | 'revoke';

const { t } = useI18n();
const participantsStore = useParticipantsStore();
const workspaceStore = useWorkspaceStore();
const meetingsStore = useMeetingsStore();
const tasksStore = useTasksStore();
const { can } = useWorkspacePermissions();

const isSheetOpen = ref(false);
const sheetMode = ref<SheetMode>('create');
const selectedParticipantId = ref<string | null>(null);
const originalParticipantDisplayKey = ref<string | null>(null);
const isInitialsEditorOpen = ref(false);
const isHouseholdNameSheetOpen = ref(false);
const householdNameDraft = ref('');
const householdNameError = ref('');
const inviteEmail = ref('');
const inviteError = ref('');
const revokeError = ref('');
const participantMessage = reactive({
  text: '',
  tone: 'status' as 'status' | 'error',
});
const participantDraft = reactive({
  name: '',
  initials: '',
  initialName: '',
  avatarColor: participantColors[0],
  type: 'adult' as ParticipantType,
});
const customAvatarColorInput = ref<HTMLInputElement | null>(null);

function getParticipantDisplayKey(participant: Participant) {
  return [
    participant.name.trim().toLocaleLowerCase(),
    participant.initials.trim().toLocaleUpperCase(),
    participant.avatarColor.trim().toLocaleLowerCase(),
    participant.type,
  ].join('|');
}

const visibleParticipants = computed(
  () => participantsStore.householdParticipants
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
const initialsPreview = computed(
  () => participantDraft.initials || getInitials(participantDraft.name)
);
const isCustomAvatarColor = computed(
  () =>
    !participantColors.some(
      (color) =>
        color.toLocaleLowerCase() ===
        participantDraft.avatarColor.toLocaleLowerCase()
    )
);
const displayedAvatarColor = computed(() =>
  participantDraft.avatarColor.toLocaleUpperCase()
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

function openCustomAvatarColorPicker() {
  customAvatarColorInput.value?.click();
}

function setCustomAvatarColor(event: Event) {
  const input = event.target as HTMLInputElement;

  if (input.value) {
    participantDraft.avatarColor = input.value.toLocaleLowerCase();
  }
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
  participantDraft.type = 'adult';
  isInitialsEditorOpen.value = false;
}

function openCreateSheet() {
  participantMessage.text = '';
  sheetMode.value = 'create';
  selectedParticipantId.value = null;
  originalParticipantDisplayKey.value = null;
  inviteError.value = '';
  revokeError.value = '';
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
  participantDraft.type = participant.type;
  inviteError.value = '';
  revokeError.value = '';
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
    revokeError.value = '';
    sheetMode.value = 'edit';
    return;
  }

  inviteError.value = '';
  revokeError.value = '';
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
    inviteError.value =
      workspaceStore.errorMessage || t('workspace.saveInviteFailed');
    return;
  }

  const deliveryFailed =
    'deliveryStatus' in accessRecord && accessRecord.deliveryStatus === 'failed';
  setParticipantMessage(
    accessRecord.status === 'active'
      ? t('settings.appAccessLinked')
      : deliveryFailed
        ? workspaceStore.errorMessage || t('workspace.saveInviteFailed')
        : t('settings.invitationSent'),
    deliveryFailed ? 'error' : 'status'
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
    setParticipantMessage(t('settings.invitationSent'));
  } else {
    revokeError.value = workspaceStore.errorMessage || t('workspace.saveInviteFailed');
  }
}

function openRevokeStep() {
  if (!canRevokeSelectedInvitation()) {
    return;
  }

  revokeError.value = '';
  sheetMode.value = 'revoke';
}

function cancelRevoke() {
  if (workspaceStore.isSaving) {
    return;
  }

  revokeError.value = '';
  sheetMode.value = 'edit';
}

async function confirmRevoke() {
  const participant = selectedParticipant.value;

  if (!participant) {
    cancelRevoke();
    return;
  }

  revokeError.value = '';
  const revoked = await workspaceStore.revokeParticipantInvitation(
    participant.id
  );

  if (revoked) {
    setParticipantMessage(t('settings.invitationRevoked'));
    sheetMode.value = 'edit';
    return;
  }

  if (!workspaceStore.getParticipantPendingInvitation(participant.id)) {
    setParticipantMessage(t('workspace.invitationNoLongerPending'));
    sheetMode.value = 'edit';
    return;
  }

  revokeError.value =
    workspaceStore.errorMessage || t('workspace.revokeInvitationFailed');
}

function openHouseholdNameSheet() {
  householdNameDraft.value = workspaceStore.workspace.name;
  householdNameError.value = '';
  isHouseholdNameSheetOpen.value = true;
}

function closeHouseholdNameSheet() {
  isHouseholdNameSheetOpen.value = false;
  householdNameError.value = '';
}

async function saveHouseholdName() {
  if (!householdNameDraft.value.trim()) {
    householdNameError.value = t('settings.addHouseholdName');
    return;
  }

  const saved = await workspaceStore.saveWorkspaceName(
    householdNameDraft.value
  );

  if (!saved) {
    householdNameError.value = workspaceStore.errorMessage;
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
    type: participantDraft.type,
  };

  if (sheetMode.value === 'create') {
    const participant = participantsStore.createParticipant(payload);

    if (!participant) {
      setParticipantMessage(t('settings.addNameFirst'), 'error');
      return;
    }

    meetingsStore.syncActiveMeetingParticipants();
    setParticipantMessage(t('settings.participantAdded'));

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

  setParticipantMessage(t('settings.participantUpdated'));
  const updatedParticipant = selectedParticipant.value;

  if (shouldOfferInviteAfterSave && canInviteParticipant(updatedParticipant)) {
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
    setParticipantMessage(t('settings.participantDisabled'));
    closeSheet();
    return;
  }

  participantsStore.removeParticipant(participantId);
  setParticipantMessage(t('settings.participantRemoved'));
  closeSheet();
}

function enableParticipant(participantId: string) {
  participantsStore.enableParticipant(participantId);
  meetingsStore.syncActiveMeetingParticipants();
  setParticipantMessage(t('settings.participantEnabled'));
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
              <span
                class="participant-avatar participant-avatar--large"
                :style="{ backgroundColor: participant.avatarColor }"
              >
                {{ participant.initials }}
              </span>
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

        <p v-if="revokeError" class="meeting-error" role="alert">
          {{ revokeError }}
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
          <select v-model="participantDraft.type">
            <option
              v-for="type in typeOptions"
              :key="type.value"
              :value="type.value"
            >
              {{ type.label }}
            </option>
          </select>
        </label>

        <fieldset class="color-selector">
          <legend>{{ t('settings.avatarColor') }}</legend>
          <label v-for="color in participantColors" :key="color">
            <input
              v-model="participantDraft.avatarColor"
              type="radio"
              :value="color"
            />
            <span :style="{ backgroundColor: color }" />
          </label>
          <label class="color-selector__custom">
            <input
              ref="customAvatarColorInput"
              class="color-selector__native-input"
              :value="participantDraft.avatarColor"
              tabindex="-1"
              type="color"
              aria-hidden="true"
              @input="setCustomAvatarColor"
            />
            <button
              class="color-selector__custom-trigger"
              :class="{ 'is-selected': isCustomAvatarColor }"
              type="button"
              :aria-label="t('settings.customAvatarColor')"
              @click="openCustomAvatarColorPicker"
            >
              <span aria-hidden="true" />
            </button>
          </label>
          <output class="color-selector__selected-value" aria-live="polite">
            {{
              t('settings.selectedAvatarColor', {
                color: displayedAvatarColor,
              })
            }}
          </output>
        </fieldset>

        <button
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
        </label>

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
