import { z } from 'zod';

import {
  apiIdSchema,
  isoDateTimeStringSchema,
  nullableIsoDateTimeStringSchema,
} from '../../shared/schemas/index.js';

export const insightsPeriodSchema = z.enum(['4w', '12w', 'all']);

export const insightsQuerySchema = z.object({
  period: insightsPeriodSchema.default('4w'),
});

export const insightsSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const paginationSchema = z.object({
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

const meetingConsistencySchema = z.object({
  completedMeetings: z.number().int().nonnegative(),
  averageIntervalDays: z.number().nonnegative().nullable(),
});

const taskFollowThroughSchema = z.object({
  done: z.number().int().nonnegative(),
  open: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
  completionRate: z.number().min(0).max(1).nullable(),
});

const agreementFollowThroughSchema = z.object({
  resolved: z.number().int().nonnegative(),
  unresolved: z.number().int().nonnegative(),
  notTrackedYet: z.number().int().nonnegative(),
});

export const recurringTopicSchema = z.object({
  title: z.string().min(1),
  meetingCount: z.number().int().min(2),
  meetingIds: z.array(apiIdSchema).min(2),
});

export const insightsResponseSchema = z.object({
  period: insightsPeriodSchema,
  rangeStart: nullableIsoDateTimeStringSchema,
  rangeEnd: isoDateTimeStringSchema,
  meetingConsistency: meetingConsistencySchema,
  taskFollowThrough: taskFollowThroughSchema,
  agreementFollowThrough: agreementFollowThroughSchema,
  recurringTopics: z.array(recurringTopicSchema),
});

export const insightSearchItemSchema = z.object({
  id: apiIdSchema,
  type: z.enum(['meeting', 'task', 'agreement']),
  title: z.string().min(1),
  occurredAt: nullableIsoDateTimeStringSchema,
  status: z.string().nullable(),
  sourceMeetingId: apiIdSchema.nullable(),
});

const insightSearchGroupSchema = z.object({
  data: z.array(insightSearchItemSchema),
  pagination: paginationSchema,
});

export const insightsSearchResponseSchema = z.object({
  meetings: insightSearchGroupSchema,
  tasks: insightSearchGroupSchema,
  agreements: insightSearchGroupSchema,
});

export type InsightsPeriodDto = z.infer<typeof insightsPeriodSchema>;
export type InsightsQueryDto = z.infer<typeof insightsQuerySchema>;
export type InsightsSearchQueryDto = z.infer<typeof insightsSearchQuerySchema>;
export type InsightsResponseDto = z.infer<typeof insightsResponseSchema>;
export type InsightsSearchResponseDto = z.infer<typeof insightsSearchResponseSchema>;
