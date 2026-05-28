<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeetingsStore } from '@/app/stores/meetings';
import { usePrivateNotesStore } from '@/app/stores/privateNotes';
import type { Meeting } from '@/features/meeting/types';
import type { PrivateNote } from '@/features/private-notes/types';
import PremiumLock from '@/shared/components/PremiumLock.vue';

const meetingsStore = useMeetingsStore();
const privateNotesStore = usePrivateNotesStore();
const { t, locale } = useI18n();

const editingNoteId = ref<string | null>(null);
const statusMessage = ref('');
const formError = ref('');
const noteDraft = reactive({
  title: '',
  content: '',
  relatedMeetingId: '',
});

const notes = computed(() => privateNotesStore.sortedNotes);
const linkedMeetingOptions = computed(() =>
  [...meetingsStore.meetings].sort(compareMeetingsByDate)
);
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
  statusMessage.value = '';
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

  statusMessage.value = editingNoteId.value
    ? t('privateNotes.noteUpdated')
    : t('privateNotes.noteSaved');
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
  const confirmed = window.confirm(t('privateNotes.confirmDelete'));

  if (!confirmed) {
    return;
  }

  clearMessages();
  privateNotesStore.deleteNote(note.id);

  if (editingNoteId.value === note.id) {
    resetDraft();
  }

  statusMessage.value = t('privateNotes.noteDeleted');
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
            <select v-model="noteDraft.relatedMeetingId">
              <option value="">{{ t('privateNotes.noMeetingLink') }}</option>
              <option
                v-for="meeting in linkedMeetingOptions"
                :key="meeting.id"
                :value="meeting.id"
              >
                {{ getMeetingLabel(meeting.id) }}
              </option>
            </select>
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
      <p v-if="statusMessage" class="meeting-status" role="status">
        {{ statusMessage }}
      </p>
    </PremiumLock>
  </section>
</template>
