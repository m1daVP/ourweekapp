import { defineStore } from 'pinia';
import {
  readPrivateNotesForUser,
  writePrivateNotesForUser,
} from '@/features/private-notes/services/privateNotesStorageService';
import { compareIsoDesc, nowIso } from '@/shared/utils/dates';
import { createPrefixedId } from '@/shared/utils/ids';
import type { PrivateNote } from '@/features/private-notes/types';

interface PrivateNotesState {
  ownerUserId: string | null;
  notes: PrivateNote[];
}

interface NotePayload {
  title: string;
  content: string;
  relatedMeetingId?: string;
}

function sortByUpdatedDesc(notes: PrivateNote[]) {
  return [...notes].sort((first, second) =>
    compareIsoDesc(first.updatedAt, second.updatedAt)
  );
}

export const usePrivateNotesStore = defineStore('privateNotes', {
  state: (): PrivateNotesState => ({ ownerUserId: null, notes: [] }),
  getters: {
    sortedNotes: (state) => sortByUpdatedDesc(state.notes),
  },
  actions: {
    bindOwner(userId: string) {
      this.clearOwner();
      const ownerUserId = userId.trim();

      if (!ownerUserId) {
        return false;
      }

      try {
        const notes = readPrivateNotesForUser(ownerUserId);
        this.ownerUserId = ownerUserId;
        this.notes = notes;
        return true;
      } catch {
        return false;
      }
    },
    clearOwner() {
      this.ownerUserId = null;
      this.notes = [];
    },
    persist() {
      return this.ownerUserId
        ? writePrivateNotesForUser(this.ownerUserId, this.notes)
        : false;
    },
    createNote(payload: NotePayload) {
      const title = payload.title.trim();
      const content = payload.content.trim();

      if (!this.ownerUserId || !title || !content) {
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

      if (!this.ownerUserId || !note || !title || !content) {
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
      if (!this.ownerUserId) {
        return;
      }

      const originalLength = this.notes.length;
      this.notes = this.notes.filter((note) => note.id !== noteId);

      if (this.notes.length !== originalLength) {
        this.persist();
      }
    },
  },
});
