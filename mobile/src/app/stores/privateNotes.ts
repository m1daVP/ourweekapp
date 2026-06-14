import { defineStore } from 'pinia';
import {
  readStorageSlice,
  writeStorageSlice,
} from '@/shared/services/storageService';
import { compareIsoDesc, nowIso } from '@/shared/utils/dates';
import { createPrefixedId } from '@/shared/utils/ids';
import type { PrivateNote } from '@/features/private-notes/types';

interface PrivateNotesState {
  notes: PrivateNote[];
}

interface NotePayload {
  title: string;
  content: string;
  relatedMeetingId?: string;
}

interface LegacyPrivateNote {
  id?: string;
  title?: string;
  content?: string;
  relatedMeetingId?: string;
  createdAt?: string;
  updatedAt?: string;
}

function normalizeNote(note: LegacyPrivateNote): PrivateNote | null {
  const title = note.title?.trim();
  const content = note.content?.trim();

  if (!title || !content) {
    return null;
  }

  const createdAt = note.createdAt ?? nowIso();

  return {
    id: note.id ?? createPrefixedId('private-note'),
    title,
    content,
    relatedMeetingId: note.relatedMeetingId?.trim() || undefined,
    createdAt,
    updatedAt: note.updatedAt ?? createdAt,
  };
}

function getStoredState(): PrivateNotesState {
  const storedState = readStorageSlice<Partial<{
    notes: LegacyPrivateNote[];
  }> | null>('privateNotes', null);

  if (!storedState) {
    return { notes: [] };
  }

  return {
    notes: Array.isArray(storedState.notes)
      ? storedState.notes
          .map(normalizeNote)
          .filter((note): note is PrivateNote => Boolean(note))
      : [],
  };
}

function sortByUpdatedDesc(notes: PrivateNote[]) {
  return [...notes].sort((first, second) =>
    compareIsoDesc(first.updatedAt, second.updatedAt)
  );
}

export const usePrivateNotesStore = defineStore('privateNotes', {
  state: (): PrivateNotesState => getStoredState(),
  getters: {
    sortedNotes: (state) => sortByUpdatedDesc(state.notes),
  },
  actions: {
    persist() {
      writeStorageSlice('privateNotes', { notes: this.notes });
    },
    createNote(payload: NotePayload) {
      const title = payload.title.trim();
      const content = payload.content.trim();

      if (!title || !content) {
        return null;
      }

      const createdAt = nowIso();
      const note: PrivateNote = {
        id: createPrefixedId('private-note'),
        title,
        content,
        relatedMeetingId: payload.relatedMeetingId?.trim() || undefined,
        createdAt,
        updatedAt: createdAt,
      };

      this.notes.unshift(note);
      this.persist();
      return note;
    },
    updateNote(noteId: string, payload: NotePayload) {
      const note = this.notes.find((item) => item.id === noteId);
      const title = payload.title.trim();
      const content = payload.content.trim();

      if (!note || !title || !content) {
        return null;
      }

      note.title = title;
      note.content = content;
      note.relatedMeetingId = payload.relatedMeetingId?.trim() || undefined;
      note.updatedAt = nowIso();
      this.persist();
      return note;
    },
    deleteNote(noteId: string) {
      const originalLength = this.notes.length;
      this.notes = this.notes.filter((note) => note.id !== noteId);

      if (this.notes.length !== originalLength) {
        this.persist();
      }
    },
  },
});
