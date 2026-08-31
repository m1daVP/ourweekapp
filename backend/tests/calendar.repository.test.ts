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

class FakeCalendarEventCleanupQuery {
  public selectedColumns: string | null = null;
  public deleted = false;
  public filters: Array<{ method: 'eq' | 'in'; column: string; value: unknown }> = [];

  select(columns: string) {
    this.selectedColumns = columns;
    return this;
  }

  delete() {
    this.deleted = true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ method: 'eq', column, value });
    return this;
  }

  in(column: string, value: unknown) {
    this.filters.push({ method: 'in', column, value });
    return Promise.resolve({
      data: this.deleted ? null : [{
        id: 'event-1',
        workspace_id: 'workspace-1',
        user_id: 'user-1',
        provider: 'google',
        source_type: 'weekly_meeting',
        source_id: 'personal-weekly-meeting',
        provider_event_id: 'google-event-1',
        created_at: '2026-06-07T10:00:00.000Z',
        updated_at: '2026-06-07T10:00:00.000Z',
      }],
      error: null,
    });
  }
}

class FakeCalendarEventCleanupClient {
  public query = new FakeCalendarEventCleanupQuery();

  from(table: string) {
    expect(table).toBe('calendar_events');
    return this.query;
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

  it('lists calendar mappings only for the requested user and source types', async () => {
    const supabase = new FakeCalendarEventCleanupClient();
    const repository = new CalendarRepository(
      supabase as unknown as ConstructorParameters<typeof CalendarRepository>[0],
    );

    const events = await repository.listEventsForUserBySourceTypes(
      'workspace-1',
      'user-1',
      ['weekly_meeting', 'task_due_date'],
    );

    expect(supabase.query.selectedColumns).toContain('provider_event_id');
    expect(supabase.query.filters).toEqual([
      { method: 'eq', column: 'workspace_id', value: 'workspace-1' },
      { method: 'eq', column: 'user_id', value: 'user-1' },
      { method: 'eq', column: 'provider', value: 'google' },
      {
        method: 'in',
        column: 'source_type',
        value: ['weekly_meeting', 'task_due_date'],
      },
    ]);
    expect(events).toMatchObject([{ providerEventId: 'google-event-1' }]);
  });

  it('clears calendar mappings only for the requested user and source types', async () => {
    const supabase = new FakeCalendarEventCleanupClient();
    const repository = new CalendarRepository(
      supabase as unknown as ConstructorParameters<typeof CalendarRepository>[0],
    );

    await repository.clearEventMappingsForUserBySourceTypes(
      'workspace-1',
      'user-1',
      ['task_due_date'],
    );

    expect(supabase.query.deleted).toBe(true);
    expect(supabase.query.filters).toEqual([
      { method: 'eq', column: 'workspace_id', value: 'workspace-1' },
      { method: 'eq', column: 'user_id', value: 'user-1' },
      { method: 'eq', column: 'provider', value: 'google' },
      { method: 'in', column: 'source_type', value: ['task_due_date'] },
    ]);
  });
});
