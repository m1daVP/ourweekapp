import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  drafts: null as unknown,
  write: vi.fn(),
  writeResult: { ok: true } as
    { ok: true } | { ok: false; reason: 'write_failed' },
}));

vi.mock('@/shared/services/storageService', () => ({
  readStorageSlice: () => storage.drafts,
  writeStorageSlice: (_key: string, value: unknown) => {
    storage.drafts = value;
    storage.write(value);
    return storage.writeResult;
  },
}));

import {
  discardMeetingComposerDraft,
  discardMeetingComposerDraftsForMeeting,
  getMeetingComposerDraftsForMeeting,
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
    storage.writeResult = { ok: true };
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

  it('returns only unsubmitted drafts for the current account and meeting', () => {
    saveMeetingComposerDraft(draft);
    saveMeetingComposerDraft({
      ...draft,
      type: 'task',
      fields: { title: 'Already submitted' },
      submittedItemId: 'task-1',
    });
    saveMeetingComposerDraft({
      ...draft,
      type: 'agreement',
      meetingId: 'meeting-2',
      fields: { text: 'Other meeting' },
    });

    expect(
      getMeetingComposerDraftsForMeeting('user-1', 'workspace-1', 'meeting-1')
    ).toEqual([draft]);
  });

  it('removes only unsubmitted drafts for the requested account and meeting', () => {
    saveMeetingComposerDraft(draft);
    saveMeetingComposerDraft({
      ...draft,
      type: 'task',
      fields: { title: 'Already submitted' },
      submittedItemId: 'task-1',
    });
    saveMeetingComposerDraft({
      ...draft,
      type: 'agreement',
      meetingId: 'meeting-2',
      fields: { text: 'Other meeting' },
    });
    saveMeetingComposerDraft({
      ...draft,
      type: 'agreement',
      workspaceId: 'workspace-2',
      fields: { text: 'Other workspace' },
    });
    saveMeetingComposerDraft({
      ...draft,
      type: 'agreement',
      userId: 'user-2',
      fields: { text: 'Other user' },
    });

    expect(
      discardMeetingComposerDraftsForMeeting(
        'user-1',
        'workspace-1',
        'meeting-1'
      )
    ).toEqual({ ok: true });

    expect(
      getMeetingComposerDraftsForMeeting('user-1', 'workspace-1', 'meeting-1')
    ).toEqual([]);
    expect(loadMeetingComposerDraft({ ...draft, type: 'task' })).toMatchObject({
      submittedItemId: 'task-1',
    });
    expect(
      getMeetingComposerDraftsForMeeting('user-1', 'workspace-1', 'meeting-2')
    ).toHaveLength(1);
    expect(
      getMeetingComposerDraftsForMeeting('user-1', 'workspace-2', 'meeting-1')
    ).toHaveLength(1);
    expect(
      getMeetingComposerDraftsForMeeting('user-2', 'workspace-1', 'meeting-1')
    ).toHaveLength(1);
  });

  it('does not write when the requested meeting has no unsubmitted drafts', () => {
    expect(
      discardMeetingComposerDraftsForMeeting(
        'user-1',
        'workspace-1',
        'meeting-1'
      )
    ).toEqual({ ok: true });
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('returns the storage failure when scoped draft cleanup cannot be saved', () => {
    saveMeetingComposerDraft(draft);
    storage.writeResult = { ok: false, reason: 'write_failed' };

    expect(
      discardMeetingComposerDraftsForMeeting(
        'user-1',
        'workspace-1',
        'meeting-1'
      )
    ).toEqual({ ok: false, reason: 'write_failed' });
  });
});
