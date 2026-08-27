import type { Participant } from '@/features/participants/types';
import type { ParticipantAccessStatus } from '@/features/workspace/types';

interface ParticipantInvitationEligibilityInput {
  participant: Participant | null;
  isCurrentParticipant: boolean;
  canInviteMembers: boolean;
  accessStatus: ParticipantAccessStatus;
}

export function canOfferParticipantInvitation({
  participant,
  isCurrentParticipant,
  canInviteMembers,
  accessStatus,
}: ParticipantInvitationEligibilityInput) {
  return Boolean(
    participant &&
    !isCurrentParticipant &&
    canInviteMembers &&
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
