export type InsightsPeriod = '4w' | '12w' | 'all';

export interface MeetingConsistencyInsight {
  completedMeetings: number;
  averageIntervalDays: number | null;
}

export interface TaskFollowThroughInsight {
  done: number;
  open: number;
  skipped: number;
  overdue: number;
  completionRate: number | null;
}

export interface AgreementFollowThroughInsight {
  resolved: number;
  unresolved: number;
  notTrackedYet: number;
}

export interface RecurringTopicInsight {
  title: string;
  meetingCount: number;
  meetingIds: string[];
}

export interface HouseholdInsightsResponse {
  period: InsightsPeriod;
  rangeStart: string | null;
  rangeEnd: string;
  meetingConsistency: MeetingConsistencyInsight;
  taskFollowThrough: TaskFollowThroughInsight;
  agreementFollowThrough: AgreementFollowThroughInsight;
  recurringTopics: RecurringTopicInsight[];
}

export type InsightSearchItemType = 'meeting' | 'task' | 'agreement';

export interface InsightSearchItem {
  id: string;
  type: InsightSearchItemType;
  title: string;
  occurredAt: string | null;
  status: string | null;
  sourceMeetingId: string | null;
}

export interface InsightPagination {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface InsightSearchGroup {
  data: InsightSearchItem[];
  pagination: InsightPagination;
}

export interface HouseholdInsightsSearchResponse {
  meetings: InsightSearchGroup;
  tasks: InsightSearchGroup;
  agreements: InsightSearchGroup;
}

export interface InsightsSearchRequest {
  q: string;
  limit: number;
  offset: number;
}
