import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../src/shared/errors/index.js';
import type { AuthContext } from '../src/shared/auth/index.js';
import { createDefaultMeetingsService } from '../src/modules/meetings/meetings.service.js';
import { MeetingsRepository } from '../src/modules/meetings/meetings.repository.js';
import {
  listParticipantsWithSupabase,
} from '../src/modules/participants/participants.service.js';
import { ParticipantsRepository } from '../src/modules/participants/participants.repository.js';
import { createDefaultTasksService } from '../src/modules/tasks/tasks.service.js';
import { TasksRepository } from '../src/modules/tasks/tasks.repository.js';
import { WorkspaceService } from '../src/modules/workspace/workspace.service.js';
import { WorkspacesRepository } from '../src/modules/workspace/workspaces.repository.js';
import {
  cleanupDatabaseProofFixture,
  createDatabaseProofFixture,
  type DatabaseProofFixture,
  type DatabaseProofTracker,
} from './helpers/database-proof-fixtures.js';
import {
  createServiceRoleClient,
  databaseEnvironment,
} from './helpers/database-test-environment.js';

const describeConfigured = databaseEnvironment ? describe : describe.skip;

describeConfigured('workspace ownership database boundaries', () => {
  let fixture: DatabaseProofFixture;
  let tracker: DatabaseProofTracker | null = null;

  beforeEach(async () => {
    fixture = await createDatabaseProofFixture(databaseEnvironment!, {
      onProgress: (next) => { tracker = next; },
    });
  });

  afterEach(async () => {
    if (tracker) {
      await cleanupDatabaseProofFixture(databaseEnvironment!, tracker);
      tracker = null;
    }
  });

  function auth(): AuthContext {
    return {
      userId: fixture.userA.id,
      sessionId: fixture.userA.sessionId,
      workspaceId: fixture.workspaceA.id,
      role: 'owner',
      planType: 'premium',
    };
  }

  it('excludes the other workspace from real service lists and repository lookups', async () => {
    const client = createServiceRoleClient(databaseEnvironment!);
    const [meetings, participants, tasks] = await Promise.all([
      createDefaultMeetingsService(client).listMeetings(auth()),
      listParticipantsWithSupabase(client, { workspaceId: auth().workspaceId }),
      createDefaultTasksService(client).listTasks(auth()),
    ]);

    expect(meetings.meetings.map((row) => row.id)).not.toContain(fixture.workspaceB.meetingId);
    expect(participants.participants.map((row) => row.id)).not.toContain(
      fixture.workspaceB.participantId,
    );
    expect(tasks.tasks.map((row) => row.id)).not.toContain(fixture.workspaceB.taskId);
    expect(tasks.agreements.map((row) => row.id)).not.toContain(
      fixture.workspaceB.agreementId,
    );

    const meetingRepository = new MeetingsRepository(client);
    const participantRepository = new ParticipantsRepository(client);
    const taskRepository = new TasksRepository(client);
    await expect(meetingRepository.findMeetingByIdForWorkspace(
      fixture.workspaceA.id,
      fixture.workspaceB.meetingId,
    )).resolves.toBeNull();
    await expect(participantRepository.findParticipantByIdForWorkspace(
      fixture.workspaceA.id,
      fixture.workspaceB.participantId,
    )).resolves.toBeNull();
    await expect(taskRepository.findTaskByIdForWorkspace(
      fixture.workspaceA.id,
      fixture.workspaceB.taskId,
    )).resolves.toBeNull();
    await expect(taskRepository.findAgreementByIdForWorkspace(
      fixture.workspaceA.id,
      fixture.workspaceB.agreementId,
    )).resolves.toBeNull();
  });

  it('rejects cross-workspace revision updates and soft deletes without mutation', async () => {
    const client = createServiceRoleClient(databaseEnvironment!);
    const meetings = new MeetingsRepository(client);
    const participants = new ParticipantsRepository(client);
    const tasks = new TasksRepository(client);
    const before = await Promise.all([
      client.from('meetings').select('title,server_revision,deleted_at').eq('id', fixture.workspaceB.meetingId).single(),
      client.from('participants').select('name,server_revision,deleted_at,is_active').eq('id', fixture.workspaceB.participantId).single(),
      client.from('tasks').select('title,server_revision,deleted_at').eq('id', fixture.workspaceB.taskId).single(),
      client.from('agreements').select('title,server_revision,deleted_at').eq('id', fixture.workspaceB.agreementId).single(),
    ]);

    expect(await meetings.updateMeeting(
      fixture.workspaceA.id,
      fixture.workspaceB.meetingId,
      1,
      {
        templateId: 'weekly-family-check-in',
        title: 'denied',
        status: 'completed',
        participantIds: [],
        checkInCompleted: true,
        sections: [],
        currentSectionIndex: 0,
        completedAt: new Date().toISOString(),
      },
    )).toBeNull();
    expect(await meetings.softDeleteMeeting(
      fixture.workspaceA.id,
      fixture.workspaceB.meetingId,
      new Date().toISOString(),
      1,
    )).toBeNull();

    expect(await participants.updateParticipantIfRevisionMatches({
      id: fixture.workspaceB.participantId,
      workspaceId: fixture.workspaceA.id,
      name: 'denied',
      initials: 'DN',
      avatarColor: '#000000',
      avatarType: 'adult',
      type: 'adult',
      isActive: true,
      expectedServerRevision: 1,
    })).toBeNull();
    expect(await participants.softDeleteParticipantIfRevisionMatches(
      fixture.workspaceA.id,
      fixture.workspaceB.participantId,
      1,
      new Date().toISOString(),
    )).toBeNull();

    expect(await tasks.updateTaskIfRevisionMatches({
      id: fixture.workspaceB.taskId,
      workspaceId: fixture.workspaceA.id,
      title: 'denied',
      description: null,
      responsibilityType: 'shared',
      responsibleParticipantIds: [],
      responsibleUserIds: [],
      dueDate: null,
      status: 'open',
      sourceMeetingId: null,
      expectedServerRevision: 1,
    })).toBeNull();
    expect(await tasks.softDeleteTaskIfRevisionMatches(
      fixture.workspaceA.id,
      fixture.workspaceB.taskId,
      1,
      new Date().toISOString(),
    )).toBeNull();

    expect(await tasks.updateAgreementIfRevisionMatches({
      id: fixture.workspaceB.agreementId,
      workspaceId: fixture.workspaceA.id,
      title: 'denied',
      description: null,
      participantIds: [],
      relatedTaskIds: [],
      sourceMeetingId: fixture.workspaceA.meetingId,
      expectedServerRevision: 1,
    })).toBeNull();
    expect(await tasks.softDeleteAgreementIfRevisionMatches(
      fixture.workspaceA.id,
      fixture.workspaceB.agreementId,
      1,
      new Date().toISOString(),
    )).toBeNull();

    const after = await Promise.all([
      client.from('meetings').select('title,server_revision,deleted_at').eq('id', fixture.workspaceB.meetingId).single(),
      client.from('participants').select('name,server_revision,deleted_at,is_active').eq('id', fixture.workspaceB.participantId).single(),
      client.from('tasks').select('title,server_revision,deleted_at').eq('id', fixture.workspaceB.taskId).single(),
      client.from('agreements').select('title,server_revision,deleted_at').eq('id', fixture.workspaceB.agreementId).single(),
    ]);
    expect(after.map((result) => result.data)).toEqual(before.map((result) => result.data));
  });

  it('rejects cross-workspace membership and invitation mutations', async () => {
    const client = createServiceRoleClient(databaseEnvironment!);
    const service = new WorkspaceService(
      new WorkspacesRepository(client),
      vi.fn().mockResolvedValue(undefined),
      () => 'https://example.invalid/invitation',
    );
    const membershipBefore = await client
      .from('workspace_members')
      .select('role,status,created_at,updated_at')
      .eq('workspace_id', fixture.workspaceB.id)
      .eq('user_id', fixture.userB.id)
      .single();
    const invitationBefore = await client
      .from('workspace_invitations')
      .select('status,token_hash,delivery_status,delivery_attempted_at,delivery_sent_at,expires_at')
      .eq('id', fixture.workspaceB.invitationId)
      .single();

    await expect(service.updateMember(auth(), fixture.userB.id, {
      role: 'adult_member',
    })).rejects.toMatchObject<ApiError>({ code: 'workspace_member_not_found' });
    await expect(service.removeMember(auth(), fixture.userB.id))
      .rejects.toMatchObject<ApiError>({ code: 'workspace_member_not_found' });
    await expect(service.revokeInvitation(auth(), fixture.workspaceB.invitationId))
      .rejects.toMatchObject<ApiError>({ code: 'workspace_invitation_not_found' });
    await expect(service.resendInvitation(auth(), fixture.workspaceB.invitationId))
      .rejects.toMatchObject<ApiError>({ code: 'workspace_invitation_not_found' });

    const [membershipAfter, invitationAfter] = await Promise.all([
      client.from('workspace_members')
        .select('role,status,created_at,updated_at')
        .eq('workspace_id', fixture.workspaceB.id)
        .eq('user_id', fixture.userB.id)
        .single(),
      client.from('workspace_invitations')
        .select('status,token_hash,delivery_status,delivery_attempted_at,delivery_sent_at,expires_at')
        .eq('id', fixture.workspaceB.invitationId)
        .single(),
    ]);
    expect(membershipAfter.data).toEqual(membershipBefore.data);
    expect(invitationAfter.data).toEqual(invitationBefore.data);
  });
});
