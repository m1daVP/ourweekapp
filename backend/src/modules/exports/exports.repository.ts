import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { MeetingsRepository } from '../meetings/meetings.repository.js';

export class ExportsRepository {
  private readonly meetingsRepository: MeetingsRepository;

  constructor(supabase: SupabaseRepositoryClient) {
    this.meetingsRepository = new MeetingsRepository(supabase);
  }

  async findMeetingForExport(workspaceId: string, meetingId: string) {
    return this.meetingsRepository.findMeetingByIdForWorkspace(
      workspaceId,
      meetingId,
    );
  }
}
