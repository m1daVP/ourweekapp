import { describe, expect, it } from 'vitest';
import {
  getInsightResultRoute,
  getTaskTags,
} from '@/features/insights/presentation';

describe('household insight presentation', () => {
  it('uses factual task tags without adding a skipped task to follow-through tags', () => {
    expect(
      getTaskTags({
        done: 3,
        open: 1,
        skipped: 2,
        overdue: 1,
        completionRate: 0.75,
      })
    ).toEqual(['3 done', '1 open', '1 overdue']);
  });

  it('links agreement results to their source meeting and tasks to the existing task page', () => {
    expect(
      getInsightResultRoute({
        id: 'agreement-1',
        type: 'agreement',
        title: 'Alternate pickup',
        occurredAt: '2026-08-20T12:00:00.000Z',
        status: null,
        sourceMeetingId: 'meeting-1',
      })
    ).toEqual({ name: 'meeting-summary', params: { meetingId: 'meeting-1' } });
    expect(
      getInsightResultRoute({
        id: 'task-1',
        type: 'task',
        title: 'Book dentist',
        occurredAt: '2026-08-20T12:00:00.000Z',
        status: 'open',
        sourceMeetingId: null,
      })
    ).toEqual({ name: 'tasks' });
  });
});
