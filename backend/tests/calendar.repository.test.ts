import { describe, expect, it } from 'vitest';

import { CalendarRepository } from '../src/modules/calendar/calendar.repository.js';

class FakeCalendarEventsQuery {
  public selectedColumns: string | null = null;
  public singleCalled = false;

  constructor(private readonly row: Record<string, unknown>) {}

  select(columns: string) {
    this.selectedColumns = columns;
    return this;
  }

  single<T>() {
    this.singleCalled = true;
    return Promise.resolve({ data: this.row as T, error: null });
  }
}

class FakeSupabaseClient {
  public table: string | null = null;
  public upsertRow: Record<string, unknown> | null = null;
  public upsertOptions: { onConflict?: string } | null = null;
  public query: FakeCalendarEventsQuery | null = null;

  from(table: string) {
    this.table = table;

    return {
      upsert: (row: Record<string, unknown>, options: { onConflict?: string }) => {
        this.upsertRow = row;
        this.upsertOptions = options;
        this.query = new FakeCalendarEventsQuery({
          id: 'event-1',
          workspace_id: row.workspace_id,
          user_id: row.user_id,
          provider: row.provider,
          source_type: row.source_type,
          source_id: row.source_id,
          provider_event_id: row.provider_event_id,
          created_at: '2026-06-07T10:00:00.000Z',
          updated_at: '2026-06-07T10:00:00.000Z',
        });

        return this.query;
      },
    };
  }
}

describe('CalendarRepository', () => {
  it('atomically upserts calendar events by workspace, user, provider, source type, and source ID', async () => {
    const supabase = new FakeSupabaseClient();
    const repository = new CalendarRepository(
      supabase as unknown as ConstructorParameters<typeof CalendarRepository>[0],
    );

    const saved = await repository.upsertEvent({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      sourceType: 'task_due_date',
      sourceId: 'task-1',
      providerEventId: 'google-event-1',
    });

    expect(supabase.table).toBe('calendar_events');
    expect(supabase.upsertRow).toMatchObject({
      workspace_id: 'workspace-1',
      user_id: 'user-1',
      provider: 'google',
      source_type: 'task_due_date',
      source_id: 'task-1',
      provider_event_id: 'google-event-1',
    });
    expect(supabase.upsertOptions).toEqual({
      onConflict: 'workspace_id,user_id,provider,source_type,source_id',
    });
    expect(saved).toMatchObject({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      providerEventId: 'google-event-1',
    });
  });
});
