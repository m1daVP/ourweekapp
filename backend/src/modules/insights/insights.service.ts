import { requireMinimumRole, type AuthContext } from '../../shared/auth/index.js';
import type { JsonValue, SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import {
  InsightsRepository,
  type InsightAgreementRecord,
  type InsightFollowUpRecord,
  type InsightMeetingRecord,
} from './insights.repository.js';
import type {
  InsightsPeriodDto,
  InsightsQueryDto,
  InsightsResponseDto,
  InsightsSearchQueryDto,
  InsightsSearchResponseDto,
} from './insights.schema.js';

const PAGE_SIZE = 100;

type PeriodRange = {
  rangeStart: string | null;
  rangeEnd: string;
};

type InsightRepositoryPort = Pick<
  InsightsRepository,
  | 'listCompletedMeetingsForPeriod'
  | 'listTasksCreatedInPeriod'
  | 'listAgreementsCreatedInPeriod'
  | 'listAgreementFollowUps'
  | 'searchMeetings'
  | 'searchTasks'
  | 'searchAgreements'
>;

function jsonObject(value: JsonValue): Record<string, JsonValue> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value
    : null;
}

function sectionTitles(sections: JsonValue) {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections.flatMap((section) => {
    const object = jsonObject(section);
    const title = object?.title;
    return typeof title === 'string' ? [title] : [];
  });
}

