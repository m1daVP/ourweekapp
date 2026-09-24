import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  readPrivateNotesForUser: vi.fn(),
  writePrivateNotesForUser: vi.fn(),
}));

vi.mock('@/features/private-notes/services/privateNotesStorageService', () => ({
  readPrivateNotesForUser: mocks.readPrivateNotesForUser,
  writePrivateNotesForUser: mocks.writePrivateNotesForUser,
}));

import { usePrivateNotesStore } from '@/app/stores/privateNotes';

const noteA = {
  id: 'note-a',
  title: 'A',
  content: 'Private A',
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
};
const noteB = { ...noteA, id: 'note-b', title: 'B', content: 'Private B' };

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  mocks.readPrivateNotesForUser.mockImplementation((userId: string) =>
    userId === 'user-a' ? [noteA] : userId === 'user-b' ? [noteB] : []
  );
  mocks.writePrivateNotesForUser.mockReturnValue(true);
});

describe('private notes owner lifecycle', () => {
  it('starts empty and does not read storage before owner binding', () => {
    const store = usePrivateNotesStore();

    expect(store.ownerUserId).toBeNull();
    expect(store.notes).toEqual([]);
    expect(mocks.readPrivateNotesForUser).not.toHaveBeenCalled();
  });

  it('replaces the active view when owners change and clears it on logout', () => {
    const store = usePrivateNotesStore();

    expect(store.bindOwner('user-a')).toBe(true);
    expect(store.notes).toEqual([noteA]);
    expect(store.bindOwner('user-b')).toBe(true);
    expect(store.notes).toEqual([noteB]);

    store.clearOwner();
    expect(store.ownerUserId).toBeNull();
    expect(store.notes).toEqual([]);
    expect(mocks.writePrivateNotesForUser).not.toHaveBeenCalled();
  });

  it('blocks every mutation until an owner is bound', () => {
    const store = usePrivateNotesStore();
    const payload = { title: 'Secret', content: 'Private' };

    expect(store.createNote(payload)).toBeNull();
    expect(store.updateNote('note-a', payload)).toBeNull();
    store.deleteNote('note-a');
    expect(mocks.writePrivateNotesForUser).not.toHaveBeenCalled();
  });

  it('persists mutations only to the bound owner', () => {
    const store = usePrivateNotesStore();
    store.bindOwner('user-a');

    const created = store.createNote({ title: 'New', content: 'Private' });

    expect(created).not.toBeNull();
    expect(mocks.writePrivateNotesForUser).toHaveBeenLastCalledWith(
      'user-a',
      store.notes
    );
  });

  it('fails closed if an owner namespace cannot be read', () => {
    mocks.readPrivateNotesForUser.mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });
    const store = usePrivateNotesStore();

    expect(store.bindOwner('user-a')).toBe(false);
    expect(store.ownerUserId).toBeNull();
    expect(store.notes).toEqual([]);
  });
});
