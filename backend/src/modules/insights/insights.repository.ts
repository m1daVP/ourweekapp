import { formatApiDateTime } from '../../shared/dates.js';
import type { JsonValue, SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { throwOnSupabaseError } from '../../shared/repositories/index.js';

const MEETING_COLUMNS = 'id,title,completed_at,sections' as const;
const TASK_COLUMNS = 'id,title,status,due_date,created_at,source_meeting_id' as const;
const AGREEMENT_COLUMNS = 'id,title,description,created_at,source_meeting_id' as const;
const FOLLOW_UP_COLUMNS = 'source_id,state,updated_at' as const;

type MeetingRow = {
  id: string;
  title: string;
  completed_at: string | null;
  sections: JsonValue;
};

type TaskRow = {
  id: string;
  title: string;
  status: 'open' | 'done' | 'skipped';
  due_date: string | null;
  created_at: string;
  source_meeting_id: string | null;
};

type AgreementRow = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  source_meeting_id: string;
};

type FollowUpRow = {
  source_id: string;
  state: 'open' | 'resolved' | 'snoozed' | 'carry_to_next_meeting';
  updated_at: string;
};

export type InsightMeetingRecord = {
  id: string;
  title: string;
  completedAt: string;
  sections: JsonValue;
};

export type InsightTaskRecord = {
  id: string;
  title: string;
  status: TaskRow['status'];
  dueDate: string | null;
  createdAt: string;
  sourceMeetingId: string | null;
};

export type InsightAgreementRecord = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  sourceMeetingId: string;
};

export type InsightFollowUpRecord = {
  sourceId: string;
  state: FollowUpRow['state'];
  updatedAt: string;
};

export type InsightSearchPage<T> = {
  data: T[];
  total: number;
};

function mapMeeting(row: MeetingRow): InsightMeetingRecord | null {
  if (!row.completed_at) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    completedAt: formatApiDateTime(row.completed_at),
    sections: row.sections,
  };
}

function mapTask(row: TaskRow): InsightTaskRecord {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    dueDate: row.due_date,
    createdAt: formatApiDateTime(row.created_at),
    sourceMeetingId: row.source_meeting_id,
  };
}

function mapAgreement(row: AgreementRow): InsightAgreementRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: formatApiDateTime(row.created_at),
    sourceMeetingId: row.source_meeting_id,
  };
}

function escapeSearchTerm(value: string) {
  return value.replace(/[%,_\\]/g, '\\$&').replace(/[(),]/g, ' ');
}

export class InsightsRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async listCompletedMeetingsForPeriod(
    workspaceId: string,
    rangeStart: string | null,
    rangeEnd: string,
    limit: number,
    offset: number,
  ) {
    let query = this.supabase
      .from('meetings')
      .select(MEETING_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .lt('completed_at', rangeEnd);

    if (rangeStart) {
      query = query.gte('completed_at', rangeStart);
    }

    const { data, error } = await query
      .order('completed_at', { ascending: true })
      .range(offset, offset + limit - 1)
      .returns<MeetingRow[]>();

    throwOnSupabaseError(error, 'insights_meeting_list_failed', 'Unable to load household insights.');

    return (data ?? []).map(mapMeeting).filter((value): value is InsightMeetingRecord => Boolean(value));
  }

  async listTasksCreatedInPeriod(
    workspaceId: string,
    rangeStart: string | null,
    rangeEnd: string,
    limit: number,
    offset: number,
  ) {
    let query = this.supabase
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .lt('created_at', rangeEnd);

    if (rangeStart) {
      query = query.gte('created_at', rangeStart);
    }

    const { data, error } = await query
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)
      .returns<TaskRow[]>();

    throwOnSupabaseError(error, 'insights_task_list_failed', 'Unable to load household insights.');

    return (data ?? []).map(mapTask);
  }

  async listAgreementsCreatedInPeriod(
    workspaceId: string,
    rangeStart: string | null,
    rangeEnd: string,
    limit: number,
    offset: number,
  ) {
    let query = this.supabase
      .from('agreements')
      .select(AGREEMENT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .lt('created_at', rangeEnd);

    if (rangeStart) {
      query = query.gte('created_at', rangeStart);
    }

    const { data, error } = await query
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)
      .returns<AgreementRow[]>();

    throwOnSupabaseError(error, 'insights_agreement_list_failed', 'Unable to load household insights.');

    return (data ?? []).map(mapAgreement);
  }

  async listAgreementFollowUps(workspaceId: string, agreementIds: string[]) {
    if (agreementIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('assistant_follow_ups')
      .select(FOLLOW_UP_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('source_type', 'agreement')
      .in('source_id', agreementIds)
      .order('updated_at', { ascending: false })
      .returns<FollowUpRow[]>();

    throwOnSupabaseError(error, 'insights_follow_up_list_failed', 'Unable to load household insights.');

    return (data ?? []).map((row) => ({
      sourceId: row.source_id,
      state: row.state,
      updatedAt: formatApiDateTime(row.updated_at),
    }));
  }

  async searchMeetings(workspaceId: string, search: string, limit: number, offset: number) {
    const pattern = `%${escapeSearchTerm(search)}%`;
    const { data, error, count } = await this.supabase
      .from('meetings')
      .select('id,title,completed_at', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .ilike('title', pattern)
      .order('completed_at', { ascending: false })
      .range(offset, offset + limit - 1)
      .returns<Array<Pick<MeetingRow, 'id' | 'title' | 'completed_at'>>>();

    throwOnSupabaseError(error, 'insights_meeting_search_failed', 'Unable to search household history.');

    return {
      data: (data ?? []).flatMap((row) => {
        const meeting = mapMeeting({ ...row, sections: [] });
        return meeting ? [meeting] : [];
      }),
      total: count ?? 0,
    } satisfies InsightSearchPage<InsightMeetingRecord>;
  }

  async searchTasks(workspaceId: string, search: string, limit: number, offset: number) {
    const pattern = `%${escapeSearchTerm(search)}%`;
    const { data, error, count } = await this.supabase
      .from('tasks')
      .select(TASK_COLUMNS, { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .ilike('title', pattern)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
      .returns<TaskRow[]>();

    throwOnSupabaseError(error, 'insights_task_search_failed', 'Unable to search household history.');

    return { data: (data ?? []).map(mapTask), total: count ?? 0 } satisfies InsightSearchPage<InsightTaskRecord>;
  }

  async searchAgreements(workspaceId: string, search: string, limit: number, offset: number) {
    const pattern = `%${escapeSearchTerm(search)}%`;
    const { data, error, count } = await this.supabase
      .from('agreements')
      .select(AGREEMENT_COLUMNS, { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
      .returns<AgreementRow[]>();

    throwOnSupabaseError(error, 'insights_agreement_search_failed', 'Unable to search household history.');

    return { data: (data ?? []).map(mapAgreement), total: count ?? 0 } satisfies InsightSearchPage<InsightAgreementRecord>;
  }
}
