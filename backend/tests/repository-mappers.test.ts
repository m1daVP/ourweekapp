import { describe, expect, it } from 'vitest';

import { mapAiSummaryRequestRowToDto } from '../src/modules/ai/ai.repository.js';
import { mapUserRowToPublicUserDto } from '../src/modules/auth/users.repository.js';
import { mapCalendarConnectionRowToDto } from '../src/modules/calendar/calendar.repository.js';
import { mapMeetingRowToDto } from '../src/modules/meetings/meetings.repository.js';
import { mapTaskRowToDto } from '../src/modules/tasks/tasks.repository.js';
import { mapWorkspaceRowToDto } from '../src/modules/workspace/workspaces.repository.js';

describe('repository mappers', () => {
  it('maps users to public DTOs without password hashes or soft-delete metadata', () => {
    const row = {
      id: 'user-1',
      email: 'Ada@example.com',
      email_normalized: 'ada@example.com',
      display_name: 'Ada',
      password_hash: 'secret-hash',
      created_at: '2026-06-05T12:00:00.000+02:00',
      updated_at: '2026-06-05T13:00:00.000+02:00',
      deleted_at: null,
    };

    const dto = mapUserRowToPublicUserDto(row);

    expect(dto).toEqual({
      id: 'user-1',
      email: 'Ada@example.com',
      emailNormalized: 'ada@example.com',
      displayName: 'Ada',
      createdAt: '2026-06-05T10:00:00.000Z',
      updatedAt: '2026-06-05T11:00:00.000Z',
    });
    expect(dto).not.toHaveProperty('passwordHash');
    expect(dto).not.toHaveProperty('password_hash');
    expect(dto).not.toHaveProperty('deletedAt');
  });

  it('maps calendar connections without encrypted provider tokens', () => {
    const row = {
      id: 'connection-1',
      workspace_id: 'workspace-1',
      user_id: 'user-1',
      provider: 'google' as const,
      connected_account_email: 'ada@example.com',
      access_token_encrypted: 'encrypted-access-token',
      refresh_token_encrypted: 'encrypted-refresh-token',
      token_expires_at: '2026-06-05T14:00:00.000+02:00',
      state: 'connected' as const,
      created_at: '2026-06-05T12:00:00.000+02:00',
      updated_at: '2026-06-05T13:00:00.000+02:00',
      disconnected_at: null,
    };

    const dto = mapCalendarConnectionRowToDto(row);

    expect(dto).toMatchObject({
      id: 'connection-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      connectedAccountEmail: 'ada@example.com',
      tokenExpiresAt: '2026-06-05T12:00:00.000Z',
      state: 'connected',
    });
    expect(dto).not.toHaveProperty('accessTokenEncrypted');
    expect(dto).not.toHaveProperty('refreshTokenEncrypted');
    expect(dto).not.toHaveProperty('access_token_encrypted');
    expect(dto).not.toHaveProperty('refresh_token_encrypted');
  });

  it('maps AI summary requests without input hashes', () => {
    const row = {
      id: 'request-1',
      workspace_id: 'workspace-1',
      user_id: 'user-1',
      meeting_id: 'meeting-1',
      provider: 'openai',
      status: 'completed',
      input_hash: 'private-input-hash',
      created_at: '2026-06-05T12:00:00.000+02:00',
      completed_at: '2026-06-05T12:01:00.000+02:00',
      error_code: null,
    };

    const dto = mapAiSummaryRequestRowToDto(row);

    expect(dto).toEqual({
      id: 'request-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      meetingId: 'meeting-1',
      provider: 'openai',
      status: 'completed',
      createdAt: '2026-06-05T10:00:00.000Z',
      completedAt: '2026-06-05T10:01:00.000Z',
      errorCode: null,
    });
    expect(dto).not.toHaveProperty('inputHash');
    expect(dto).not.toHaveProperty('input_hash');
  });

  it('maps JSON arrays to meeting and task camelCase DTO fields', () => {
    const meeting = mapMeetingRowToDto({
      id: 'meeting-1',
      workspace_id: 'workspace-1',
      template_id: 'weekly',
      title: 'Weekly check-in',
      status: 'completed',
      participant_ids: ['participant-1', 'participant-2'],
      sections: [{ title: 'Wins' }],
      current_section_index: 1,
      ai_summary: { summary: 'Done' },
      server_revision: 3,
      created_at: '2026-06-05T12:00:00.000+02:00',
      updated_at: '2026-06-05T13:00:00.000+02:00',
      completed_at: '2026-06-05T13:00:00.000+02:00',
      deleted_at: null,
    });

    const task = mapTaskRowToDto({
      id: 'task-1',
      workspace_id: 'workspace-1',
      title: 'Buy groceries',
      description: null,
      responsibility_type: 'participant',
      responsible_participant_ids: ['participant-1'],
      due_date: '2026-06-06',
      status: 'open',
      source_meeting_id: 'meeting-1',
      server_revision: 2,
      created_at: '2026-06-05T12:00:00.000+02:00',
      updated_at: '2026-06-05T13:00:00.000+02:00',
      deleted_at: null,
    });

    expect(meeting.participantIds).toEqual(['participant-1', 'participant-2']);
    expect(meeting.templateId).toBe('weekly');
    expect(meeting.currentSectionIndex).toBe(1);
    expect(task.responsibilityType).toBe('participant');
    expect(task.responsibleParticipantIds).toEqual(['participant-1']);
    expect(task.sourceMeetingId).toBe('meeting-1');
    expect(meeting.createdAt).toBe('2026-06-05T10:00:00.000Z');
    expect(meeting.updatedAt).toBe('2026-06-05T11:00:00.000Z');
    expect(meeting.completedAt).toBe('2026-06-05T11:00:00.000Z');
    expect(task.createdAt).toBe('2026-06-05T10:00:00.000Z');
    expect(task.updatedAt).toBe('2026-06-05T11:00:00.000Z');
  });

  it('normalizes workspace offset timestamps to API datetimes', () => {
    const dto = mapWorkspaceRowToDto({
      id: 'workspace-1',
      name: 'Family',
      owner_id: 'user-1',
      created_at: '2026-06-11T17:16:13.351+02:00',
      updated_at: '2026-06-11T17:17:13.351+02:00',
    });

    expect(dto.createdAt).toBe('2026-06-11T15:16:13.351Z');
    expect(dto.updatedAt).toBe('2026-06-11T15:17:13.351Z');
  });
});
