import argon2 from 'argon2';
import type { SupabaseClient } from '@supabase/supabase-js';

import { env } from '../../config/env.js';
import { ApiError } from '../../shared/errors/index.js';
import type { PlanType, UserRole } from '../../shared/auth/index.js';
import { AuthRepository } from './auth.repository.js';
import {
  hashRefreshToken,
  issueAccessToken,
  issueRefreshTokenSession,
  verifyAccessToken,
} from './token.service.js';
import type {
  PasswordResetConfirmRequestDto,
  PasswordResetRequestDto,
  RefreshTokenRequestDto,
  RegisterRequestDto,
  SignInRequestDto,
  SignOutRequestDto,
} from './auth.schema.js';

export async function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: env.ARGON2_MEMORY_COST,
    timeCost: env.ARGON2_TIME_COST,
    parallelism: env.ARGON2_PARALLELISM,
  });
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  password_hash: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type WorkspaceMemberRow = {
  workspace_id: string;
  user_id: string;
  display_name: string;
  email: string | null;
  role: UserRole;
  status: 'active' | 'invited' | 'removed';
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  device_label: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

export type AuthUserDto = {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  planType: 'free' | 'premium';
  createdAt: string;
  updatedAt: string;
};

export type AuthSessionDto = {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

const genericAuthFailure = new ApiError(
  401,
  'invalid_credentials',
  'Email or password is incorrect.',
);

const passwordResetMessage =
  'If an account exists, reset instructions have been sent.';

const invalidSessionError = new ApiError(
  401,
  'invalid_session',
  'Please sign in again.',
);

const unauthenticatedError = new ApiError(
  401,
  'unauthenticated',
  'Authentication is required.',
);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function addSeconds(date: Date, seconds: number) {
  const next = new Date(date);
  next.setUTCSeconds(next.getUTCSeconds() + seconds);
  return next;
}

function mapAuthUser(
  user: UserRow,
  member: WorkspaceMemberRow,
  planType: PlanType = 'free',
  role: UserRole = member.role,
): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name ?? member.display_name,
    role,
    planType,
    createdAt: new Date(user.created_at).toISOString(),
    updatedAt: new Date(user.updated_at).toISOString(),
  };
}

function getSupabaseErrorCode(error: { code?: string } | null) {
  return error?.code ?? '';
}

async function getActiveMemberForUser(
  supabase: SupabaseClient,
  userId: string,
  workspaceId?: string,
) {
  const query = supabase
    .from('workspace_members')
    .select(
      'workspace_id,user_id,display_name,email,role,status,created_at,updated_at',
    )
    .eq('user_id', userId)
    .eq('status', 'active');

  const scopedQuery = workspaceId
    ? query.eq('workspace_id', workspaceId)
    : query;

  const { data, error } = await scopedQuery
    .limit(1)
    .returns<WorkspaceMemberRow[]>();

  if (error) {
    throw new ApiError(
      500,
      'auth_lookup_failed',
      'Something went wrong. Please try again.',
    );
  }

  return data[0] ?? null;
}

async function getUserById(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select(
      'id,email,display_name,password_hash,created_at,updated_at,deleted_at',
    )
    .eq('id', userId)
    .is('deleted_at', null)
    .returns<UserRow[]>()
    .maybeSingle();

  if (error) {
    throw new ApiError(
      500,
      'auth_lookup_failed',
      'Something went wrong. Please try again.',
    );
  }

  return data;
}

async function getUserByEmail(supabase: SupabaseClient, email: string) {
  const { data, error } = await supabase
    .from('users')
    .select(
      'id,email,display_name,password_hash,created_at,updated_at,deleted_at',
    )
    .eq('email_normalized', normalizeEmail(email))
    .is('deleted_at', null)
    .returns<UserRow[]>()
    .maybeSingle();

  if (error) {
    throw new ApiError(
      500,
      'auth_lookup_failed',
      'Something went wrong. Please try again.',
    );
  }

  return data;
}

async function cleanupFailedRegistration(
  supabase: SupabaseClient,
  created: { userId?: string; workspaceId?: string },
) {
  if (created.userId) {
    await supabase.from('sessions').delete().eq('user_id', created.userId);
  }

  if (created.workspaceId) {
    await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', created.workspaceId);
    await supabase.from('workspaces').delete().eq('id', created.workspaceId);
  }

  if (created.userId) {
    await supabase.from('users').delete().eq('id', created.userId);
  }
}

