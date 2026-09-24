import { describe, expect, it } from 'vitest';

import {
  createWorkspaceInvitationRequestSchema,
  createWorkspaceInvitationResponseSchema,
  updateWorkspaceMemberRequestSchema,
  workspaceSchema,
} from '../src/modules/workspace/workspace.schema.js';

const now = '2026-06-06T12:00:00.000Z';

describe('workspace schemas', () => {
  it('accepts only participant-scoped invitation inputs', () => {
    expect(createWorkspaceInvitationRequestSchema.safeParse({
      participantId: '11111111-1111-4111-8111-111111111111',
      email: 'alex@example.com',
    }).success).toBe(true);
    expect(createWorkspaceInvitationRequestSchema.safeParse({
      email: 'alex@example.com',
    }).success).toBe(false);
    expect(createWorkspaceInvitationRequestSchema.safeParse({
      participantId: '11111111-1111-4111-8111-111111111111',
      email: 'alex@example.com',
      role: 'owner',
    }).success).toBe(false);
  });

  it('requires at least one member update field', () => {
    expect(updateWorkspaceMemberRequestSchema.safeParse({}).success).toBe(false);
    expect(
      updateWorkspaceMemberRequestSchema.safeParse({ role: 'adult_member' }).success,
    ).toBe(true);
    expect(
      updateWorkspaceMemberRequestSchema.safeParse({ status: 'removed' }).success,
    ).toBe(true);
  });

  it('rejects unsupported member status transitions at the HTTP boundary', () => {
    expect(
      updateWorkspaceMemberRequestSchema.safeParse({ status: 'active' }).success,
    ).toBe(false);
    expect(
      updateWorkspaceMemberRequestSchema.safeParse({ status: 'invited' }).success,
    ).toBe(false);
  });

  it('keeps workspace DTOs camelCase and strips private member and invitation fields', () => {
    const parsed = workspaceSchema.parse({
      id: 'workspace-1',
      name: 'Our home',
      ownerId: 'user-1',
      members: [
        {
          userId: 'user-1',
          displayName: 'Rita',
          email: 'RITA@example.com',
          role: 'owner',
          status: 'active',
          passwordHash: 'secret',
        },
      ],
      invitations: [
        {
          invitationId: 'invitation-1',
          participantId: 'participant-1',
          email: 'ALEX@example.com',
          role: 'adult_member',
          status: 'pending',
          deliveryStatus: 'sent',
          createdAt: now,
          expiresAt: '2026-06-13T12:00:00.000Z',
          tokenHash: 'sha256:secret',
          userId: 'not-a-real-user',
        },
      ],
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    });

    expect(parsed.members[0]?.email).toBe('rita@example.com');
    expect(parsed.invitations[0]?.email).toBe('alex@example.com');
    expect(parsed).not.toHaveProperty('deletedAt');
    expect(parsed.members[0]).not.toHaveProperty('passwordHash');
    expect(parsed.invitations[0]).not.toHaveProperty('tokenHash');
    expect(parsed.invitations[0]).not.toHaveProperty('userId');
  });

  it('returns invitation IDs distinctly from user IDs and hides token hashes', () => {
    const parsed = createWorkspaceInvitationResponseSchema.parse({
      invitationId: 'invitation-1',
      participantId: 'participant-1',
      email: 'alex@example.com',
      role: 'adult_member',
      status: 'pending',
      deliveryStatus: 'sent',
      createdAt: now,
      expiresAt: '2026-06-13T12:00:00.000Z',
      tokenHash: 'sha256:secret',
      userId: 'not-a-real-user',
    });

    expect(parsed).toMatchObject({ invitationId: 'invitation-1' });
    expect(parsed).not.toHaveProperty('tokenHash');
    expect(parsed).not.toHaveProperty('userId');
  });
});
