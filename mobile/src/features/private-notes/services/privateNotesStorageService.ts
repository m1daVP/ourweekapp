import type { PrivateNote } from '@/features/private-notes/types';
import {
  readStorageSlice,
  writeStorageSlice,
} from '@/shared/services/storageService';
import { nowIso } from '@/shared/utils/dates';
import { createPrefixedId } from '@/shared/utils/ids';

interface StoredNoteNamespace {
  notes: unknown[];
}

interface PrivateNotesStorage {
  notesByUserId: Record<string, StoredNoteNamespace>;
  quarantinedLegacyNotes?: {
    notes: unknown[];
    quarantinedAt: string;
  };
}

interface LegacyPrivateNote {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  relatedMeetingId?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const forbiddenOwnerKeys = new Set(['__proto__', 'prototype', 'constructor']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOwnerUserId(userId: string) {
  const normalized = userId.trim();
  return normalized && !forbiddenOwnerKeys.has(normalized) ? normalized : null;
}

function normalizeNote(value: unknown): PrivateNote | null {
  if (!isRecord(value)) {
    return null;
  }

  const note = value as LegacyPrivateNote;
  const title = typeof note.title === 'string' ? note.title.trim() : '';
  const content = typeof note.content === 'string' ? note.content.trim() : '';

  if (!title || !content) {
    return null;
  }

  const createdAt =
    typeof note.createdAt === 'string' && note.createdAt
      ? note.createdAt
      : nowIso();

  return {
    id:
      typeof note.id === 'string' && note.id.trim()
        ? note.id
        : createPrefixedId('private-note'),
    title,
    content,
    relatedMeetingId:
      typeof note.relatedMeetingId === 'string' && note.relatedMeetingId.trim()
        ? note.relatedMeetingId.trim()
        : undefined,
    createdAt,
    updatedAt:
      typeof note.updatedAt === 'string' && note.updatedAt
        ? note.updatedAt
        : createdAt,
  };
}

function normalizeStorage(value: unknown): PrivateNotesStorage {
  const record = isRecord(value) ? value : {};
  const rawNamespaces = isRecord(record.notesByUserId)
    ? record.notesByUserId
    : {};
  const notesByUserId: Record<string, StoredNoteNamespace> =
    Object.create(null);

  for (const [userId, namespace] of Object.entries(rawNamespaces)) {
    const ownerUserId = normalizeOwnerUserId(userId);
    if (
      !ownerUserId ||
      !isRecord(namespace) ||
      !Array.isArray(namespace.notes)
    ) {
      continue;
    }
    notesByUserId[ownerUserId] = { notes: [...namespace.notes] };
  }

  const quarantine = isRecord(record.quarantinedLegacyNotes)
    ? record.quarantinedLegacyNotes
    : null;

  return {
    notesByUserId,
    ...(quarantine &&
    Array.isArray(quarantine.notes) &&
    typeof quarantine.quarantinedAt === 'string'
      ? {
          quarantinedLegacyNotes: {
            notes: [...quarantine.notes],
            quarantinedAt: quarantine.quarantinedAt,
          },
        }
      : {}),
  };
}

export function readPrivateNotesForUser(userId: string): PrivateNote[] {
  const ownerUserId = normalizeOwnerUserId(userId);
  if (!ownerUserId) {
    return [];
  }

  const storage = normalizeStorage(
    readStorageSlice<unknown>('privateNotes', null)
  );
  const namespace = storage.notesByUserId[ownerUserId];

  return namespace
    ? namespace.notes
        .map(normalizeNote)
        .filter((note): note is PrivateNote => Boolean(note))
    : [];
}

export function writePrivateNotesForUser(userId: string, notes: PrivateNote[]) {
  const ownerUserId = normalizeOwnerUserId(userId);
  if (!ownerUserId) {
    return false;
  }

  const storage = normalizeStorage(
    readStorageSlice<unknown>('privateNotes', null)
  );
  writeStorageSlice('privateNotes', {
    ...storage,
    notesByUserId: {
      ...storage.notesByUserId,
      [ownerUserId]: { notes: notes.map((note) => ({ ...note })) },
    },
  });
  return true;
}
