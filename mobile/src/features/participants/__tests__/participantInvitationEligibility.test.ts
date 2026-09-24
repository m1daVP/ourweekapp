import { describe, expect, it } from 'vitest';
import {
  canOfferParticipantInvitation,
  canRevokeParticipantInvitation,
  shouldShowParticipantAccessStatus,
} from '@/features/participants/participantInvitationEligibility';
import type { Participant } from '@/features/participants/types';

const adult: Participant = {
  id: 'adult-1',
  name: 'Alex',
  initials: 'A',
  avatarColor: '#496a8f',
  type: 'adult',
  isActive: true,
  createdAt: '2026-08-12T08:00:00.000Z',
  updatedAt: '2026-08-12T08:00:00.000Z',
};

const eligibleInput = {
  participant: adult,
  isCurrentParticipant: false,
  canInviteMembers: true,
  accessStatus: 'none' as const,
};

describe('participant invitation eligibility', () => {
  it('never offers an invitation or access status for the current participant', () => {
    const input = { ...eligibleInput, isCurrentParticipant: true };

    expect(canOfferParticipantInvitation(input)).toBe(false);
    expect(
      shouldShowParticipantAccessStatus({ ...input, accessStatus: 'active' })
    ).toBe(false);
  });

  it('offers an invitation for another unlinked adult with permission', () => {
    expect(canOfferParticipantInvitation(eligibleInput)).toBe(true);
  });

  it('allows an unlinked child but rejects linked participants and users without permission', () => {
    expect(
      canOfferParticipantInvitation({
        ...eligibleInput,
        participant: { ...adult, type: 'child' },
      })
    ).toBe(true);
    expect(
      canOfferParticipantInvitation({
        ...eligibleInput,
        accessStatus: 'pending',
      })
    ).toBe(false);
    expect(
      canOfferParticipantInvitation({
        ...eligibleInput,
        canInviteMembers: false,
      })
    ).toBe(false);
  });

  it('shows access status only for another linked adult with permission', () => {
    expect(
      shouldShowParticipantAccessStatus({
        ...eligibleInput,
        accessStatus: 'pending',
      })
    ).toBe(true);
    expect(shouldShowParticipantAccessStatus(eligibleInput)).toBe(false);
  });

  it('allows revoking a resolved pending invitation for another adult', () => {
    expect(
      canRevokeParticipantInvitation({
        ...eligibleInput,
        accessStatus: 'pending',
        hasPendingInvitation: true,
      })
    ).toBe(true);
  });

  it('does not allow revoke without every pending invitation requirement', () => {
    const input = {
      ...eligibleInput,
      accessStatus: 'pending' as const,
      hasPendingInvitation: true,
    };

    expect(
      canRevokeParticipantInvitation({
        ...input,
        participant: { ...adult, type: 'child' },
      })
    ).toBe(true);
    expect(
      canRevokeParticipantInvitation({
        ...input,
        isCurrentParticipant: true,
      })
    ).toBe(false);
    expect(
      canRevokeParticipantInvitation({ ...input, canInviteMembers: false })
    ).toBe(false);
    expect(
      canRevokeParticipantInvitation({ ...input, accessStatus: 'active' })
    ).toBe(false);
    expect(
      canRevokeParticipantInvitation({
        ...input,
        hasPendingInvitation: false,
      })
    ).toBe(false);
  });
});
