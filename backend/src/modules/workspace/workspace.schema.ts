import { z } from 'zod';

import {
  apiIdSchema,
  displayNameSchema,
  emailSchema,
  isoDateTimeStringSchema,
  optionalDisplayNameSchema,
  trimmedString,
  VALIDATION_LIMITS,
} from '../../shared/schemas/index.js';
import { userRoleSchema } from '../auth/auth.schema.js';

export const workspaceNameSchema = trimmedString(
  VALIDATION_LIMITS.workspaceNameMinLength,
  VALIDATION_LIMITS.workspaceNameMaxLength,
);

export const workspaceMemberStatusSchema = z.enum([
  'active',
  'invited',
  'removed',
]);

export const workspaceInvitationStatusSchema = z.enum([
  'pending',
  'accepted',
  'expired',
  'revoked',
]);

export const workspaceMemberSchema = z.object({
  userId: apiIdSchema,
  displayName: displayNameSchema,
  email: emailSchema.optional(),
  role: userRoleSchema,
  status: workspaceMemberStatusSchema,
});

export const workspaceSchema = z.object({
  id: apiIdSchema,
  name: workspaceNameSchema,
  ownerId: apiIdSchema,
  members: z.array(workspaceMemberSchema),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
});

export const updateWorkspaceRequestSchema = z.object({
  name: workspaceNameSchema,
});

export const createWorkspaceInvitationRequestSchema = z.object({
  email: emailSchema,
  displayName: optionalDisplayNameSchema,
  role: userRoleSchema,
});

export const updateWorkspaceMemberRequestSchema = z.object({
  role: userRoleSchema.optional(),
  status: workspaceMemberStatusSchema.optional(),
});

export const workspaceMemberParamsSchema = z.object({
  userId: apiIdSchema,
});

export type WorkspaceMemberStatusDto = z.infer<
  typeof workspaceMemberStatusSchema
>;
export type WorkspaceInvitationStatusDto = z.infer<
  typeof workspaceInvitationStatusSchema
>;
export type WorkspaceMemberDto = z.infer<typeof workspaceMemberSchema>;
export type WorkspaceDto = z.infer<typeof workspaceSchema>;
export type UpdateWorkspaceRequestDto = z.infer<
  typeof updateWorkspaceRequestSchema
>;
