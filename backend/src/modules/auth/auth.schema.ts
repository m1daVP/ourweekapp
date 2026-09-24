import { z } from 'zod';

import {
  apiIdSchema,
  authTokenSchema,
  displayNameSchema,
  emailSchema,
  isoDateTimeStringSchema,
  optionalDisplayNameSchema,
  passwordSchema,
} from '../../shared/schemas/index.js';

export const planTypeSchema = z.enum(['free', 'premium']);
export const userRoleSchema = z.enum(['owner', 'adult_member', 'viewer']);
export const signInMethodSchema = z.enum(['password', 'google']);

export const authUserSchema = z.object({
  id: apiIdSchema,
  workspaceId: apiIdSchema,
  email: emailSchema.optional(),
  displayName: optionalDisplayNameSchema,
  role: userRoleSchema,
  planType: planTypeSchema,
  signInMethods: z.array(signInMethodSchema).min(1),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
});

export const authSessionSchema = z.object({
  id: apiIdSchema,
  userId: apiIdSchema,
  deviceLabel: optionalDisplayNameSchema,
  createdAt: isoDateTimeStringSchema,
  expiresAt: isoDateTimeStringSchema,
  lastUsedAt: isoDateTimeStringSchema.optional(),
});

export const authSessionResponseSchema = z.object({
  user: authUserSchema,
  accessToken: authTokenSchema,
  refreshToken: authTokenSchema,
  expiresAt: isoDateTimeStringSchema,
});

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  invitationToken: authTokenSchema.optional(),
});

export const signInRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const googleSignInRequestSchema = z.object({
  idToken: authTokenSchema,
  invitationToken: authTokenSchema.optional(),
});

export const googleLinkRequestSchema = z.object({
  idToken: authTokenSchema,
});

export const acceptWorkspaceInvitationRequestSchema = z.object({
  token: authTokenSchema,
});

export const refreshTokenRequestSchema = z.object({
  refreshToken: authTokenSchema,
});

export const signOutRequestSchema = z
  .object({
    refreshToken: authTokenSchema.optional(),
  })
  .optional();

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetConfirmRequestSchema = z.object({
  token: authTokenSchema,
  password: passwordSchema,
});

export const passwordResetRequestResponseSchema = z.object({
  message: z.string(),
});

export const authMeResponseSchema = authUserSchema;

export type PlanTypeDto = z.infer<typeof planTypeSchema>;
export type UserRoleDto = z.infer<typeof userRoleSchema>;
export type SignInMethodDto = z.infer<typeof signInMethodSchema>;
export type AuthUserDto = z.infer<typeof authUserSchema>;
export type AuthSessionDto = z.infer<typeof authSessionSchema>;
export type AuthSessionResponseDto = z.infer<typeof authSessionResponseSchema>;
export type RegisterRequestDto = z.infer<typeof registerRequestSchema>;
export type SignInRequestDto = z.infer<typeof signInRequestSchema>;
export type GoogleSignInRequestDto = z.infer<typeof googleSignInRequestSchema>;
export type GoogleLinkRequestDto = z.infer<typeof googleLinkRequestSchema>;
export type AcceptWorkspaceInvitationRequestDto = z.infer<
  typeof acceptWorkspaceInvitationRequestSchema
>;
export type RefreshTokenRequestDto = z.infer<typeof refreshTokenRequestSchema>;
export type SignOutRequestDto = z.infer<typeof signOutRequestSchema>;
export type PasswordResetRequestDto = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmRequestDto = z.infer<
  typeof passwordResetConfirmRequestSchema
>;
