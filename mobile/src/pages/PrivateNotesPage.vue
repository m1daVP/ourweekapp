<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useMeetingsStore } from '@/app/stores/meetings';
import { usePrivateNotesStore } from '@/app/stores/privateNotes';
import type { Meeting } from '@/features/meeting/types';
import type { PrivateNote } from '@/features/private-notes/types';
import PremiumLock from '@/shared/components/PremiumLock.vue';

const meetingsStore = useMeetingsStore();
const privateNotesStore = usePrivateNotesStore();

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
  return new Intl.DateTimeFormat(undefined, {
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
    formError.value = 'Add a title and note before saving.';
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
    formError.value = 'Add a title and note before saving.';
    return;
  }

  statusMessage.value = editingNoteId.value
    ? 'Private note updated.'
    : 'Private note saved.';
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
  const confirmed = window.confirm('Delete this private note?');

  if (!confirmed) {
    return;
  }

  clearMessages();
  privateNotesStore.deleteNote(note.id);

  if (editingNoteId.value === note.id) {
    resetDraft();
  }

  statusMessage.value = 'Private note deleted.';
}
</script>

<template>
  <section class="page-stack private-notes-page">
    <header>
      <p class="page-kicker">Private notes</p>
      <h1>Personal reflections</h1>
      <p class="page-copy">
        Keep personal thoughts separate from shared meeting notes, tasks, and
        agreements.
      </p>
    </header>

    <section
      class="content-panel private-note-disclaimer"
      aria-label="Private notes storage note"
    >
      <strong>For your own reflection</strong>
      <p>Private notes are stored on this device in the current MVP.</p>
    </section>

    <PremiumLock
      feature="privateNotes"
      title="Private notes are premium"
      message="Upgrade to keep personal meeting prep and reflections separate from shared household records."
      :show-preview="false"
    >
      <section
        class="content-panel private-note-editor"
        aria-labelledby="private-note-editor-title"
      >
        <div>
          <h2 id="private-note-editor-title">
            {{ isEditing ? 'Edit private note' : 'Create private note' }}
          </h2>
          <p>
            These notes stay out of shared meeting summaries and agreements.
          </p>
        </div>

        <form class="private-note-form" @submit.prevent="saveNote">
          <label>
            <span>Title</span>
            <input
              v-model="noteDraft.title"
              type="text"
              placeholder="What is this about?"
            />
          </label>

          <label>
            <span>Note</span>
            <textarea
              v-model="noteDraft.content"
              rows="6"
              placeholder="Write what you want to remember for yourself."
            />
          </label>

          <label>
            <span>Related meeting</span>
            <select v-model="noteDraft.relatedMeetingId">
              <option value="">No meeting link</option>
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
              {{ isEditing ? 'Save changes' : 'Save note' }}
            </button>
            <button v-if="isEditing" type="button" @click="resetDraft">
              Cancel
            </button>
          </div>
        </form>
      </section>

      <section
        class="content-panel private-note-list-panel"
        aria-labelledby="private-note-list-title"
      >
        <div>
          <h2 id="private-note-list-title">Saved private notes</h2>
          <p>{{ notes.length }} personal notes on this device.</p>
        </div>

        <ul v-if="notes.length" class="private-note-list">
          <li v-for="note in notes" :key="note.id" class="private-note-item">
            <div class="private-note-item__body">
              <span>{{ formatDate(note.updatedAt) }}</span>
              <h3>{{ note.title }}</h3>
              <p>{{ note.content }}</p>
              <small v-if="note.relatedMeetingId">
                Linked to {{ getMeetingLabel(note.relatedMeetingId) }}
              </small>
            </div>
            <div class="private-note-item__actions">
              <button type="button" @click="editNote(note)">Edit</button>
              <button
                type="button"
                class="private-note-item__danger"
                @click="deleteNote(note)"
              >
                Delete
              </button>
            </div>
          </li>
        </ul>

        <p v-else class="meeting-empty">
          No private notes yet. Add one before or after a meeting.
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
