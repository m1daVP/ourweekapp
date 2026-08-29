import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { throwOnSupabaseError } from '../../shared/repositories/index.js';

import { FREE_RECAP_LIMIT } from '../billing/plan-limits.js';

export class AssistantRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async countUsedRecaps(workspaceId: string, periodEndsAt: string | null) {
    let query = this.supabase
      .from('assistant_recap_credit_reservations')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .in('state', ['reserved', 'settled']);

    query = periodEndsAt
      ? query.eq('allowance_period_ends_at', periodEndsAt)
      : query.is('allowance_period_ends_at', null);

    const { count, error } = await query;

    throwOnSupabaseError(
      error,
      'assistant_recap_credit_count_failed',
      'Unable to load AI recap credits.',
    );

    return count ?? 0;
  }

  async reserveRecap(workspaceId: string, requestId: string, periodEndsAt: string | null, limit: number) {
    const { data, error } = await this.supabase.rpc('reserve_assistant_recap_credit', {
      p_workspace_id: workspaceId,
      p_ai_summary_request_id: requestId,
      p_allowance_period_ends_at: periodEndsAt,
      p_limit: limit,
    });
    throwOnSupabaseError(error, 'assistant_recap_credit_reserve_failed', 'Unable to reserve an AI recap.');
    return data === true;
  }

  async settleRecap(workspaceId: string, requestId: string) {
    const { data, error } = await this.supabase.rpc('settle_assistant_recap_credit', {
      p_workspace_id: workspaceId, p_ai_summary_request_id: requestId,
    });
    throwOnSupabaseError(error, 'assistant_recap_credit_settle_failed', 'Unable to settle an AI recap.');
    return data === true;
  }

  async releaseRecap(workspaceId: string, requestId: string) {
    const { data, error } = await this.supabase.rpc('release_assistant_recap_credit', {
      p_workspace_id: workspaceId, p_ai_summary_request_id: requestId,
    });
    throwOnSupabaseError(error, 'assistant_recap_credit_release_failed', 'Unable to release an AI recap.');
    return data === true;
  }

  async getRemainingFreeRecapCredits(workspaceId: string) {
    const used = await this.countUsedRecaps(workspaceId, null);
    return Math.max(0, FREE_RECAP_LIMIT - used);
  }
}

export { FREE_RECAP_LIMIT };
