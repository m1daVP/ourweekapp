import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { MeetingsRepository } from '../meetings/meetings.repository.js';
import { ParticipantsRepository } from '../participants/participants.repository.js';

export class ExportsRepository {
  private readonly meetingsRepository: MeetingsRepository;
  private readonly participantsRepository: ParticipantsRepository;

  constructor(supabase: SupabaseRepositoryClient) {
    this.meetingsRepository = new MeetingsRepository(supabase);
    this.participantsRepository = new ParticipantsRepository(supabase);
  }

  async findMeetingForExport(workspaceId: string, meetingId: string) {
    return this.meetingsRepository.findMeetingByIdForWorkspace(
      workspaceId,
      meetingId,
    );
  }

  async listParticipantNamesForWorkspace(
    workspaceId: string,
    participantIds: string[],
  ) {
    return this.participantsRepository.listParticipantNamesForWorkspace(
      workspaceId,
      participantIds,
    );
  }
}
