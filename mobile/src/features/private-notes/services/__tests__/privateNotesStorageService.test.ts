import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readStorageSlice: vi.fn(),
  writeStorageSlice: vi.fn(),
}));

vi.mock('@/shared/services/storageService', () => ({
  readStorageSlice: mocks.readStorageSlice,
  writeStorageSlice: mocks.writeStorageSlice,
}));

import {
  readPrivateNotesForUser,
  writePrivateNotesForUser,
} from '@/features/private-notes/services/privateNotesStorageService';

const noteA = {
  id: 'note-a',
  title: 'A',
  content: 'Private A',
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
};
const noteB = { ...noteA, id: 'note-b', title: 'B', content: 'Private B' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readStorageSlice.mockReturnValue({
    notesByUserId: {
      'user-a': { notes: [noteA, { title: '', content: 'invalid' }] },
      'user-b': { notes: [noteB] },
    },
    quarantinedLegacyNotes: {
      notes: [{ ...noteA, id: 'quarantined' }],
      quarantinedAt: '2026-09-08T11:00:00.000Z',
    },
  });
});

describe('privateNotesStorageService', () => {
  it('reads only the requested owner and excludes invalid notes', () => {
    expect(readPrivateNotesForUser('user-a')).toEqual([noteA]);
    expect(readPrivateNotesForUser('user-b')).toEqual([noteB]);
    expect(readPrivateNotesForUser('user-c')).toEqual([]);
  });

  it.each(['', '  ', '__proto__', 'prototype', 'constructor'])(
    'rejects unsafe owner key %j',
    (userId) => {
      expect(readPrivateNotesForUser(userId)).toEqual([]);
      expect(writePrivateNotesForUser(userId, [noteA])).toBe(false);
    }
  );

  it('updates one namespace while preserving other owners and quarantine', () => {
    const updated = [{ ...noteA, content: 'Updated A' }];

    expect(writePrivateNotesForUser('user-a', updated)).toBe(true);
    expect(mocks.writeStorageSlice).toHaveBeenCalledWith('privateNotes', {
      notesByUserId: {
        'user-a': { notes: updated },
        'user-b': { notes: [noteB] },
      },
      quarantinedLegacyNotes: {
        notes: [{ ...noteA, id: 'quarantined' }],
        quarantinedAt: '2026-09-08T11:00:00.000Z',
      },
    });
  });
});
