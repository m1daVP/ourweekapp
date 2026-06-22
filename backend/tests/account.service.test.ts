import { describe, expect, it, vi } from 'vitest';

import { AccountService, sanitizeJsonForExport } from '../src/modules/account/account.service.js';
import type { AccountRepository } from '../src/modules/account/account.repository.js';
import type { AuthContext } from '../src/shared/auth/index.js';

const now = new Date('2026-06-07T12:00:00.000Z');

const ownerAuth: AuthContext = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  workspaceId: '33333333-3333-4333-8333-333333333333',
  role: 'owner',
  planType: 'premium',
};

function createRepository(overrides: Partial<Record<keyof AccountRepository, unknown>> = {}) {
  const repository = {
    findActiveUser: vi.fn(async () => ({
      id: ownerAuth.userId,
      email: 'rita@example.com',
      displayName: 'Rita',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })),
    listActiveMembershipsForUser: vi.fn(async () => [
      {
        workspaceId: ownerAuth.workspaceId,
        userId: ownerAuth.userId,
        displayName: 'Rita',
        email: 'rita@example.com',
        role: 'owner',
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]),
    findWorkspace: vi.fn(async () => ({
      id: ownerAuth.workspaceId,
      name: 'Home',
      ownerId: ownerAuth.userId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })),
    listMembersForWorkspace: vi.fn(async () => [
      {
        workspaceId: ownerAuth.workspaceId,
        userId: ownerAuth.userId,
        displayName: 'Rita',
        email: 'rita@example.com',
        role: 'owner',
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        workspaceId: ownerAuth.workspaceId,
        userId: '44444444-4444-4444-8444-444444444444',
        displayName: 'Alex',
        email: 'alex@example.com',
        role: 'adult_member',
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]),
    listParticipantsForWorkspace: vi.fn(async () => []),
    listMeetingsForWorkspace: vi.fn(async () => []),
    listTasksForWorkspace: vi.fn(async () => []),
    listAgreementsForWorkspace: vi.fn(async () => []),
    listReviewDecisionsForWorkspace: vi.fn(async () => []),
    findLatestSubscriptionForWorkspace: vi.fn(async () => null),
    listCalendarConnectionsForWorkspaceUser: vi.fn(async () => []),
    deleteAccountAtomically: vi.fn(async () => undefined),
    ...overrides,
  };

  return {
    repository,
    service: new AccountService(repository as unknown as AccountRepository),
  };
}

describe('AccountService export', () => {
  it('requires authenticated context', async () => {
    const { service } = createRepository();

    await expect(service.exportAccount(undefined, now)).rejects.toMatchObject({
      statusCode: 401,
      code: 'unauthenticated',
    });
  });

  it('removes private notes and unsafe keys from exported meeting JSON', async () => {
    const { repository, service } = createRepository({
      listMeetingsForWorkspace: vi.fn(async () => [
        {
          id: '55555555-5555-4555-8555-555555555555',
          workspaceId: ownerAuth.workspaceId,
          templateId: 'weekly-family-check-in',
          title: 'Weekly meeting',
          status: 'completed',
          participantIds: [],
          sections: [
            {
              id: 'intro',
              notes: [
                { id: 'public-note', text: 'Visible note' },
                { id: 'private-note', text: 'Hidden note', isPrivate: true },
              ],
              privateNote: { text: 'Hidden privateNote key' },
              privateNotes: [{ text: 'Hidden privateNotes key' }],
              reflection: { text: 'Hidden marker object', private: true },
              tasks: [],
              agreements: [],
              providerToken: 'leak',
              internalLogs: ['leak'],
            },
          ],
          currentSectionIndex: 0,
          aiSummary: { meetingId: '55555555-5555-4555-8555-555555555555', text: 'Summary', inputHash: 'leak' },
          serverRevision: 1,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          completedAt: now.toISOString(),
          deletedAt: null,
        },
      ]),
    });

    const result = await service.exportAccount(ownerAuth, now);
    const meeting = result.workspaces[0]?.meetings[0];
    const section = meeting?.sections[0] as Record<string, unknown>;

    expect(repository.listMeetingsForWorkspace).toHaveBeenCalledWith(ownerAuth.workspaceId);
    expect(section.notes).toEqual([{ id: 'public-note', text: 'Visible note' }]);
    expect(JSON.stringify(result)).not.toContain('Hidden note');
    expect(JSON.stringify(result)).not.toContain('Hidden privateNote key');
    expect(JSON.stringify(result)).not.toContain('Hidden privateNotes key');
    expect(JSON.stringify(result)).not.toContain('Hidden marker object');
    expect(JSON.stringify(result)).not.toContain('providerToken');
    expect(JSON.stringify(result)).not.toContain('internalLogs');
    expect(JSON.stringify(result)).not.toContain('inputHash');
  });

  it('sanitizes nested unsafe fields generically', () => {
    expect(
      sanitizeJsonForExport({
        text: 'ok',
        refreshToken: 'secret',
        nested: { passwordHash: 'secret', value: 'kept' },
        privateNote: { text: 'removed by key' },
        privateNotes: [{ text: 'removed by key' }],
        unrelatedPrivateObject: { text: 'removed by marker', type: 'private' },
        notes: [{ text: 'public' }, { text: 'private', visibility: 'private' }],
      }),
    ).toEqual({
      text: 'ok',
      nested: { value: 'kept' },
      notes: [{ text: 'public' }],
    });
  });
});

describe('AccountService deletion', () => {
  it('delegates account deletion to the transactional repository wrapper', async () => {
    const { repository, service } = createRepository();

    await service.deleteAccount(ownerAuth, now);

    expect(repository.deleteAccountAtomically).toHaveBeenCalledWith(ownerAuth.userId, now.toISOString());
  });

  it('requires authenticated context for deletion', async () => {
    const { repository, service } = createRepository();

    await expect(service.deleteAccount(undefined, now)).rejects.toMatchObject({
      statusCode: 401,
      code: 'unauthenticated',
    });
    expect(repository.deleteAccountAtomically).not.toHaveBeenCalled();
  });
});
