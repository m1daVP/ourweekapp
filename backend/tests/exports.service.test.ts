import { describe, expect, it, vi } from 'vitest';

import { ExportsService } from '../src/modules/exports/exports.service.js';
import type { MeetingPdfDocument } from '../src/modules/exports/meeting-pdf.js';
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

function createHarness(input: {
  meeting?: MeetingDto | null;
  participantNames?: Array<{ id: string; name: string }>;
  renderPdf?: (document: MeetingPdfDocument) => Promise<Buffer>;
} = {}) {
  const repository = {
    findMeetingForExport: vi.fn().mockResolvedValue(
      input.meeting === undefined ? meeting() : input.meeting,
    ),
    listParticipantNamesForWorkspace: vi.fn().mockResolvedValue(
      input.participantNames ?? [{ id: 'participant_1', name: 'Rita' }],
    ),
  };
  const renderPdf = vi.fn(input.renderPdf ?? (async () => Buffer.from('%PDF-test')));
  const service = new ExportsService(repository, renderPdf);

  return { repository, renderPdf, service };
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

  it('builds a privacy-safe PDF using workspace-scoped participant names', async () => {
    const { repository, renderPdf, service } = createHarness({
      participantNames: [
        { id: 'participant_1', name: 'Rita' },
        { id: 'participant_2', name: 'Alex' },
      ],
    });

    const response = await service.exportMeetingPdf(auth, { meetingId }, new Date(now));

    expect(repository.listParticipantNamesForWorkspace).toHaveBeenCalledWith(
      workspaceId,
      ['participant_1'],
    );
    expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({
      sections: [expect.objectContaining({
        notes: [expect.objectContaining({ author: 'Rita' })],
        tasks: [expect.objectContaining({ responsible: 'Rita' })],
        agreements: [expect.objectContaining({ participants: 'Rita' })],
      })],
    }));
    expect(response.filename).toBe('ourweek-2026-06-07-weekly-check-in.pdf');
    expect(response.content.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('does not pass private note text or participant IDs to the PDF renderer', async () => {
    const { renderPdf, service } = createHarness();

    await service.exportMeetingPdf(auth, { meetingId }, new Date(now));

    const rendererInput = JSON.stringify(renderPdf.mock.calls);
    expect(rendererInput).not.toContain('private true text');
    expect(rendererInput).not.toContain('participant_1');
    expect(rendererInput).not.toContain('This must never leave the backend.');
  });

  it('blocks viewers before loading PDF content', async () => {
    const { repository, renderPdf, service } = createHarness();

    await expect(
      service.exportMeetingPdf(viewerAuth, { meetingId }, new Date(now)),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden',
    });
    expect(repository.findMeetingForExport).not.toHaveBeenCalled();
    expect(repository.listParticipantNamesForWorkspace).not.toHaveBeenCalled();
    expect(renderPdf).not.toHaveBeenCalled();
  });
});
