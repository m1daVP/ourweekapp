import { describe, expect, it } from 'vitest';
import {
  mergeReviewDecisions,
  mergeSyncItems,
  type SyncableItem,
} from '@/shared/services/syncMergeService';

interface TestItem extends SyncableItem {
  title: string;
}

function item(
  id: string,
  updatedAt: string,
  overrides: Partial<TestItem> = {}
): TestItem {
  return {
    id,
    title: `${id} title`,
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt,
    ...overrides,
  };
}

describe('mergeSyncItems', () => {
  it('keeps the newer remote item', () => {
    const merged = mergeSyncItems(
      [item('task-1', '2026-06-01T09:00:00.000Z', { title: 'local' })],
      [item('task-1', '2026-06-01T10:00:00.000Z', { title: 'remote' })]
    );

    expect(merged).toEqual([
      expect.objectContaining({ id: 'task-1', title: 'remote' }),
    ]);
  });

  it('preserves the newer local item', () => {
    const merged = mergeSyncItems(
      [item('task-1', '2026-06-01T10:00:00.000Z', { title: 'local' })],
      [item('task-1', '2026-06-01T09:00:00.000Z', { title: 'remote' })]
    );

    expect(merged).toEqual([
      expect.objectContaining({ id: 'task-1', title: 'local' }),
    ]);
  });

  it('removes an item when the remote deletion is newer', () => {
    const merged = mergeSyncItems(
      [item('task-1', '2026-06-01T09:00:00.000Z')],
      [
        item('task-1', '2026-06-01T09:00:00.000Z', {
          deletedAt: '2026-06-01T10:00:00.000Z',
        }),
      ]
    );

    expect(merged).toEqual([]);
  });

  it('does not remove newer local data with an older remote deletion', () => {
    const merged = mergeSyncItems(
      [item('task-1', '2026-06-01T10:00:00.000Z', { title: 'local' })],
      [
        item('task-1', '2026-06-01T08:00:00.000Z', {
          deletedAt: '2026-06-01T09:00:00.000Z',
        }),
      ]
    );

    expect(merged).toEqual([
      expect.objectContaining({ id: 'task-1', title: 'local' }),
    ]);
  });

  it('keeps current remote-wins behavior for equal timestamps', () => {
    const merged = mergeSyncItems(
      [item('task-1', '2026-06-01T10:00:00.000Z', { title: 'local' })],
      [item('task-1', '2026-06-01T10:00:00.000Z', { title: 'remote' })]
    );

    expect(merged).toEqual([
      expect.objectContaining({ id: 'task-1', title: 'remote' }),
    ]);
  });
});

describe('mergeReviewDecisions', () => {
  it('keeps the latest decision per meeting/source pair', () => {
    const merged = mergeReviewDecisions(
      [
        {
          meetingId: 'meeting-1',
          sourceMeetingId: 'source-1',
          decidedAt: '2026-06-01T09:00:00.000Z',
        },
      ],
      [
        {
          meetingId: 'meeting-1',
          sourceMeetingId: 'source-1',
          decidedAt: '2026-06-01T10:00:00.000Z',
        },
      ]
    );

    expect(merged).toEqual([
      {
        meetingId: 'meeting-1',
        sourceMeetingId: 'source-1',
        decidedAt: '2026-06-01T10:00:00.000Z',
      },
    ]);
  });
});
