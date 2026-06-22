import { describe, expect, it, vi } from 'vitest';

import { ExportsService } from '../src/modules/exports/exports.service.js';
import type { MeetingDto } from '../src/modules/meetings/meetings.repository.js';
import type { AuthContext } from '../src/shared/auth/index.js';

const now = '2026-06-07T12:00:00.000Z';
const meetingId = '11111111-1111-4111-8111-111111111111';
const workspaceId = '22222222-2222-4222-8222-222222222222';

const auth: AuthContext = {
  userId: '33333333-3333-4333-8333-333333333333',
  sessionId: '44444444-4444-4444-8444-444444444444',
  workspaceId,
  role: 'adult_member',
  planType: 'premium',
};

const viewerAuth: AuthContext = {
  ...auth,
  role: 'viewer',
};

function meeting(overrides: Partial<MeetingDto> = {}): MeetingDto {
  return {
    id: meetingId,
    workspaceId,
    templateId: 'weekly-family-check-in',
    title: 'Weekly check-in',
    status: 'completed',
    participantIds: ['participant_1'],
    sections: [
      {
        id: 'section_1',
        title: 'Planning',
        prompt: 'What needs attention?',
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
            description: 'Call before Friday.',
            responsibleParticipantIds: ['participant_1'],
            dueDate: '2026-06-12',
            status: 'open',
          },
        ],
        agreements: [
          {
            text: 'Alternate pickup',
            description: 'Take turns each week.',
            participantIds: ['participant_1'],
          },
        ],
      },
    ],
    currentSectionIndex: 0,
    aiSummary: null,
    serverRevision: 1,
    createdAt: '2026-06-07T10:00:00.000Z',
    updatedAt: '2026-06-07T11:00:00.000Z',
    completedAt: '2026-06-07T11:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

function createHarness(input: { meeting?: MeetingDto | null } = {}) {
  const repository = {
    findMeetingForExport: vi.fn().mockResolvedValue(
      input.meeting === undefined ? meeting() : input.meeting,
    ),
  };
  const service = new ExportsService(repository);

  return { repository, service };
}

describe('ExportsService', () => {
  it('exports a workspace-owned meeting as markdown', async () => {
    const { repository, service } = createHarness();
    const response = await service.exportMeeting(
      auth,
      { meetingId, format: 'markdown' },
      new Date(now),
    );

    expect(repository.findMeetingForExport).toHaveBeenCalledWith(
      workspaceId,
      meetingId,
    );
    expect(response).toMatchObject({
      meetingId,
      format: 'markdown',
      contentType: 'text/markdown',
      generatedAt: now,
    });
    expect(response.filename).toBe(
      'weekly-check-in-11111111-1111-4111-8111-111111111111.md',
    );
    expect(response.content).toContain('# Weekly check-in');
    expect(response.content).toContain('### Notes');
    expect(response.content).toContain('We agreed to split school pickup.');
    expect(response.content).toContain('Book dentist');
    expect(response.content).toContain('Alternate pickup');
  });

  it('exports plain text when requested', async () => {
    const { service } = createHarness();
    const response = await service.exportMeeting(
      auth,
      { meetingId, format: 'text' },
      new Date(now),
    );

    expect(response.format).toBe('text');
    expect(response.contentType).toBe('text/plain');
    expect(response.filename).toBe(
      'weekly-check-in-11111111-1111-4111-8111-111111111111.txt',
    );
    expect(response.content).toContain('* [participant_1] We agreed');
  });

  it('excludes private notes and private-note fields from export content', async () => {
    const { service } = createHarness();
    const response = await service.exportMeeting(
      auth,
      { meetingId, format: 'markdown' },
      new Date(now),
    );

    expect(response.content).toContain('We agreed to split school pickup.');
    expect(response.content).not.toContain('This must never leave the backend.');
    expect(response.content).not.toContain('Do not include me.');
    expect(response.content).not.toContain('private true text');
    expect(response.content).not.toContain('isPrivate true text');
    expect(response.content).not.toContain('private visibility text');
    expect(response.content).not.toContain('private type text');
    expect(response.content).not.toContain('privateNotes');
  });

  it('requires the meeting to belong to the authenticated workspace', async () => {
    const { repository, service } = createHarness({ meeting: null });

    await expect(
      service.exportMeeting(auth, { meetingId, format: 'markdown' }, new Date(now)),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'meeting_not_found',
    });
    expect(repository.findMeetingForExport).toHaveBeenCalledWith(
      workspaceId,
      meetingId,
    );
  });

  it('blocks viewers before loading meeting content', async () => {
    const { repository, service } = createHarness();

    await expect(
      service.exportMeeting(
        viewerAuth,
        { meetingId, format: 'markdown' },
        new Date(now),
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden',
    });
    expect(repository.findMeetingForExport).not.toHaveBeenCalled();
  });
});