function displayTopicTitle(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeRecurringTopic(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  return normalized || null;
}

function getPeriodRange(period: InsightsPeriodDto, now: Date): PeriodRange {
  const rangeEnd = now.toISOString();

  if (period === 'all') {
    return { rangeStart: null, rangeEnd };
  }

  const days = period === '4w' ? 28 : 84;

  return {
    rangeStart: new Date(now.getTime() - days * 86_400_000).toISOString(),
    rangeEnd,
  };
}

async function readAllPages<T>(
  readPage: (limit: number, offset: number) => Promise<T[]>,
) {
  const values: T[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await readPage(PAGE_SIZE, offset);
    values.push(...page);

    if (page.length < PAGE_SIZE) {
      return values;
    }
  }
}

function averageIntervalDays(meetings: InsightMeetingRecord[]) {
  if (meetings.length < 2) {
    return null;
  }

  const dates = meetings
    .map((meeting) => Date.parse(meeting.completedAt))
    .filter(Number.isFinite)
    .sort((first, second) => first - second);

  if (dates.length < 2) {
    return null;
  }

  let total = 0;

  for (let index = 1; index < dates.length; index += 1) {
    total += dates[index]! - dates[index - 1]!;
  }

  return total / (dates.length - 1) / 86_400_000;
}

function recurringTopics(meetings: InsightMeetingRecord[]) {
  const topics = new Map<string, { title: string; meetingIds: string[] }>();

  for (const meeting of meetings) {
    const normalizedTitles = new Set<string>();

    for (const title of sectionTitles(meeting.sections)) {
      const normalized = normalizeRecurringTopic(title);

      if (!normalized) {
        continue;
      }

      normalizedTitles.add(normalized);

      if (!topics.has(normalized)) {
        topics.set(normalized, { title: displayTopicTitle(title), meetingIds: [] });
      }
    }

    for (const title of normalizedTitles) {
      topics.get(title)?.meetingIds.push(meeting.id);
    }
  }

  return [...topics.values()]
    .filter((topic) => topic.meetingIds.length >= 2)
    .map((topic) => ({
      title: topic.title,
      meetingCount: topic.meetingIds.length,
      meetingIds: topic.meetingIds,
    }))
    .sort((first, second) =>
      second.meetingCount - first.meetingCount || first.title.localeCompare(second.title),
    );
}

function latestFollowUpByAgreement(followUps: InsightFollowUpRecord[]) {
  const byAgreement = new Map<string, InsightFollowUpRecord>();

  for (const followUp of followUps) {
    const previous = byAgreement.get(followUp.sourceId);

    if (!previous || Date.parse(followUp.updatedAt) > Date.parse(previous.updatedAt)) {
      byAgreement.set(followUp.sourceId, followUp);
    }
  }

  return byAgreement;
}

async function loadFollowUps(
  repository: InsightRepositoryPort,
  workspaceId: string,
  agreements: InsightAgreementRecord[],
) {
  const followUps: InsightFollowUpRecord[] = [];

  for (let offset = 0; offset < agreements.length; offset += PAGE_SIZE) {
    const agreementIds = agreements.slice(offset, offset + PAGE_SIZE).map((agreement) => agreement.id);
    followUps.push(...await repository.listAgreementFollowUps(workspaceId, agreementIds));
  }

  return followUps;
}

export class InsightsService {
  static fromSupabase(supabase: SupabaseRepositoryClient) {
    return new InsightsService(new InsightsRepository(supabase));
  }

  constructor(private readonly repository: InsightRepositoryPort) {}

  async getInsights(
    auth: AuthContext | undefined,
    query: InsightsQueryDto,
    now = new Date(),
  ): Promise<InsightsResponseDto> {
    const context = requireMinimumRole(auth, 'adult_member');
    const { rangeStart, rangeEnd } = getPeriodRange(query.period, now);
    const [meetings, tasks, agreements] = await Promise.all([
      readAllPages((limit, offset) => this.repository.listCompletedMeetingsForPeriod(
        context.workspaceId, rangeStart, rangeEnd, limit, offset,
      )),
      readAllPages((limit, offset) => this.repository.listTasksCreatedInPeriod(
        context.workspaceId, rangeStart, rangeEnd, limit, offset,
      )),
      readAllPages((limit, offset) => this.repository.listAgreementsCreatedInPeriod(
        context.workspaceId, rangeStart, rangeEnd, limit, offset,
      )),
    ]);
    const followUps = await loadFollowUps(this.repository, context.workspaceId, agreements);
    const latestFollowUps = latestFollowUpByAgreement(followUps);
    const currentDate = now.toISOString().slice(0, 10);
    const done = tasks.filter((task) => task.status === 'done').length;
    const open = tasks.filter((task) => task.status === 'open').length;
    const skipped = tasks.filter((task) => task.status === 'skipped').length;
    const overdue = tasks.filter(
      (task) => task.status === 'open' && task.dueDate !== null && task.dueDate < currentDate,
    ).length;
    const agreementFollowThrough = agreements.reduce(
      (counts, agreement) => {
        const followUp = latestFollowUps.get(agreement.id);

        if (!followUp) {
          counts.notTrackedYet += 1;
        } else if (followUp.state === 'resolved') {
          counts.resolved += 1;
        } else {
          counts.unresolved += 1;
        }

        return counts;
      },
      { resolved: 0, unresolved: 0, notTrackedYet: 0 },
    );

    return {
      period: query.period,
      rangeStart,
      rangeEnd,
      meetingConsistency: {
        completedMeetings: meetings.length,
        averageIntervalDays: averageIntervalDays(meetings),
      },
      taskFollowThrough: {
        done,
        open,
        skipped,
        overdue,
        completionRate: done + open === 0 ? null : done / (done + open),
      },
      agreementFollowThrough,
      recurringTopics: recurringTopics(meetings),
    };
  }

  async search(
    auth: AuthContext | undefined,
    query: InsightsSearchQueryDto,
  ): Promise<InsightsSearchResponseDto> {
    const context = requireMinimumRole(auth, 'adult_member');
    const [meetings, tasks, agreements] = await Promise.all([
      this.repository.searchMeetings(context.workspaceId, query.q, query.limit, query.offset),
      this.repository.searchTasks(context.workspaceId, query.q, query.limit, query.offset),
      this.repository.searchAgreements(context.workspaceId, query.q, query.limit, query.offset),
    ]);

    const toPagination = (total: number) => ({
      limit: query.limit,
      offset: query.offset,
      total,
      hasMore: query.offset + query.limit < total,
    });

    return {
      meetings: {
        data: meetings.data.map((meeting) => ({
          id: meeting.id,
          type: 'meeting' as const,
          title: meeting.title,
          occurredAt: meeting.completedAt,
          status: 'completed',
          sourceMeetingId: null,
        })),
        pagination: toPagination(meetings.total),
      },
      tasks: {
        data: tasks.data.map((task) => ({
          id: task.id,
          type: 'task' as const,
          title: task.title,
          occurredAt: task.createdAt,
          status: task.status,
          sourceMeetingId: task.sourceMeetingId,
        })),
        pagination: toPagination(tasks.total),
      },
      agreements: {
        data: agreements.data.map((agreement) => ({
          id: agreement.id,
          type: 'agreement' as const,
          title: agreement.title,
          occurredAt: agreement.createdAt,
          status: null,
          sourceMeetingId: agreement.sourceMeetingId,
        })),
        pagination: toPagination(agreements.total),
      },
    };
  }
}
