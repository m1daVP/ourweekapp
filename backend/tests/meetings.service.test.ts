import { describe, expect, it, vi } from 'vitest';

import { meetingSchema } from '../src/modules/meetings/meetings.schema.js';
import { MeetingsService } from '../src/modules/meetings/meetings.service.js';
import type { AuthContext } from '../src/shared/auth/index.js';
import type { MeetingDto as MeetingRepositoryDto } from '../src/modules/meetings/meetings.repository.js';
import type { MeetingDto } from '../src/modules/meetings/meetings.schema.js';

const now = '2026-06-06T10:00:00.000Z';
const future = '2026-07-06T10:00:00.000Z';
const meetingId = '11111111-1111-4111-8111-111111111111';
const activeMeetingId = '22222222-2222-4222-8222-222222222222';
const completedMeetingIds = [
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
] as const;

const auth = {
  userId: 'user_1',
  sessionId: 'session_1',
  workspaceId: 'workspace_1',
  role: 'owner',
  planType: 'free',
} satisfies AuthContext;

const viewerAuth = {
  ...auth,
  role: 'viewer',
} satisfies AuthContext;

const adultAuth = {
  ...auth,
  userId: 'adult_1',
  role: 'adult_member',
} satisfies AuthContext;

function apiMeeting(overrides: Partial<MeetingDto> = {}): MeetingDto {
  return {
    id: meetingId,
    templateId: 'weekly-family-check-in',
    title: 'Weekly check-in',
    status: 'draft',
    participantIds: ['participant_1'],
    sections: [
      {
        id: 'section_1',
        notes: [],
        tasks: [],
        agreements: [],
      },
    ],
    currentSectionIndex: 0,
    createdAt: '2026-06-06T09:00:00.000Z',
    updatedAt: '2026-06-06T09:00:00.000Z',
    serverRevision: 1,
    ...overrides,
  };
}

function repositoryMeeting(overrides: Partial<MeetingRepositoryDto> = {}): MeetingRepositoryDto {
  const meeting = apiMeeting(overrides as Partial<MeetingDto>);

  return {
    id: meeting.id,
    workspaceId: 'workspace_1',
    templateId: meeting.templateId,
    title: meeting.title,
    status: meeting.status,
    participantIds: meeting.participantIds,
    sections: meeting.sections,
    currentSectionIndex: meeting.currentSectionIndex,
    aiSummary: null,
    serverRevision: meeting.serverRevision ?? 1,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
    completedAt: meeting.completedAt ?? null,
    deletedAt: meeting.deletedAt ?? null,
    ...overrides,
  };
}

function createRepositories() {
  return {
    meetings: {
      listMeetingsForWorkspace: vi.fn(),
      listCompletedMeetingsForFreePlan: vi.fn().mockResolvedValue([]),
      listMeetingsByStatusesForWorkspace: vi.fn().mockResolvedValue([]),
      findMeetingByIdForWorkspace: vi.fn(),
      insertMeeting: vi.fn(),
      updateMeeting: vi.fn(),
      updateMeetingSummary: vi.fn(),
      softDeleteMeeting: vi.fn(),
    },
    participants: {
      listParticipantsForWorkspace: vi.fn().mockResolvedValue([
        { id: 'participant_1' },
        { id: 'participant_2' },
      ]),
    },
    subscriptions: {
      findCurrentSubscriptionForWorkspace: vi.fn().mockResolvedValue(null),
    },
  };
}

