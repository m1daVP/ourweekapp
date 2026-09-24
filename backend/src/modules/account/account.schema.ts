import { z } from 'zod';

import {
  apiIdSchema,
  isoDateTimeStringSchema,
} from '../../shared/schemas/index.js';
import { userRoleSchema } from '../auth/auth.schema.js';
import { calendarConnectionStatusSchema } from '../calendar/calendar.schema.js';
import {
  agreementSchema,
  taskReviewDecisionSchema,
  taskSchema,
} from '../tasks/tasks.schema.js';
import { participantSchema } from '../participants/participants.schema.js';
import { subscriptionStatusSchema } from '../billing/billing.schema.js';
import { workspaceMemberStatusSchema } from '../workspace/workspace.schema.js';

export const accountExportUserSchema = z.object({
  id: apiIdSchema,
  email: z.email(),
  displayName: z.string().nullable(),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
});

export const accountExportWorkspaceMemberSchema = z.object({
  userId: apiIdSchema,
  displayName: z.string(),
  email: z.email().nullable(),
  role: userRoleSchema,
  status: workspaceMemberStatusSchema,
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
});

export const accountExportMeetingSchema = z.object({
  id: apiIdSchema,
  templateId: z.string(),
  title: z.string(),
  status: z.enum(['draft', 'in_progress', 'paused', 'incomplete', 'completed']),
  participantIds: z.array(apiIdSchema),
  sections: z.array(z.unknown()),
  currentSectionIndex: z.number().int().min(0),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
  completedAt: isoDateTimeStringSchema.optional(),
  aiSummary: z.unknown().optional(),
  serverRevision: z.number().int().positive(),
  deletedAt: isoDateTimeStringSchema.optional(),
});

export const accountExportWorkspaceSchema = z.object({
  id: apiIdSchema,
  name: z.string(),
  ownerId: apiIdSchema,
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
  members: z.array(accountExportWorkspaceMemberSchema),
  participants: z.array(participantSchema),
  meetings: z.array(accountExportMeetingSchema),
  tasks: z.array(taskSchema),
  agreements: z.array(agreementSchema),
  reviewDecisions: z.array(taskReviewDecisionSchema),
  subscription: subscriptionStatusSchema.nullable(),
  calendarConnections: z.array(calendarConnectionStatusSchema),
});

export const accountExportResponseSchema = z.object({
  exportedAt: isoDateTimeStringSchema,
  user: accountExportUserSchema,
  workspaces: z.array(accountExportWorkspaceSchema),
});

export type AccountExportResponseDto = z.infer<typeof accountExportResponseSchema>;
