import { describe, expect, it, vi } from 'vitest';

import { MeetingsRepository } from '../src/modules/meetings/meetings.repository.js';

function harness() {
  const query = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const client = { from: vi.fn().mockReturnValue(query) };
  const repository = new MeetingsRepository(
    client as unknown as ConstructorParameters<typeof MeetingsRepository>[0],
  );
  const lookup = vi.spyOn(repository, 'findMeetingByIdForWorkspace').mockResolvedValue(null);
  return { query, client, repository, lookup };
}

describe('meeting summary optimistic persistence', () => {
  it('uses the supplied source revision without reloading a newer one', async () => {
    const { query, repository, lookup } = harness();
    await repository.updateMeetingSummary('workspace-1', 'meeting-1', { text: 'summary' }, 3);
    expect(lookup).not.toHaveBeenCalled();
    expect(query.update).toHaveBeenCalledWith({ ai_summary: { text: 'summary' }, server_revision: 4 });
    expect(query.eq).toHaveBeenCalledWith('workspace_id', 'workspace-1');
    expect(query.eq).toHaveBeenCalledWith('id', 'meeting-1');
    expect(query.eq).toHaveBeenCalledWith('server_revision', 3);
    expect(query.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('returns null when the source revision no longer matches', async () => {
    const { repository } = harness();
    await expect(repository.updateMeetingSummary('workspace-1', 'meeting-1', {}, 3)).resolves.toBeNull();
  });

  it('preserves legacy lookup behavior when no source revision is supplied', async () => {
    const { repository, lookup, query } = harness();
    await expect(repository.updateMeetingSummary('workspace-1', 'meeting-1', {})).resolves.toBeNull();
    expect(lookup).toHaveBeenCalledWith('workspace-1', 'meeting-1');
    expect(query.update).not.toHaveBeenCalled();
  });
});