async function createSessionResponse(
  supabase: SupabaseClient,
  user: UserRow,
  member: WorkspaceMemberRow,
): Promise<AuthSessionDto> {
  const now = new Date();
  const refreshSession = issueRefreshTokenSession(now);
  const expiresAt = addSeconds(now, env.ACCESS_TOKEN_TTL_SECONDS);

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      refresh_token_hash: refreshSession.refreshTokenHash,
      expires_at: refreshSession.expiresAt.toISOString(),
    })
    .select(
      'id,user_id,refresh_token_hash,device_label,created_at,expires_at,revoked_at,last_used_at',
    )
    .returns<SessionRow[]>()
    .single();

  if (error) {
    throw new ApiError(
      500,
      'session_create_failed',
      'Something went wrong. Please try again.',
    );
  }

  const accessToken = await issueAccessToken({
    userId: user.id,
    sessionId: session.id,
    workspaceId: member.workspace_id,
    role: member.role,
  });

  return {
    user: mapAuthUser(user, member),
    accessToken,
    refreshToken: refreshSession.refreshToken,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function registerUser(
  supabase: SupabaseClient,
  body: RegisterRequestDto,
): Promise<AuthSessionDto> {
  const email = normalizeEmail(body.email);
  const passwordHash = await hashPassword(body.password);
  const created: { userId?: string; workspaceId?: string } = {};

  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      email,
      email_normalized: email,
      display_name: body.displayName,
      password_hash: passwordHash,
    })
    .select(
      'id,email,display_name,password_hash,created_at,updated_at,deleted_at',
    )
    .returns<UserRow[]>()
    .single();

  if (userError) {
    const code = getSupabaseErrorCode(userError);

    if (code === '23505') {
      throw new ApiError(
        409,
        'account_create_failed',
        'Unable to create an account with those details.',
      );
    }

    throw new ApiError(
      500,
      'account_create_failed',
      'Something went wrong. Please try again.',
    );
  }

  created.userId = user.id;

  try {
    const workspaceName = `${body.displayName}'s home`;
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: workspaceName,
        owner_id: user.id,
      })
      .select('id,name,owner_id,created_at,updated_at,deleted_at')
      .returns<WorkspaceRow[]>()
      .single();

    if (workspaceError) {
      throw new ApiError(
        500,
        'workspace_create_failed',
        'Something went wrong. Please try again.',
      );
    }

    created.workspaceId = workspace.id;

    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        display_name: body.displayName,
        email,
        role: 'owner',
        status: 'active',
      })
      .select(
        'workspace_id,user_id,display_name,email,role,status,created_at,updated_at',
      )
      .returns<WorkspaceMemberRow[]>()
      .single();

    if (memberError) {
      throw new ApiError(
        500,
        'workspace_member_create_failed',
        'Something went wrong. Please try again.',
      );
    }

    return await createSessionResponse(supabase, user, member);
  } catch (error) {
    // No transaction/RPC exists for registration yet; remove only the rows
    // created by this request so a partial sign-up does not linger.
    await cleanupFailedRegistration(supabase, created);
    throw error;
  }
}

export async function signInUser(
  supabase: SupabaseClient,
  body: SignInRequestDto,
): Promise<AuthSessionDto> {
  const user = await getUserByEmail(supabase, body.email);

  if (!user) {
    throw genericAuthFailure;
  }

  const validPassword = await verifyPassword(user.password_hash, body.password);

  if (!validPassword) {
    throw genericAuthFailure;
  }

  const member = await getActiveMemberForUser(supabase, user.id);

  if (!member) {
    throw genericAuthFailure;
  }

  return createSessionResponse(supabase, user, member);
}