function trustedPremiumSubscription() {
  return {
    id: 'subscription_1',
    workspaceId: 'workspace_1',
    provider: 'revenuecat',
    planType: 'premium',
    status: 'active',
    expiresAt: future,
    lastCheckedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
describe('MeetingsService', () => {
  it('requires UUID-shaped meeting IDs', () => {
    expect(meetingSchema.safeParse(apiMeeting()).success).toBe(true);
    expect(meetingSchema.safeParse(apiMeeting({ id: 'meeting_1' })).success).toBe(false);
  });

  it('uses text for section agreements while tolerating legacy stored titles', () => {
    const parsed = meetingSchema.parse(apiMeeting({
      sections: [
        {
          id: 'section_1',
          notes: [],
          tasks: [],
          agreements: [
            {
              id: 'agreement_1',
              text: 'Alternate pickup',
              participantIds: ['participant_1'],
            },
          ],
        },
      ],
    }));
    const legacyParsed = meetingSchema.parse(apiMeeting({
      sections: [
        {
          id: 'section_1',
          notes: [],
          tasks: [],
          agreements: [
            {
              id: 'agreement_1',
              title: 'Legacy pickup agreement',
              participantIds: ['participant_1'],
            },
          ],
        },
      ],
    }));

    expect(parsed.sections[0]?.agreements[0]?.text).toBe('Alternate pickup');
    expect(legacyParsed.sections[0]?.agreements[0]).toEqual({
      id: 'agreement_1',
      text: 'Legacy pickup agreement',
      participantIds: ['participant_1'],
    });
  });

  it('limits free history to active meetings plus latest completed meetings', async () => {
    const repos = createRepositories();
    repos.subscriptions.findCurrentSubscriptionForWorkspace.mockResolvedValue(null);
    const active = repositoryMeeting({ id: activeMeetingId, status: 'in_progress' });
    const completed = [
      repositoryMeeting({ id: completedMeetingIds[0], status: 'completed', completedAt: '2026-06-06T08:00:00.000Z' }),
      repositoryMeeting({ id: completedMeetingIds[1], status: 'completed', completedAt: '2026-06-05T08:00:00.000Z' }),
      repositoryMeeting({ id: completedMeetingIds[2], status: 'completed', completedAt: '2026-06-04T08:00:00.000Z' }),
    ];
    repos.meetings.listMeetingsByStatusesForWorkspace.mockResolvedValue([active]);
    repos.meetings.listCompletedMeetingsForFreePlan.mockResolvedValue(completed);

    const service = new MeetingsService(repos.meetings, repos.participants, repos.subscriptions);
    const response = await service.listMeetings(auth, new Date(now));

    expect(repos.meetings.listCompletedMeetingsForFreePlan)
      .toHaveBeenCalledWith('workspace_1', 3);
    expect(response.meetings.map((meeting) => meeting.id).sort()).toEqual([
      activeMeetingId,
      ...completedMeetingIds,
    ].sort());
    expect(response.activeMeetingId).toBe(activeMeetingId);
  });

  it('uses limited history when auth plan is premium but entitlement is stale', async () => {
    const repos = createRepositories();
    const active = repositoryMeeting({ id: activeMeetingId, status: 'in_progress' });
    const completed = [
      repositoryMeeting({ id: completedMeetingIds[0], status: 'completed', completedAt: '2026-06-06T08:00:00.000Z' }),
      repositoryMeeting({ id: completedMeetingIds[1], status: 'completed', completedAt: '2026-06-05T08:00:00.000Z' }),
      repositoryMeeting({ id: completedMeetingIds[2], status: 'completed', completedAt: '2026-06-04T08:00:00.000Z' }),
    ];
    repos.subscriptions.findCurrentSubscriptionForWorkspace.mockResolvedValue({
      id: 'subscription_1',
      workspaceId: 'workspace_1',
      provider: 'revenuecat',
      planType: 'premium',
      status: 'active',
      expiresAt: future,
      lastCheckedAt: '2026-06-04T09:59:59.000Z',
      createdAt: now,
      updatedAt: now,
    });
    repos.meetings.listMeetingsByStatusesForWorkspace.mockResolvedValue([active]);
    repos.meetings.listCompletedMeetingsForFreePlan.mockResolvedValue(completed);

    const service = new MeetingsService(repos.meetings, repos.participants, repos.subscriptions);
    const response = await service.listMeetings(
      { ...auth, planType: 'premium' },
      new Date(now),
    );

    expect(repos.meetings.listMeetingsForWorkspace).not.toHaveBeenCalled();
    expect(repos.meetings.listCompletedMeetingsForFreePlan)
      .toHaveBeenCalledWith('workspace_1', 3);
    expect(response.meetings.map((meeting) => meeting.id).sort()).toEqual([
      activeMeetingId,
      ...completedMeetingIds,
    ].sort());
  });

  it('returns a conflict instead of overwriting concurrent meeting edits', async () => {
    const repos = createRepositories();
    const server = repositoryMeeting({
      serverRevision: 2,
      sections: [
        { id: 'section_1', notes: [{ id: 'note_1', text: 'server text' }], tasks: [], agreements: [] },
      ],
      updatedAt: '2026-06-06T09:30:00.000Z',
    });
    const client = apiMeeting({
      serverRevision: 1,
      sections: [
        { id: 'section_1', notes: [{ id: 'note_1', text: 'client text' }], tasks: [], agreements: [] },
      ],
      updatedAt: '2026-06-06T09:45:00.000Z',
    });
    repos.meetings.findMeetingByIdForWorkspace.mockResolvedValue(server);
    repos.meetings.listMeetingsByStatusesForWorkspace.mockResolvedValue([server]);

    const service = new MeetingsService(repos.meetings, repos.participants, repos.subscriptions);
    const response = await service.syncMeetings(auth, {
      meetings: [client],
      activeMeetingId: null,
      draftSavedAt: null,
      clientUpdatedAt: now,
      lastSyncedAt: '2026-06-06T09:15:00.000Z',
    }, new Date(now));

    expect(repos.meetings.updateMeeting).not.toHaveBeenCalled();
    expect(response.conflicts).toHaveLength(1);
    expect(response.conflicts[0]?.reason).toBe('updated_on_client_and_server');
    expect(response.conflicts[0]?.clientVersion?.sections[0]?.notes[0]?.text)
      .toBe('client text');
    expect(response.conflicts[0]?.serverVersion?.sections[0]?.notes[0]?.text)
      .toBe('server text');
  });

  it('conflicts omitted revisions when the server changed since last sync', async () => {
    const repos = createRepositories();
    const server = repositoryMeeting({
      serverRevision: 4,
      title: 'Server title',
      updatedAt: '2026-06-06T09:30:00.000Z',
    });
    const client = apiMeeting({
      title: 'Stale client title',
      updatedAt: '2026-06-06T09:10:00.000Z',
    });
    delete client.serverRevision;
    repos.meetings.findMeetingByIdForWorkspace.mockResolvedValue(server);
    repos.meetings.listMeetingsByStatusesForWorkspace.mockResolvedValue([server]);

    const service = new MeetingsService(repos.meetings, repos.participants, repos.subscriptions);
    const response = await service.syncMeetings(auth, {
      meetings: [client],
      activeMeetingId: null,
      draftSavedAt: null,
      clientUpdatedAt: now,
      lastSyncedAt: '2026-06-06T09:15:00.000Z',
    }, new Date(now));

    expect(repos.meetings.updateMeeting).not.toHaveBeenCalled();
    expect(response.conflicts).toEqual([
      expect.objectContaining({
        reason: 'updated_on_client_and_server',
        serverRevision: 4,
      }),
    ]);
    expect(response.conflicts[0]?.clientVersion?.title).toBe('Stale client title');
    expect(response.conflicts[0]?.serverVersion?.title).toBe('Server title');
  });

  it('increments serverRevision for accepted meeting updates', async () => {
    const repos = createRepositories();
    const server = repositoryMeeting({ serverRevision: 2, title: 'Old title' });
    const client = apiMeeting({ serverRevision: 2, title: 'New title' });
    const updated = repositoryMeeting({ serverRevision: 3, title: 'New title' });
    repos.meetings.findMeetingByIdForWorkspace.mockResolvedValue(server);
    repos.meetings.updateMeeting.mockResolvedValue(updated);
    repos.meetings.listMeetingsByStatusesForWorkspace.mockResolvedValue([updated]);

    const service = new MeetingsService(repos.meetings, repos.participants, repos.subscriptions);
    const response = await service.syncMeetings(auth, {
      meetings: [client],
      activeMeetingId: meetingId,
      draftSavedAt: now,
      clientUpdatedAt: now,
      lastSyncedAt: '2026-06-06T09:15:00.000Z',
    }, new Date(now));

    expect(repos.meetings.updateMeeting).toHaveBeenCalledWith(
      'workspace_1',
      meetingId,
      2,
      expect.objectContaining({ serverRevision: 3, title: 'New title' }),
    );
    expect(response.conflicts).toEqual([]);
    expect(response.meetings[0]?.serverRevision).toBe(3);
  });

  it('accepts the free weekly family check-in template during sync', async () => {
    const repos = createRepositories();
    const client = apiMeeting({
      templateId: 'weekly-family-check-in',
      status: 'completed',
      completedAt: now,
    });
    delete client.serverRevision;
    const created = repositoryMeeting({
      ...client,
      serverRevision: 1,
      completedAt: now,
    });
    repos.meetings.findMeetingByIdForWorkspace.mockResolvedValue(null);
    repos.meetings.insertMeeting.mockResolvedValue(created);
    repos.meetings.listCompletedMeetingsForFreePlan.mockResolvedValue([created]);

    const service = new MeetingsService(repos.meetings, repos.participants, repos.subscriptions);
    const response = await service.syncMeetings(auth, {
      meetings: [client],
      activeMeetingId: null,
      draftSavedAt: null,
      clientUpdatedAt: now,
    }, new Date(now));

    expect(repos.meetings.insertMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'weekly-family-check-in',
        workspaceId: 'workspace_1',
      }),
    );
    expect(response.conflicts).toEqual([]);
    expect(response.meetings[0]?.templateId).toBe('weekly-family-check-in');
  });

  it('rejects premium-only templates for free workspaces', async () => {
    const repos = createRepositories();
    const client = apiMeeting({
      templateId: 'couple-reset',
      status: 'completed',
      completedAt: now,
    });
    delete client.serverRevision;

    const service = new MeetingsService(repos.meetings, repos.participants, repos.subscriptions);
    const response = await service.syncMeetings(auth, {
      meetings: [client],
      activeMeetingId: null,
      draftSavedAt: null,
      clientUpdatedAt: now,
    }, new Date(now));

    expect(repos.meetings.insertMeeting).not.toHaveBeenCalled();
    expect(response.conflicts).toEqual([
      expect.objectContaining({
        resourceType: 'meeting',
        resourceId: meetingId,
        reason: 'invalid_reference',
      }),
    ]);
  });

  it('accepts premium-only templates for premium workspaces', async () => {
    const repos = createRepositories();
    const client = apiMeeting({
      templateId: 'busy-week-planning',
      status: 'completed',
      completedAt: now,
    });
    delete client.serverRevision;
    const created = repositoryMeeting({
      ...client,
      serverRevision: 1,
      completedAt: now,
    });
    repos.meetings.findMeetingByIdForWorkspace.mockResolvedValue(null);
    repos.meetings.insertMeeting.mockResolvedValue(created);
    repos.meetings.listMeetingsForWorkspace.mockResolvedValue([created]);
    repos.subscriptions.findCurrentSubscriptionForWorkspace.mockResolvedValue(
      trustedPremiumSubscription(),
    );

    const service = new MeetingsService(repos.meetings, repos.participants, repos.subscriptions);
    const response = await service.syncMeetings({ ...auth, planType: 'premium' }, {
      meetings: [client],
      activeMeetingId: null,
      draftSavedAt: null,
      clientUpdatedAt: now,
    }, new Date(now));

    expect(repos.meetings.insertMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'busy-week-planning',
        workspaceId: 'workspace_1',
      }),
    );
    expect(response.conflicts).toEqual([]);
    expect(response.meetings[0]?.templateId).toBe('busy-week-planning');
  });

  it('blocks viewers from syncing meetings', async () => {
    const repos = createRepositories();
    const service = new MeetingsService(repos.meetings, repos.participants, repos.subscriptions);

    await expect(service.syncMeetings(viewerAuth, {
      meetings: [apiMeeting()],
      activeMeetingId: null,
      draftSavedAt: null,
      clientUpdatedAt: now,
    }, new Date(now))).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden',
    });
    expect(repos.participants.listParticipantsForWorkspace).not.toHaveBeenCalled();
    expect(repos.meetings.updateMeeting).not.toHaveBeenCalled();
  });

  it('requires trusted workspace premium entitlement before saving summaries', async () => {
    const repos = createRepositories();
    repos.subscriptions.findCurrentSubscriptionForWorkspace.mockResolvedValue(null);
    const service = new MeetingsService(repos.meetings, repos.participants, repos.subscriptions);

    await expect(service.saveMeetingSummary(auth, meetingId, {
      id: 'summary_1',
      meetingId,
      shortSummary: 'Done',
      mainTopics: [],
      keyTensions: [],
      agreements: [],
      tasks: [],
      suggestedNextMeetingFocus: [],
      createdAt: now,
    }, new Date(now))).rejects.toMatchObject({
      statusCode: 403,
      code: 'premium_required',
    });
    expect(repos.subscriptions.findCurrentSubscriptionForWorkspace)
      .toHaveBeenCalledWith('workspace_1');
    expect(repos.meetings.findMeetingByIdForWorkspace).not.toHaveBeenCalled();
    expect(repos.meetings.updateMeetingSummary).not.toHaveBeenCalled();
  });

  it('allows adult members to save summaries when the workspace has premium', async () => {
    const repos = createRepositories();
    const summary = {
      id: 'summary_1',
      meetingId,
      shortSummary: 'Done',
      mainTopics: [],
      keyTensions: [],
      agreements: [],
      tasks: [],
      suggestedNextMeetingFocus: [],
      createdAt: now,
    };
    repos.subscriptions.findCurrentSubscriptionForWorkspace.mockResolvedValue(trustedPremiumSubscription());
    repos.meetings.findMeetingByIdForWorkspace.mockResolvedValue(
      repositoryMeeting({ participantIds: ['participant_1'] }),
    );
    repos.meetings.updateMeetingSummary.mockResolvedValue(
      repositoryMeeting({ aiSummary: summary }),
    );
    const service = new MeetingsService(repos.meetings, repos.participants, repos.subscriptions);

    const response = await service.saveMeetingSummary(
      { ...adultAuth, planType: 'free' },
      meetingId,
      summary,
      new Date(now),
    );

    expect(response.aiSummary?.shortSummary).toBe('Done');
    expect(repos.subscriptions.findCurrentSubscriptionForWorkspace)
      .toHaveBeenCalledWith('workspace_1');
    expect(repos.meetings.updateMeetingSummary).toHaveBeenCalled();
  });

  it('blocks viewers from saving meeting summaries', async () => {
    const repos = createRepositories();
    const service = new MeetingsService(repos.meetings, repos.participants, repos.subscriptions);

    await expect(service.saveMeetingSummary(viewerAuth, meetingId, {
      id: 'summary_1',
      meetingId,
      shortSummary: 'Done',
      mainTopics: [],
      keyTensions: [],
      agreements: [],
      tasks: [],
      suggestedNextMeetingFocus: [],
      createdAt: now,
    })).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden',
    });
    expect(repos.meetings.findMeetingByIdForWorkspace).not.toHaveBeenCalled();
    expect(repos.meetings.updateMeetingSummary).not.toHaveBeenCalled();
  });

  it('rejects summaries that reference participants outside the meeting', async () => {
    const repos = createRepositories();
    repos.subscriptions.findCurrentSubscriptionForWorkspace.mockResolvedValue(trustedPremiumSubscription());
    repos.meetings.findMeetingByIdForWorkspace.mockResolvedValue(
      repositoryMeeting({ participantIds: ['participant_1'] }),
    );
    const service = new MeetingsService(repos.meetings, repos.participants, repos.subscriptions);

    await expect(service.saveMeetingSummary(auth, meetingId, {
      id: 'summary_1',
      meetingId,
      shortSummary: 'Done',
      mainTopics: [],
      keyTensions: [],
      agreements: [],
      tasks: [{ title: 'Follow up', responsibleParticipantIds: ['participant_2'] }],
      suggestedNextMeetingFocus: [],
      createdAt: now,
    }, new Date(now))).rejects.toMatchObject({
      statusCode: 422,
      code: 'meeting_invalid_reference',
    });
    expect(repos.participants.listParticipantsForWorkspace).not.toHaveBeenCalled();
    expect(repos.meetings.updateMeetingSummary).not.toHaveBeenCalled();
  });
});






