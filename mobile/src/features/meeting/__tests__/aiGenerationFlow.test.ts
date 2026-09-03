import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Meeting } from '../types';

const mocks = vi.hoisted(() => ({
  sync: vi.fn(),
  generate: vi.fn(),
  list: vi.fn(),
}));
vi.mock('@/shared/services/syncService', () => ({
  syncCompletedMeetingForAi: mocks.sync,
}));
vi.mock('@/shared/api/aiApi', () => ({
  generateAiMeetingSummary: mocks.generate,
}));
vi.mock('@/shared/api/meetingsApi', () => ({ listMeetings: mocks.list }));

import { useMeetingsStore } from '@/app/stores/meetings';
import { generateMeetingSummary } from '../aiSummaryService';

const source: Meeting = {
  id: 'meeting-1',
  templateId: 'weekly-family-check-in',
  title: 'Weekly check-in',
  status: 'completed',
  participantIds: [],
  checkInCompleted: true,
  sections: [],
  currentSectionIndex: 0,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T11:00:00.000Z',
  completedAt: '2026-09-01T11:00:00.000Z',
  serverRevision: 3,
};
const summary = {
  id: 'summary-1',
  meetingId: source.id,
  shortSummary: 'A useful conversation.',
  mainTopics: [],
  keyTensions: [],
  agreements: [],
  tasks: [],
  suggestedNextMeetingFocus: [],
  createdAt: '2026-09-01T11:00:01.000Z',
};
const meetingSync = {
  meetingId: source.id,
  sourceServerRevision: 3,
  serverRevision: 4,
  updatedAt: '2026-09-01T11:00:10.000Z',
};
function response() {
  return {
    summary: { ...summary },
    meetingSync: { ...meetingSync },
    disclaimer: 'Review it.',
    generatedAt: summary.createdAt,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  useMeetingsStore().meetings = [structuredClone(source)];
  mocks.sync.mockResolvedValue(structuredClone(source));
  mocks.generate.mockResolvedValue(response());
});

describe('acknowledged AI generation', () => {
  it('waits for completion sync, sends its revision, and applies server metadata', async () => {
    let acknowledge!: (value: Meeting) => void;
    mocks.sync.mockReturnValueOnce(
      new Promise<Meeting>((resolve) => {
        acknowledge = resolve;
      })
    );
    const pending = generateMeetingSummary(source);
    expect(mocks.generate).not.toHaveBeenCalled();
    acknowledge(structuredClone(source));
    await pending;
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingId: source.id,
        expectedServerRevision: 3,
      }),
      expect.any(Object)
    );
    expect(useMeetingsStore().meetings[0]).toMatchObject({
      aiSummary: summary,
      serverRevision: 4,
      updatedAt: meetingSync.updatedAt,
    });
  });

  it('preserves local completion and does not call AI after failed sync', async () => {
    mocks.sync.mockRejectedValueOnce(new Error('sync.offline'));
    await expect(generateMeetingSummary(source)).rejects.toThrow();
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(useMeetingsStore().meetings[0]).toEqual(source);
  });

  it('does not acknowledge local edits made during generation', async () => {
    mocks.generate.mockImplementationOnce(async () => {
      useMeetingsStore().meetings[0]!.title = 'Changed locally';
      return response();
    });
    await expect(generateMeetingSummary(source)).rejects.toThrow();
    expect(useMeetingsStore().meetings[0]).toMatchObject({
      title: 'Changed locally',
      serverRevision: 3,
    });
    expect(useMeetingsStore().meetings[0]!.aiSummary).toBeUndefined();
  });

  it('never regresses a newer remote revision', async () => {
    mocks.generate.mockImplementationOnce(async () => {
      useMeetingsStore().meetings[0]!.serverRevision = 5;
      return response();
    });
    await expect(generateMeetingSummary(source)).rejects.toThrow();
    expect(useMeetingsStore().meetings[0]!.serverRevision).toBe(5);
  });

  it('accepts a result already applied by a concurrent authoritative sync', async () => {
    mocks.generate.mockImplementationOnce(async () => {
      Object.assign(useMeetingsStore().meetings[0]!, {
        aiSummary: summary,
        serverRevision: 4,
        updatedAt: meetingSync.updatedAt,
      });
      return response();
    });
    await expect(generateMeetingSummary(source)).resolves.toEqual(summary);
    expect(useMeetingsStore().meetings[0]).toMatchObject({
      aiSummary: summary,
      serverRevision: 4,
    });
  });

  it.each([
    { meetingId: 'another-meeting' },
    { sourceServerRevision: 2 },
    { serverRevision: 2 },
    { serverRevision: 3.5 },
    { updatedAt: 'invalid' },
  ])('rejects invalid metadata %j', async (invalid) => {
    mocks.generate.mockResolvedValueOnce({
      ...response(),
      meetingSync: { ...meetingSync, ...invalid },
    });
    await expect(generateMeetingSummary(source)).rejects.toThrow();
    expect(useMeetingsStore().meetings[0]).toEqual(source);
  });

  it('reconciles an older backend response through authoritative data', async () => {
    mocks.generate.mockResolvedValueOnce({
      ...response(),
      meetingSync: undefined,
    });
    mocks.list.mockResolvedValueOnce({
      meetings: [
        {
          ...source,
          aiSummary: summary,
          serverRevision: 4,
          updatedAt: meetingSync.updatedAt,
        },
      ],
    });
    await generateMeetingSummary(source);
    expect(mocks.list).toHaveBeenCalledOnce();
    expect(useMeetingsStore().meetings[0]!.serverRevision).toBe(4);
  });
});
