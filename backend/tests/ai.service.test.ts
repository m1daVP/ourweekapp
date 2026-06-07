import { describe, expect, it, vi } from 'vitest';

import { AiSummaryService } from '../src/modules/ai/ai.service.js';
import type { AiSummaryProvider } from '../src/modules/ai/openai.client.js';
import type { MeetingDto as MeetingRepositoryDto } from '../src/modules/meetings/meetings.repository.js';
import type { AuthContext } from '../src/shared/auth/index.js';

const now = '2026-06-06T10:00:00.000Z';
const meetingId = '11111111-1111-4111-8111-111111111111';
const workspaceId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';

const auth: AuthContext = {
  userId,
  sessionId: '44444444-4444-4444-8444-444444444444',
  workspaceId,
  role: 'adult_member',
  planType: 'premium',
};

const viewerAuth: AuthContext = {
  ...auth,
  role: 'viewer',
};

function meeting(overrides: Partial<MeetingRepositoryDto> = {}): MeetingRepositoryDto {
  return {
    id: meetingId,
    workspaceId,
    templateId: 'default',
    title: 'Weekly check-in',
    status: 'completed',
    participantIds: ['participant_1'],
    sections: [
      {
        id: 'section_1',
        title: 'Planning',
        notes: [
          {
            id: 'note_1',
            participantId: 'participant_1',
            text: 'We agreed to split school pickup.',
            privateNotes: 'This must never leave the backend.',
          },
          { id: 'private_1', text: 'private true text', private: true },
          { id: 'private_2', text: 'isPrivate true text', isPrivate: true },
          { id: 'private_3', text: 'private visibility text', visibility: 'private' },
          { id: 'private_4', text: 'private type text', type: 'private' },
        ],
        privateNotes: ['Do not include me.'],
        tasks: [
          {
            title: 'Book dentist',
            responsibleParticipantIds: ['participant_1'],
          },
        ],
        agreements: [
          {
            title: 'Alternate pickup',
            description: 'Take turns each week.',
            participantIds: ['participant_1'],
          },
        ],
      },
    ],
    currentSectionIndex: 0,
    aiSummary: null,
    serverRevision: 1,
    createdAt: '2026-06-06T09:00:00.000Z',
    updatedAt: '2026-06-06T09:30:00.000Z',
    completedAt: '2026-06-06T09:30:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

function providerOutput(overrides: Record<string, unknown> = {}) {
  return {
    shortSummary: 'You reviewed pickup logistics and agreed on a next step.',
    mainTopics: ['School pickup'],
    keyTensions: [],
    agreements: ['Alternate pickup each week'],
    tasks: [{ title: 'Book dentist', responsibleParticipantIds: ['participant_1'] }],
    suggestedNextMeetingFocus: ['Review whether the pickup plan worked'],
    ...overrides,
  };
}

function createHarness(input: {
  meeting?: MeetingRepositoryDto | null;
  providerOutput?: unknown;
  providerError?: unknown;
  userCount?: number;
  workspaceCount?: number;
  updatedMeeting?: MeetingRepositoryDto | null;
  aiConfigured?: boolean;
} = {}) {
  const provider: AiSummaryProvider = {
    generateMeetingSummary: vi.fn().mockImplementation(async () => {
      if (input.providerError) {
        throw input.providerError;
      }

      return input.providerOutput ?? providerOutput();
    }),
  };
  const meetings = {
    findMeetingByIdForWorkspace: vi.fn().mockResolvedValue(
      input.meeting === undefined ? meeting() : input.meeting,
    ),
    updateMeetingSummary: vi.fn().mockResolvedValue(
      input.updatedMeeting === undefined ? meeting() : input.updatedMeeting,
    ),
  };
  const ai = {
    createSummaryRequest: vi.fn().mockResolvedValue({ id: 'request_1' }),
    markSummaryRequestCompleted: vi.fn().mockResolvedValue({ id: 'request_1' }),
    markSummaryRequestFailed: vi.fn().mockResolvedValue({ id: 'request_1' }),
    countRecentSummaryRequestsForWorkspace: vi.fn().mockResolvedValue(input.workspaceCount ?? 0),
    countRecentSummaryRequestsForUserInWorkspace: vi.fn().mockResolvedValue(input.userCount ?? 0),
  };
  const service = new AiSummaryService(ai, meetings, provider, {
    aiConfigured: input.aiConfigured ?? true,
    model: 'test-model',
  });

  return { ai, meetings, provider, service };
}

describe('AiSummaryService', () => {
  it('generates, validates, stores, and returns a meeting summary with a disclaimer', async () => {
    const { ai, meetings, provider, service } = createHarness();

    const response = await service.generateMeetingSummary(
      auth,
      { meetingId, locale: 'en' },
      new Date(now),
    );

    expect(response.summary).toMatchObject({
      meetingId,
      shortSummary: 'You reviewed pickup logistics and agreed on a next step.',
      mainTopics: ['School pickup'],
    });
    expect(response.disclaimer).toContain('AI summaries');
    expect(response.generatedAt).toBe(now);
    expect(provider.generateMeetingSummary).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'test-model' }),
    );
    expect(meetings.updateMeetingSummary).toHaveBeenCalledWith(
      workspaceId,
      meetingId,
      expect.objectContaining({
        meetingId,
        shortSummary: 'You reviewed pickup logistics and agreed on a next step.',
      }),
    );
    expect(ai.markSummaryRequestCompleted).toHaveBeenCalledWith(
      workspaceId,
      'request_1',
      now,
    );
  });

  it('does not include private notes in the AI prompt payload', async () => {
    const { provider, service } = createHarness();

    await service.generateMeetingSummary(auth, { meetingId }, new Date(now));

    const call = vi.mocked(provider.generateMeetingSummary).mock.calls[0]?.[0];

    expect(call?.userPrompt).toContain('We agreed to split school pickup.');
    expect(call?.userPrompt).not.toContain('This must never leave the backend.');
    expect(call?.userPrompt).not.toContain('Do not include me.');
    expect(call?.userPrompt).not.toContain('private true text');
    expect(call?.userPrompt).not.toContain('isPrivate true text');
    expect(call?.userPrompt).not.toContain('private visibility text');
    expect(call?.userPrompt).not.toContain('private type text');
    expect(call?.userPrompt).not.toContain('privateNotes');
  });

  it('requires the meeting to belong to the authenticated workspace', async () => {
    const { ai, meetings, provider, service } = createHarness({ meeting: null });

    await expect(
      service.generateMeetingSummary(auth, { meetingId }, new Date(now)),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'meeting_not_found',
    });
    expect(meetings.findMeetingByIdForWorkspace).toHaveBeenCalledWith(
      workspaceId,
      meetingId,
    );
    expect(ai.createSummaryRequest).not.toHaveBeenCalled();
    expect(provider.generateMeetingSummary).not.toHaveBeenCalled();
  });

  it('rejects malformed provider output before storing it', async () => {
    const { ai, meetings, service } = createHarness({
      providerOutput: providerOutput({ tasks: [{ title: '' }] }),
    });

    await expect(
      service.generateMeetingSummary(auth, { meetingId }, new Date(now)),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'ai_summary_generation_failed',
    });
    expect(meetings.updateMeetingSummary).not.toHaveBeenCalled();
    expect(ai.markSummaryRequestFailed).toHaveBeenCalledWith(
      workspaceId,
      'request_1',
      now,
      'ai_summary_generation_failed',
    );
  });

  it('marks the request failed and returns a safe error when the provider fails', async () => {
    const { ai, service } = createHarness({
      providerError: new Error('provider timeout with sensitive text'),
    });

    await expect(
      service.generateMeetingSummary(auth, { meetingId }, new Date(now)),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'ai_summary_generation_failed',
    });
    expect(ai.markSummaryRequestFailed).toHaveBeenCalledWith(
      workspaceId,
      'request_1',
      now,
      'ai_summary_generation_failed',
    );
  });

  it('returns a conflict when the meeting changes while saving the summary', async () => {
    const { ai, service } = createHarness({ updatedMeeting: null });

    await expect(
      service.generateMeetingSummary(auth, { meetingId }, new Date(now)),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'meeting_update_conflict',
    });
    expect(ai.markSummaryRequestFailed).toHaveBeenCalledWith(
      workspaceId,
      'request_1',
      now,
      'meeting_update_conflict',
    );
  });

  it('applies per-user and per-workspace repository-backed rate limits', async () => {
    const { ai, meetings, provider, service } = createHarness({ userCount: 5 });

    await expect(
      service.generateMeetingSummary(auth, { meetingId }, new Date(now)),
    ).rejects.toMatchObject({
      statusCode: 429,
      code: 'ai_summary_rate_limited',
    });
    expect(ai.countRecentSummaryRequestsForWorkspace).toHaveBeenCalled();
    expect(ai.countRecentSummaryRequestsForUserInWorkspace).toHaveBeenCalled();
    expect(meetings.findMeetingByIdForWorkspace).not.toHaveBeenCalled();
    expect(provider.generateMeetingSummary).not.toHaveBeenCalled();
  });

  it('rechecks rate limits after reserving a request before calling the provider', async () => {
    const { ai, provider, service } = createHarness();
    ai.countRecentSummaryRequestsForWorkspace
      .mockResolvedValueOnce(19)
      .mockResolvedValueOnce(21);
    ai.countRecentSummaryRequestsForUserInWorkspace
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5);

    await expect(
      service.generateMeetingSummary(auth, { meetingId }, new Date(now)),
    ).rejects.toMatchObject({
      statusCode: 429,
      code: 'ai_summary_rate_limited',
    });
    expect(ai.createSummaryRequest).toHaveBeenCalled();
    expect(ai.markSummaryRequestFailed).toHaveBeenCalledWith(
      workspaceId,
      'request_1',
      now,
      'ai_summary_rate_limited',
    );
    expect(provider.generateMeetingSummary).not.toHaveBeenCalled();
  });

  it('blocks viewers before checking rate limits or loading meeting text', async () => {
    const { ai, meetings, provider, service } = createHarness();

    await expect(
      service.generateMeetingSummary(viewerAuth, { meetingId }, new Date(now)),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden',
    });
    expect(ai.countRecentSummaryRequestsForWorkspace).not.toHaveBeenCalled();
    expect(meetings.findMeetingByIdForWorkspace).not.toHaveBeenCalled();
    expect(provider.generateMeetingSummary).not.toHaveBeenCalled();
  });

  it('returns a safe unavailable error when AI is not configured', async () => {
    const { ai, meetings, service } = createHarness({ aiConfigured: false });

    await expect(
      service.generateMeetingSummary(auth, { meetingId }, new Date(now)),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'ai_provider_not_configured',
    });
    expect(ai.countRecentSummaryRequestsForWorkspace).not.toHaveBeenCalled();
    expect(meetings.findMeetingByIdForWorkspace).not.toHaveBeenCalled();
  });
});
