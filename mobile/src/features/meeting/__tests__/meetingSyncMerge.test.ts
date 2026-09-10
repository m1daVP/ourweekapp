import { describe, expect, it } from 'vitest';
import type { Meeting } from '../types';
import { acknowledgeMeeting, mergeHydratedMeeting } from '../meetingSyncMerge';

function meeting(): Meeting {
  return {
    id: 'meeting',
    templateId: 'weekly-family-check-in',
    title: 'Weekly meeting',
    status: 'draft',
    participantIds: [],
    checkInCompleted: false,
    sections: [],
    currentSectionIndex: 0,
    createdAt: '2026-09-10T12:00:00.000Z',
    updatedAt: '2026-09-10T12:01:00.000Z',
    serverRevision: 1,
  };
}

describe('meeting hydration merge', () => {
  it('uses a persisted acknowledged base after restart, regardless of clock order', () => {
    const local = meeting();
    const record = JSON.parse(JSON.stringify(acknowledgeMeeting({}, local)));
    const remote = {
      ...local,
      title: 'Updated on partner device',
      serverRevision: 2,
      updatedAt: local.createdAt,
    };
    const result = mergeHydratedMeeting(local, remote, record);
    expect(result.meeting.title).toBe(remote.title);
    expect(result.record.recoveryVersions).toEqual([local]);
    expect(result.record.acknowledged?.revision).toBe(2);
  });

  it('keeps a dirty completed meeting after restart even if the remote timestamp is later', () => {
    const base = meeting();
    const local = {
      ...base,
      status: 'completed' as const,
      completedAt: base.updatedAt,
      title: 'Local notes',
    };
    const remote = {
      ...base,
      serverRevision: 2,
      title: 'Remote draft',
      updatedAt: '2026-09-10T14:00:00.000Z',
    };
    const result = mergeHydratedMeeting(
      local,
      remote,
      acknowledgeMeeting({}, base)
    );
    expect(result.meeting).toBe(local);
    expect(result.record.recoveryVersions).toEqual([remote]);
    expect(result.record.acknowledged?.revision).toBe(1);
    const retry = mergeHydratedMeeting(local, remote, result.record);
    expect(retry.record.recoveryVersions).toHaveLength(1);
  });

  it('does not infer clean content from an unknown legacy base or equal timestamps', () => {
    const local = meeting();
    const remote = { ...local, title: 'Different content', serverRevision: 2 };
    const result = mergeHydratedMeeting(local, remote, {});
    expect(result.meeting).toBe(local);
    expect(result.record.recoveryVersions).toEqual([remote]);
  });

  it('ignores an older revision even when its clock is later', () => {
    const local = { ...meeting(), serverRevision: 3 };
    const remote = {
      ...local,
      title: 'Old',
      serverRevision: 2,
      updatedAt: '2027-01-01T00:00:00.000Z',
    };
    expect(
      mergeHydratedMeeting(local, remote, acknowledgeMeeting({}, local)).meeting
    ).toBe(local);
  });

  it('keeps unsent edits while repairing a server revision whose content still matches the base', () => {
    const base = meeting();
    const local = { ...base, title: 'Unsent edit' };
    const remote = { ...base, serverRevision: 2 };
    const result = mergeHydratedMeeting(
      local,
      remote,
      acknowledgeMeeting({}, base)
    );
    expect(result.meeting).toEqual({ ...local, serverRevision: 2 });
    expect(result.record.acknowledged?.revision).toBe(2);
  });

  it('does not accept a remote deletion over dirty local content', () => {
    const base = meeting();
    const local = { ...base, title: 'Unsent note' };
    const remote = { ...base, deletedAt: base.updatedAt, serverRevision: 2 };
    const result = mergeHydratedMeeting(
      local,
      remote,
      acknowledgeMeeting({}, base)
    );
    expect(result.meeting).toBe(local);
    expect(result.record.recoveryVersions).toEqual([remote]);
  });

  it('retains a recovery copy when an acknowledged clean meeting is deleted remotely', () => {
    const local = meeting();
    const remote = { ...local, deletedAt: local.updatedAt, serverRevision: 2 };
    const result = mergeHydratedMeeting(
      local,
      remote,
      acknowledgeMeeting({}, local)
    );
    expect(result.meeting.deletedAt).toBe(remote.deletedAt);
    expect(result.record.recoveryVersions).toEqual([local]);
  });
});
