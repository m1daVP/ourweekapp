import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { throwOnSupabaseError } from '../../shared/repositories/index.js';

const FREE_RECAP_CREDIT_LIMIT = 3;

export class AssistantRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async countActiveRecapCreditsForWorkspace(workspaceId: string) {
    const { count, error } = await this.supabase
      .from('assistant_recap_credit_reservations')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .in('state', ['reserved', 'settled']);

    throwOnSupabaseError(
      error,
      'assistant_recap_credit_count_failed',
      'Unable to load AI recap credits.',
    );

    return count ?? 0;
  }

  async getRemainingFreeRecapCredits(workspaceId: string) {
    const activeCredits = await this.countActiveRecapCreditsForWorkspace(workspaceId);

    return Math.max(0, FREE_RECAP_CREDIT_LIMIT - activeCredits);
  }
}

export { FREE_RECAP_CREDIT_LIMIT };
