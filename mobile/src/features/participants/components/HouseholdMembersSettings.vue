<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  participantColors,
  useParticipantsStore,
} from '@/app/stores/participants';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useTasksStore } from '@/app/stores/tasks';
import type {
  Participant,
  ParticipantType,
} from '@/features/participants/types';

type SheetMode = 'create' | 'edit';

const { t } = useI18n();
const participantsStore = useParticipantsStore();
const meetingsStore = useMeetingsStore();
const tasksStore = useTasksStore();

participantsStore.ensureDefaultParticipants();

const isSheetOpen = ref(false);
const sheetMode = ref<SheetMode>('create');
const selectedParticipantId = ref<string | null>(null);
const originalParticipantDisplayKey = ref<string | null>(null);
const isInitialsEditorOpen = ref(false);
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

function getParticipantDisplayKey(participant: Participant) {
  return [
    participant.name.trim().toLocaleLowerCase(),
    participant.initials.trim().toLocaleUpperCase(),
    participant.avatarColor.trim().toLocaleLowerCase(),
    participant.type,
  ].join('|');
}

function isDefaultPlaceholderParticipant(participant: Participant) {
  if (participant.type !== 'adult') {
    return false;
  }

  const name = participant.name.trim().toLocaleLowerCase();

  return (
    name === t('settings.defaultParticipant.me').toLocaleLowerCase() ||
    name === t('settings.defaultParticipant.partner').toLocaleLowerCase()
  );
}

function withoutStaleDefaultPlaceholders(participants: Participant[]) {
  const activeAdults = participants.filter(
    (participant) => participant.isActive && participant.type === 'adult'
  );
  const customAdultCount = activeAdults.filter(
    (participant) => !isDefaultPlaceholderParticipant(participant)
  ).length;
  const defaultPlaceholderCount = activeAdults.filter(
    isDefaultPlaceholderParticipant
  ).length;

  if (customAdultCount < 2 || defaultPlaceholderCount < 2) {
    return participants;
  }

  return participants.filter(
    (participant) => !isDefaultPlaceholderParticipant(participant)
  );
}

function uniqueParticipantsByDisplay(participants: Participant[]) {
  return participants.filter((participant, index) => {
    const key = getParticipantDisplayKey(participant);

    return (
      participants.findIndex(
        (item) => getParticipantDisplayKey(item) === key
      ) === index
    );
  });
}

const visibleParticipants = computed(() =>
  withoutStaleDefaultPlaceholders(
    uniqueParticipantsByDisplay(
      participantsStore.participants.filter(
        (participant) => !participant.deletedAt
      )
    )
  )
);
const activeParticipantCount = computed(
  () =>
    visibleParticipants.value.filter((participant) => participant.isActive)
      .length
);
const selectedParticipant = computed(() =>
  selectedParticipantId.value
    ? participantsStore.getParticipantById(selectedParticipantId.value)
    : null
);
const sheetTitle = computed(() =>
  sheetMode.value === 'create'
    ? t('settings.addPerson')
    : t('settings.editPerson')
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
  sheetMode.value = 'create';
  selectedParticipantId.value = null;
  originalParticipantDisplayKey.value = null;
  resetDraftForCreate();
  isSheetOpen.value = true;
}

function openEditSheet(participant: Participant) {
  sheetMode.value = 'edit';
  selectedParticipantId.value = participant.id;
  originalParticipantDisplayKey.value = getParticipantDisplayKey(participant);
  participantDraft.name = participant.name;
  participantDraft.initials = participant.initials;
  participantDraft.initialName = participant.name;
  participantDraft.avatarColor = participant.avatarColor;
  participantDraft.type = participant.type;
  isInitialsEditorOpen.value = false;
  isSheetOpen.value = true;
}

function closeSheet() {
  isSheetOpen.value = false;
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
    closeSheet();
    return;
  }

  if (!selectedParticipantId.value) {
    return;
  }

  const participants = getSelectedDuplicateGroup();
  const updatedParticipants = participants.map((participant) =>
    participantsStore.updateParticipant(participant.id, payload)
  );

  if (updatedParticipants.some((participant) => !participant)) {
    setParticipantMessage(t('settings.addNameFirst'), 'error');
    return;
  }

  setParticipantMessage(t('settings.participantUpdated'));
  closeSheet();
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
  <section class="content-panel settings-panel household-members-panel">
    <header class="household-members-header">
      <div>
        <h2>{{ t('settings.participants') }}</h2>
        <p>{{ t('settings.participantsIntro') }}</p>
      </div>
      <strong>{{
        t('settings.activePeopleCount', activeParticipantCount)
      }}</strong>
    </header>

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
            <small>
              {{ getTypeLabel(participant.type) }}
              <template v-if="!participant.isActive">
                · {{ t('settings.hiddenFromNewMeetings') }}
              </template>
            </small>
          </span>
          <span class="material-symbols-outlined" aria-hidden="true">
            edit
          </span>
        </button>
      </li>
    </ul>

    <button class="meeting-primary" type="button" @click="openCreateSheet">
      <span class="material-symbols-outlined" aria-hidden="true">
        person_add
      </span>
      {{ t('settings.addPerson') }}
    </button>

    <p
      v-if="participantMessage.text"
      :class="
        participantMessage.tone === 'error' ? 'meeting-error' : 'meeting-status'
      "
      role="status"
    >
      {{ participantMessage.text }}
    </p>

    <div
      v-if="isSheetOpen"
      class="participant-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="participant-sheet-title"
    >
      <button
        class="participant-sheet__scrim"
        type="button"
        :aria-label="t('common.close')"
        @click="closeSheet"
      />
      <form
        class="participant-sheet__panel"
        @submit.prevent="saveParticipantDraft"
      >
        <header>
          <button
            class="material-symbols-outlined"
            type="button"
            :aria-label="t('common.close')"
            @click="closeSheet"
          >
            arrow_back
          </button>
          <h2 id="participant-sheet-title">{{ sheetTitle }}</h2>
        </header>

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

        <div class="participant-sheet__actions">
          <button class="meeting-primary" type="submit">
            {{ t('common.save') }}
          </button>
          <button class="secondary-button" type="button" @click="closeSheet">
            {{ t('common.cancel') }}
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
    </div>
  </section>
</template>
