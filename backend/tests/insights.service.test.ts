import { describe, expect, it, vi } from 'vitest';

import { InsightsService, normalizeRecurringTopic } from '../src/modules/insights/insights.service.js';
import type {
  InsightAgreementRecord,
  InsightFollowUpRecord,
  InsightMeetingRecord,
  InsightTaskRecord,
} from '../src/modules/insights/insights.repository.js';
import type { AuthContext } from '../src/shared/auth/index.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const auth: AuthContext = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '33333333-3333-4333-8333-333333333333',
  workspaceId,
  role: 'adult_member',
  planType: 'premium',
};
const now = new Date('2026-08-25T12:00:00.000Z');

function meeting(overrides: Partial<InsightMeetingRecord> = {}): InsightMeetingRecord {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    title: 'Weekly check-in',
    completedAt: '2026-08-20T12:00:00.000Z',
    sections: [],
    ...overrides,
  };
}

function task(overrides: Partial<InsightTaskRecord> = {}): InsightTaskRecord {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    title: 'Book dentist',
    status: 'open',
    dueDate: null,
    createdAt: '2026-08-20T12:00:00.000Z',
    sourceMeetingId: null,
    ...overrides,
  };
}

function agreement(overrides: Partial<InsightAgreementRecord> = {}): InsightAgreementRecord {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    title: 'Alternate pickup',
    description: null,
    createdAt: '2026-08-20T12:00:00.000Z',
    sourceMeetingId: '44444444-4444-4444-8444-444444444444',
    ...overrides,
  };
}

function followUp(overrides: Partial<InsightFollowUpRecord> = {}): InsightFollowUpRecord {
  return {
    sourceId: '66666666-6666-4666-8666-666666666666',
    state: 'open',
    updatedAt: '2026-08-21T12:00:00.000Z',
    ...overrides,
  };
}

function createHarness(input: {
  meetings?: InsightMeetingRecord[];
  tasks?: InsightTaskRecord[];
  agreements?: InsightAgreementRecord[];
  followUps?: InsightFollowUpRecord[];
} = {}) {
  const repository = {
    listCompletedMeetingsForPeriod: vi.fn().mockResolvedValue(input.meetings ?? []),
    listTasksCreatedInPeriod: vi.fn().mockResolvedValue(input.tasks ?? []),
    listAgreementsCreatedInPeriod: vi.fn().mockResolvedValue(input.agreements ?? []),
    listAgreementFollowUps: vi.fn().mockResolvedValue(input.followUps ?? []),
    searchMeetings: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    searchTasks: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    searchAgreements: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  };

  return { repository, service: new InsightsService(repository) };
}

describe('InsightsService', () => {
  it('calculates task follow-through from current statuses without counting skipped tasks in the rate', async () => {
    const { service } = createHarness({
      tasks: [
        task({ id: 'task-done', status: 'done' }),
        task({ id: 'task-open', status: 'open', dueDate: '2026-08-24' }),
        task({ id: 'task-skipped', status: 'skipped' }),
      ],
    });

    const result = await service.getInsights(auth, { period: '4w' }, now);

    expect(result.taskFollowThrough).toEqual({
      done: 1,
      open: 1,
      skipped: 1,
      overdue: 1,
      completionRate: 0.5,
    });
  });

  it('keeps agreements without follow-ups visibly untracked', async () => {
    const { service } = createHarness({ agreements: [agreement()] });

    const result = await service.getInsights(auth, { period: '12w' }, now);

    expect(result.agreementFollowThrough).toEqual({
      resolved: 0,
      unresolved: 0,
      notTrackedYet: 1,
    });
  });

  it('uses the latest follow-up state for each agreement', async () => {
    const { service } = createHarness({
      agreements: [agreement()],
      followUps: [
        followUp({ state: 'open', updatedAt: '2026-08-21T12:00:00.000Z' }),
        followUp({ state: 'resolved', updatedAt: '2026-08-22T12:00:00.000Z' }),
      ],
    });

    const result = await service.getInsights(auth, { period: 'all' }, now);

    expect(result.agreementFollowThrough).toEqual({
      resolved: 1,
      unresolved: 0,
      notTrackedYet: 0,
    });
  });

  it('counts a normalized recurring topic once per meeting and never reads note text', async () => {
    const { service } = createHarness({
      meetings: [
        meeting({
          id: 'meeting-one',
          sections: [
            { title: '  Weekly   plans ' },
            { title: 'weekly plans' },
            { notes: [{ text: 'A private-looking note must not be used.' }] },
          ],
        }),
        meeting({
          id: 'meeting-two',
          completedAt: '2026-08-22T12:00:00.000Z',
          sections: [{ title: 'Weekly plans' }],
        }),
      ],
    });

    const result = await service.getInsights(auth, { period: 'all' }, now);

    expect(result.recurringTopics).toEqual([
      { title: 'Weekly plans', meetingCount: 2, meetingIds: ['meeting-one', 'meeting-two'] },
    ]);
  });

  it('returns no average interval until two completed meetings exist', async () => {
    const { service } = createHarness({ meetings: [meeting()] });

    const result = await service.getInsights(auth, { period: '4w' }, now);

    expect(result.meetingConsistency).toEqual({
      completedMeetings: 1,
      averageIntervalDays: null,
    });
  });

  it('blocks viewers before any source data is loaded', async () => {
    const { repository, service } = createHarness();

    await expect(service.getInsights({ ...auth, role: 'viewer' }, { period: '4w' }, now))
      .rejects.toMatchObject({ statusCode: 403, code: 'forbidden' });
    expect(repository.listCompletedMeetingsForPeriod).not.toHaveBeenCalled();
  });

  it('normalizes recurring titles predictably', () => {
    expect(normalizeRecurringTopic('  Weekly   plans ')).toBe('weekly plans');
    expect(normalizeRecurringTopic('   ')).toBeNull();
    expect(normalizeRecurringTopic({ title: 'Weekly plans' })).toBeNull();
  });
});
