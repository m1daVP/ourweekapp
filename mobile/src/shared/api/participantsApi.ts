import { apiRequest } from '@/shared/api/httpClient';
import type { ParticipantDto } from '@/shared/api/syncDtos';

interface ListParticipantsResponseDto {
  participants: ParticipantDto[];
}

export async function listParticipants() {
  const response = await apiRequest<ListParticipantsResponseDto>(
    '/participants/',
    { requiresAuth: true }
  );

  return {
    participants: Array.isArray(response.participants)
      ? response.participants
      : [],
  };
}
