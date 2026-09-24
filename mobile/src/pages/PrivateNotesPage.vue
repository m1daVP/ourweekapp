<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeetingsStore } from '@/app/stores/meetings';
import { usePrivateNotesStore } from '@/app/stores/privateNotes';
import type { Meeting } from '@/features/meeting/types';
import type { PrivateNote } from '@/features/private-notes/types';
import ConfirmationDialog from '@/shared/components/ConfirmationDialog.vue';
import PremiumLock from '@/shared/components/PremiumLock.vue';
import SelectPickerField from '@/shared/components/SelectPickerField.vue';
import { useInAppNotification } from '@/shared/composables/useInAppNotification';
import { haptics } from '@/shared/services/hapticsService';

const meetingsStore = useMeetingsStore();
const privateNotesStore = usePrivateNotesStore();
const { t, locale } = useI18n();

const editingNoteId = ref<string | null>(null);
const notePendingDelete = ref<PrivateNote | null>(null);
const formError = ref('');
const { showInAppNotification } = useInAppNotification();
const noteDraft = reactive({
  title: '',
  content: '',
  relatedMeetingId: '',
});

const notes = computed(() => privateNotesStore.sortedNotes);
const linkedMeetingOptions = computed(() =>
  [...meetingsStore.meetings].sort(compareMeetingsByDate)
);
const linkedMeetingPickerOptions = computed(() => [
  { value: '', label: t('privateNotes.noMeetingLink') },
  ...linkedMeetingOptions.value.map((meeting) => ({
    value: meeting.id,
    label: getMeetingLabel(meeting.id),
  })),
]);
const isEditing = computed(() => Boolean(editingNoteId.value));

function compareMeetingsByDate(first: Meeting, second: Meeting) {
  return getMeetingDate(second).getTime() - getMeetingDate(first).getTime();
}

