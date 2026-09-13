import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ drafts: null as unknown, write: vi.fn() }));

vi.mock('@/shared/services/storageService', () => ({
  readStorageSlice: () => storage.drafts,
  writeStorageSlice: (_key: string, value: unknown) => {
    storage.drafts = value;
    storage.write(value);
    return { ok: true };
  },
}));

import {
  discardMeetingComposerDraft,
  loadMeetingComposerDraft,
  saveMeetingComposerDraft,
} from '../meetingComposerDrafts';

const draft = {
  version: 1 as const,
  userId: 'user-1',
  workspaceId: 'workspace-1',
  meetingId: 'meeting-1',
  sectionId: 'goodThings' as const,
  type: 'note' as const,
  fields: { text: 'A calm morning.' },
  updatedAt: '2026-09-14T10:00:00.000Z',
};

describe('meeting composer drafts', () => {
  beforeEach(() => {
    storage.drafts = null;
    storage.write.mockClear();
  });

  it('stores drafts locally by their full account and meeting scope', () => {
    expect(saveMeetingComposerDraft(draft)).toEqual({ ok: true });
    expect(loadMeetingComposerDraft(draft)).toEqual(draft);
    expect(
      loadMeetingComposerDraft({ ...draft, workspaceId: 'workspace-2' })
    ).toBeNull();
  });

  it('removes only the requested draft', () => {
    saveMeetingComposerDraft(draft);
    saveMeetingComposerDraft({
      ...draft,
      type: 'task',
      fields: { title: 'Buy shoes' },
    });

    discardMeetingComposerDraft(draft);

    expect(loadMeetingComposerDraft(draft)).toBeNull();
    expect(loadMeetingComposerDraft({ ...draft, type: 'task' })).toMatchObject({
      fields: { title: 'Buy shoes' },
    });
  });
});
