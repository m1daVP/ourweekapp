import argon2 from 'argon2';
import type { FastifyBaseLogger } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

import { env } from '../../config/env.js';
import { ApiError } from '../../shared/errors/index.js';
import type { PlanType, UserRole } from '../../shared/auth/index.js';
import { AuthRepository } from './auth.repository.js';
import {
  googleAuthProvider,
  type GoogleAuthProvider,
  type VerifiedGoogleIdentity,
} from './google-auth.client.js';
import { sendPasswordResetEmail } from '../../shared/mailer/mailer.js';
import {
  generatePasswordResetCode,
  hashPasswordResetCode,
  hashRefreshToken,
  issueAccessToken,
  issueRefreshTokenSession,
  verifyAccessToken,
} from './token.service.js';
import type {
  PasswordResetConfirmRequestDto,
  PasswordResetRequestDto,
  RefreshTokenRequestDto,
  GoogleSignInRequestDto,
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
  password_hash: string | null;
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

type AuthIdentityRow = {
  id: string;
  user_id: string;
  provider: 'google';
  provider_subject: string;
  email: string;
  email_normalized: string;
  email_verified: boolean;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
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

const invalidGoogleTokenError = new ApiError(
  401,
  'invalid_google_token',
  'Google sign-in could not be verified.',
);

const unauthenticatedError = new ApiError(
  401,
  'unauthenticated',
  'Authentication is required.',
);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function googleDisplayName(identity: VerifiedGoogleIdentity) {
  const displayName = identity.displayName?.trim();

  if (displayName) {
    return displayName.slice(0, 80);
  }

  return identity.email.split('@')[0]?.slice(0, 80) || 'Google user';
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

async function getGoogleIdentityBySubject(
  supabase: SupabaseClient,
  providerSubject: string,
) {
  const { data, error } = await supabase
    .from('auth_identities')
    .select(
      'id,user_id,provider,provider_subject,email,email_normalized,email_verified,display_name,avatar_url,created_at,updated_at',
    )
    .eq('provider', 'google')
    .eq('provider_subject', providerSubject)
    .returns<AuthIdentityRow[]>()
    .maybeSingle();

  if (error) {
    throw new ApiError(
      500,
      'auth_identity_lookup_failed',
      'Something went wrong. Please try again.',
    );
  }

  return data;
}

async function linkGoogleIdentity(
  supabase: SupabaseClient,
  userId: string,
  identity: VerifiedGoogleIdentity,
) {
  const email = normalizeEmail(identity.email);
  const { data, error } = await supabase
    .from('auth_identities')
    .insert({
      user_id: userId,
      provider: 'google',
      provider_subject: identity.subject,
      email,
      email_normalized: email,
      email_verified: true,
      display_name: identity.displayName,
      avatar_url: identity.avatarUrl,
    })
    .select(
      'id,user_id,provider,provider_subject,email,email_normalized,email_verified,display_name,avatar_url,created_at,updated_at',
    )
    .returns<AuthIdentityRow[]>()
    .single();

  if (!error) {
    return data;
  }

  if (getSupabaseErrorCode(error) === '23505') {
    const existingIdentity = await getGoogleIdentityBySubject(
      supabase,
      identity.subject,
    );

    if (existingIdentity?.user_id === userId) {
      return existingIdentity;
    }

    throw new ApiError(
      409,
      'account_link_conflict',
      'Google sign-in is linked to another account.',
    );
  }

  throw new ApiError(
    500,
    'auth_identity_link_failed',
    'Something went wrong. Please try again.',
  );
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

async function registerGoogleUser(
  supabase: SupabaseClient,
  identity: VerifiedGoogleIdentity,
) {
  const email = normalizeEmail(identity.email);
  const displayName = googleDisplayName(identity);
  const created: { userId?: string; workspaceId?: string } = {};

  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      email,
      email_normalized: email,
      display_name: displayName,
      password_hash: null,
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
    await linkGoogleIdentity(supabase, user.id, identity);

    const workspaceName = `${displayName}'s home`;
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
        display_name: displayName,
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
    await cleanupFailedRegistration(supabase, created);
    throw error;
  }
}

export async function signInWithGoogle(
  supabase: SupabaseClient,
  body: GoogleSignInRequestDto,
  provider: GoogleAuthProvider = googleAuthProvider,
  logger?: Pick<FastifyBaseLogger, 'warn'>,
): Promise<AuthSessionDto> {
  const identity = await provider.verifyIdToken(body.idToken, logger);
  const existingIdentity = await getGoogleIdentityBySubject(
    supabase,
    identity.subject,
  );
  const user = existingIdentity
    ? await getUserById(supabase, existingIdentity.user_id)
    : await getUserByEmail(supabase, identity.email);

  if (existingIdentity && !user) {
    throw invalidGoogleTokenError;
  }

  if (user) {
    if (!existingIdentity) {
      await linkGoogleIdentity(supabase, user.id, identity);
    }

    const member = await getActiveMemberForUser(supabase, user.id);

    if (!member) {
      throw invalidGoogleTokenError;
    }

    return createSessionResponse(supabase, user, member);
  }

  return registerGoogleUser(supabase, identity);
}

export async function signInUser(
  supabase: SupabaseClient,
  body: SignInRequestDto,
): Promise<AuthSessionDto> {
  const user = await getUserByEmail(supabase, body.email);

  if (!user) {
    throw genericAuthFailure;
  }

  if (!user.password_hash) {
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

const passwordResetTtlMinutes = 30;

const invalidResetCodeError = new ApiError(
  422,
  'invalid_reset_code',
  'The reset code is invalid or has expired.',
);

type PasswordResetTokenRow = {
  id: string;
  user_id: string;
  code_hash: string;
  expires_at: string;
  consumed_at: string | null;
};

export async function requestPasswordReset(
  supabase: SupabaseClient,
  body: PasswordResetRequestDto,
  logger?: Pick<FastifyBaseLogger, 'warn' | 'error'>,
) {
  const user = await getUserByEmail(supabase, body.email);

  // Always answer with the same generic message so requests cannot be used
  // to enumerate accounts. Google-only accounts have no password to reset.
  if (!user || !user.password_hash) {
    return { message: passwordResetMessage };
  }

  if (!env.SMTP_CONFIGURED) {
    logger?.warn(
      { userId: user.id },
      'Password reset requested but SMTP is not configured; no email sent',
    );
    return { message: passwordResetMessage };
  }

  const code = generatePasswordResetCode();
  const expiresAt = new Date(Date.now() + passwordResetTtlMinutes * 60 * 1000);

  const { error: deleteError } = await supabase
    .from('password_reset_tokens')
    .delete()
    .eq('user_id', user.id);

  if (deleteError) {
    throw new ApiError(
      500,
      'password_reset_failed',
      'Something went wrong. Please try again.',
    );
  }

  const { error: insertError } = await supabase
    .from('password_reset_tokens')
    .insert({
      user_id: user.id,
      code_hash: hashPasswordResetCode(code),
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    throw new ApiError(
      500,
      'password_reset_failed',
      'Something went wrong. Please try again.',
    );
  }

  try {
    await sendPasswordResetEmail(user.email, code);
  } catch (error) {
    logger?.error(
      { err: error, userId: user.id },
      'Failed to send password reset email',
    );
  }

  return { message: passwordResetMessage };
}

export async function confirmPasswordReset(
  supabase: SupabaseClient,
  body: PasswordResetConfirmRequestDto,
) {
  const codeHash = hashPasswordResetCode(body.token);
  const nowIso = new Date().toISOString();

  const { data: token, error: tokenError } = await supabase
    .from('password_reset_tokens')
    .select('id,user_id,code_hash,expires_at,consumed_at')
    .eq('code_hash', codeHash)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .returns<PasswordResetTokenRow[]>()
    .maybeSingle();

  if (tokenError) {
    throw new ApiError(
      500,
      'password_reset_failed',
      'Something went wrong. Please try again.',
    );
  }

  if (!token) {
    throw invalidResetCodeError;
  }

  const passwordHash = await hashPassword(body.password);

  const { error: passwordError } = await supabase
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', token.user_id);

  if (passwordError) {
    throw new ApiError(
      500,
      'password_reset_failed',
      'Something went wrong. Please try again.',
    );
  }

  const { error: revokeError } = await supabase
    .from('sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', token.user_id)
    .is('revoked_at', null);

  if (revokeError) {
    throw new ApiError(
      500,
      'session_revoke_failed',
      'Something went wrong. Please try again.',
    );
  }

  const { error: consumeError } = await supabase
    .from('password_reset_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', token.id);

  if (consumeError) {
    throw new ApiError(
      500,
      'password_reset_failed',
      'Something went wrong. Please try again.',
    );
  }
}