export async function refreshSession(
  supabase: SupabaseClient,
  body: RefreshTokenRequestDto,
): Promise<AuthSessionDto> {
  const tokenHash = hashRefreshToken(body.refreshToken);
  const nowIso = new Date().toISOString();

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select(
      'id,user_id,refresh_token_hash,device_label,created_at,expires_at,revoked_at,last_used_at',
    )
    .eq('refresh_token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .returns<SessionRow[]>()
    .maybeSingle();

  if (sessionError) {
    throw new ApiError(
      500,
      'session_refresh_failed',
      'Something went wrong. Please try again.',
    );
  }

  if (!session) {
    throw invalidSessionError;
  }

  const user = await getUserById(supabase, session.user_id);
  const member = await getActiveMemberForUser(supabase, session.user_id);

  if (!user || !member) {
    throw invalidSessionError;
  }

  const refreshSession = issueRefreshTokenSession();
  const accessTokenExpiresAt = addSeconds(
    new Date(),
    env.ACCESS_TOKEN_TTL_SECONDS,
  );

  const { data: updatedSession, error: updateError } = await supabase
    .from('sessions')
    .update({
      refresh_token_hash: refreshSession.refreshTokenHash,
      expires_at: refreshSession.expiresAt.toISOString(),
      last_used_at: nowIso,
    })
    .eq('id', session.id)
    .eq('refresh_token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .select(
      'id,user_id,refresh_token_hash,device_label,created_at,expires_at,revoked_at,last_used_at',
    )
    .returns<SessionRow[]>()
    .maybeSingle();

  if (updateError) {
    throw new ApiError(
      500,
      'session_refresh_failed',
      'Something went wrong. Please try again.',
    );
  }

  if (!updatedSession) {
    throw invalidSessionError;
  }

  const accessToken = await issueAccessToken({
    userId: user.id,
    sessionId: updatedSession.id,
    workspaceId: member.workspace_id,
    role: member.role,
  });

  return {
    user: mapAuthUser(user, member),
    accessToken,
    refreshToken: refreshSession.refreshToken,
    expiresAt: accessTokenExpiresAt.toISOString(),
  };
}

async function revokeSessionByRefreshToken(
  supabase: SupabaseClient,
  refreshToken: string,
) {
  const { error } = await supabase
    .from('sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('refresh_token_hash', hashRefreshToken(refreshToken))
    .is('revoked_at', null);

  if (error) {
    throw new ApiError(
      500,
      'session_revoke_failed',
      'Something went wrong. Please try again.',
    );
  }
}

async function revokeSessionById(supabase: SupabaseClient, sessionId: string) {
  const { error } = await supabase
    .from('sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', sessionId)
    .is('revoked_at', null);

  if (error) {
    throw new ApiError(
      500,
      'session_revoke_failed',
      'Something went wrong. Please try again.',
    );
  }
}

export async function signOutUser(
  supabase: SupabaseClient,
  body: SignOutRequestDto,
  authorizationHeader?: string,
) {
  if (body?.refreshToken) {
    await revokeSessionByRefreshToken(supabase, body.refreshToken);
    return;
  }

  const token = authorizationHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return;
  }

  try {
    const claims = await verifyAccessToken(token);
    await revokeSessionById(supabase, claims.sessionId);
  } catch {
    // Sign-out remains idempotent so clients can clear local credentials.
  }
}

export async function getCurrentUser(
  supabase: SupabaseClient,
  authorizationHeader?: string,
  repository: Pick<
    AuthRepository,
    'getAuthenticatedContext'
  > = new AuthRepository(supabase),
): Promise<AuthUserDto> {
  const token = authorizationHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    throw unauthenticatedError;
  }

  let claims;

  try {
    claims = await verifyAccessToken(token);
  } catch {
    throw unauthenticatedError;
  }

  const auth = await repository.getAuthenticatedContext(claims);

  if (!auth) {
    throw invalidSessionError;
  }

  const user = await getUserById(supabase, auth.userId);

  if (!user) {
    throw invalidSessionError;
  }

  const member = await getActiveMemberForUser(
    supabase,
    auth.userId,
    auth.workspaceId,
  );

  if (!member) {
    throw invalidSessionError;
  }

  return mapAuthUser(user, member, auth.planType, auth.role);
}

export async function requestPasswordReset(
  _supabase: SupabaseClient,
  _body: PasswordResetRequestDto,
) {
  // Hook for future reset-token storage and SMTP delivery. This intentionally
  // persists no token or secret until that infrastructure exists.
  return { message: passwordResetMessage };
}

export async function confirmPasswordReset(
  _supabase: SupabaseClient,
  _body: PasswordResetConfirmRequestDto,
) {
  throw new ApiError(
    503,
    'password_reset_not_configured',
    'Password reset is not available yet. Please try again later.',
  );
}
