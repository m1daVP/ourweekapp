import type { Participant } from '@/features/participants/types';
import type { ParticipantAccessStatus } from '@/features/workspace/types';

interface ParticipantInvitationEligibilityInput {
  participant: Participant | null;
  isCurrentParticipant: boolean;
  canInviteMembers: boolean;
  accessStatus: ParticipantAccessStatus;
  activeMemberCount?: number;
  memberLimit?: number;
}

export function canOfferParticipantInvitation({
  participant,
  isCurrentParticipant,
  canInviteMembers,
  accessStatus,
  activeMemberCount = 0,
  memberLimit = Number.POSITIVE_INFINITY,
}: ParticipantInvitationEligibilityInput) {
  return Boolean(
    participant &&
    !isCurrentParticipant &&
    canInviteMembers &&
    activeMemberCount < memberLimit &&
    accessStatus === 'none'
  );
}

export function shouldShowParticipantAccessStatus({
  participant,
  isCurrentParticipant,
  canInviteMembers,
  accessStatus,
}: ParticipantInvitationEligibilityInput) {
  return Boolean(
    participant &&
    !isCurrentParticipant &&
    canInviteMembers &&
    accessStatus !== 'none'
  );
}

export function canRevokeParticipantInvitation({
  participant,
  isCurrentParticipant,
  canInviteMembers,
  accessStatus,
  hasPendingInvitation,
}: ParticipantInvitationEligibilityInput & {
  hasPendingInvitation: boolean;
}) {
  return Boolean(
    participant &&
    !isCurrentParticipant &&
    canInviteMembers &&
    accessStatus === 'pending' &&
    hasPendingInvitation
  );
}