function getMeetingDate(meeting: Meeting) {
  return new Date(
    meeting.completedAt ?? meeting.updatedAt ?? meeting.createdAt
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function getMeetingLabel(meetingId?: string) {
  const meeting = meetingsStore.meetings.find((item) => item.id === meetingId);

  if (!meeting) {
    return '';
  }

  return `${meeting.title} - ${formatDate(
    meeting.completedAt ?? meeting.updatedAt ?? meeting.createdAt
  )}`;
}

function clearMessages() {
  formError.value = '';
}

function resetDraft() {
  editingNoteId.value = null;
  noteDraft.title = '';
  noteDraft.content = '';
  noteDraft.relatedMeetingId = '';
}

function saveNote() {
  clearMessages();

  if (!noteDraft.title.trim() || !noteDraft.content.trim()) {
    formError.value = t('privateNotes.addTitleAndNote');
    return;
  }

  const payload = {
    title: noteDraft.title,
    content: noteDraft.content,
    relatedMeetingId: noteDraft.relatedMeetingId || undefined,
  };
  const note = editingNoteId.value
    ? privateNotesStore.updateNote(editingNoteId.value, payload)
    : privateNotesStore.createNote(payload);

  if (!note) {
    formError.value = t('privateNotes.addTitleAndNote');
    return;
  }

  showInAppNotification(
    editingNoteId.value
      ? t('privateNotes.noteUpdated')
      : t('privateNotes.noteSaved')
  );
  resetDraft();
}

function editNote(note: PrivateNote) {
  clearMessages();
  editingNoteId.value = note.id;
  noteDraft.title = note.title;
  noteDraft.content = note.content;
  noteDraft.relatedMeetingId = note.relatedMeetingId ?? '';
}

function deleteNote(note: PrivateNote) {
  notePendingDelete.value = note;
}

function confirmDeleteNote() {
  const note = notePendingDelete.value;

  if (!note) {
    return;
  }

  notePendingDelete.value = null;

  clearMessages();
  privateNotesStore.deleteNote(note.id);
  void haptics.impact();

  if (editingNoteId.value === note.id) {
    resetDraft();
  }

  showInAppNotification(t('privateNotes.noteDeleted'));
}
</script>

<template>
  <section class="page-stack private-notes-page">
    <header>
      <p class="page-kicker">{{ t('privateNotes.kicker') }}</p>
      <h1>{{ t('privateNotes.title') }}</h1>
      <p class="page-copy">{{ t('privateNotes.intro') }}</p>
    </header>

    <section
      class="content-panel private-note-disclaimer"
      :aria-label="t('privateNotes.storageLabel')"
    >
      <strong>{{ t('privateNotes.reflectionTitle') }}</strong>
      <p>{{ t('privateNotes.storageText') }}</p>
    </section>

    <PremiumLock
      feature="privateNotes"
      :title="t('privateNotes.premiumTitle')"
      :message="t('privateNotes.premiumMessage')"
      :show-preview="false"
    >
      <section
        class="content-panel private-note-editor"
        aria-labelledby="private-note-editor-title"
      >
        <div>
          <h2 id="private-note-editor-title">
            {{
              isEditing
                ? t('privateNotes.editTitle')
                : t('privateNotes.createTitle')
            }}
          </h2>
          <p>
            {{ t('privateNotes.editorHelp') }}
          </p>
        </div>

        <form class="private-note-form" @submit.prevent="saveNote">
          <label>
            <span>{{ t('privateNotes.titleLabel') }}</span>
            <input
              v-model="noteDraft.title"
              type="text"
              :placeholder="t('privateNotes.titlePlaceholder')"
            />
          </label>

          <label>
            <span>{{ t('privateNotes.noteLabel') }}</span>
            <textarea
              v-model="noteDraft.content"
              rows="6"
              :placeholder="t('privateNotes.notePlaceholder')"
            />
          </label>

          <label>
            <span>{{ t('privateNotes.relatedMeeting') }}</span>
            <SelectPickerField
              v-model="noteDraft.relatedMeetingId"
              :label="t('privateNotes.relatedMeeting')"
              :options="linkedMeetingPickerOptions"
            />
          </label>

          <div class="private-note-form__actions">
            <button class="meeting-primary" type="submit">
              {{
                isEditing
                  ? t('privateNotes.saveChanges')
                  : t('privateNotes.saveNote')
              }}
            </button>
            <button v-if="isEditing" type="button" @click="resetDraft">
              {{ t('common.cancel') }}
            </button>
          </div>
        </form>
      </section>

      <section
        class="content-panel private-note-list-panel"
        aria-labelledby="private-note-list-title"
      >
        <div>
          <h2 id="private-note-list-title">
            {{ t('privateNotes.savedTitle') }}
          </h2>
          <p>{{ t('privateNotes.notesCount', { count: notes.length }) }}</p>
        </div>

        <ul v-if="notes.length" class="private-note-list">
          <li v-for="note in notes" :key="note.id" class="private-note-item">
            <div class="private-note-item__body">
              <span>{{ formatDate(note.updatedAt) }}</span>
              <h3>{{ note.title }}</h3>
              <p>{{ note.content }}</p>
              <small v-if="note.relatedMeetingId">
                {{
                  t('privateNotes.linkedTo', {
                    meeting: getMeetingLabel(note.relatedMeetingId),
                  })
                }}
              </small>
            </div>
            <div class="private-note-item__actions">
              <button type="button" @click="editNote(note)">
                {{ t('common.edit') }}
              </button>
              <button
                type="button"
                class="private-note-item__danger"
                @click="deleteNote(note)"
              >
                {{ t('common.delete') }}
              </button>
            </div>
          </li>
        </ul>

        <p v-else class="meeting-empty">
          {{ t('privateNotes.noNotes') }}
        </p>
      </section>

      <p v-if="formError" class="meeting-error" role="alert">
        {{ formError }}
      </p>
    </PremiumLock>
    <ConfirmationDialog
      :open="Boolean(notePendingDelete)"
      :title="t('privateNotes.confirmDelete')"
      :message="t('common.cannotUndo')"
      :confirm-label="t('common.delete')"
      destructive
      @close="notePendingDelete = null"
      @confirm="confirmDeleteNote"
    />
  </section>
</template>
