import argon2 from 'argon2';
import type { FastifyBaseLogger } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

import { env } from '../../config/env.js';

import { ApiError } from '../../shared/errors/index.js';
import {
  requireAuthenticatedContext,
  type AuthContext,
  type PlanType,
  type UserRole,
} from '../../shared/auth/index.js';
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
  AcceptWorkspaceInvitationRequestDto,
  GoogleSignInRequestDto,
  GoogleLinkRequestDto,
  RegisterRequestDto,
  SignInRequestDto,
  SignOutRequestDto,
  SignInMethodDto,
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

type InvitationRegistrationRow = {
  id: string;
  workspace_id: string;
  email_normalized: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
};

export type AuthUserDto = {
  id: string;
  workspaceId: string;
  email: string;
  displayName?: string;
  role: UserRole;
  planType: 'free' | 'premium';
  signInMethods: SignInMethodDto[];
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

function mapInvitationAcceptanceError(error: { message?: string } | null) {
  if (!error) {
    return;
  }

  if (error.message === 'invitation_email_mismatch') {
    throw new ApiError(
      403,
      'invitation_email_mismatch',
      'Sign in with the email address that received this invitation.',
    );
  }

  if (error.message === 'invitation_invalid_or_expired') {
    throw new ApiError(
      422,
      'invitation_invalid_or_expired',
      'This invitation is invalid or has expired.',
    );
  }

  if (error.message === 'household_member_limit_reached') {
    throw new ApiError(409, 'household_member_limit_reached', 'This household has reached its member limit.');
  }
}

function hashInvitationToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
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
  signInMethods: SignInMethodDto[],
  planType: PlanType = 'free',
  role: UserRole = member.role,
): AuthUserDto {
  return {
    id: user.id,
    workspaceId: member.workspace_id,
    email: user.email,
    displayName: user.display_name ?? member.display_name,
    role,
    planType,
    signInMethods,
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

const PARTNER_PARTICIPANT = {
  name: 'Partner',
  initials: 'P',
  avatar_color: '#6b8f71',
  type: 'adult',
  is_active: true,
} as const;

function participantInitials(displayName: string) {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3);
}

async function createInitialParticipants(
  supabase: SupabaseClient,
  workspaceId: string,
  ownerDisplayName: string,
  ownerEmail: string,
  ownerUserId: string,
) {
  const { error } = await supabase.from('participants').insert(
    [
      {
        workspace_id: workspaceId,
        name: ownerDisplayName,
        initials: participantInitials(ownerDisplayName),
        avatar_color: '#496a8f',
        type: 'adult',
        is_active: true,
        email: ownerEmail,
        email_normalized: ownerEmail,
        user_id: ownerUserId,
      },
      {
        workspace_id: workspaceId,
        ...PARTNER_PARTICIPANT,
      },
    ],
  );

  if (error) {
    throw new ApiError(
      500,
      'participant_create_failed',
      'Something went wrong. Please try again.',
    );
  }
}

async function resolveInvitationForRegistration(
  supabase: SupabaseClient,
  invitationToken: string | undefined,
  email: string,
) {
  if (!invitationToken) {
    return null;
  }

  const { data, error } = await supabase
    .from('workspace_invitations')
    .select('id,workspace_id,email_normalized,status,expires_at')
    .eq('token_hash', hashInvitationToken(invitationToken))
    .returns<InvitationRegistrationRow[]>()
    .maybeSingle();

  if (error) {
    throw new ApiError(
      500,
      'invitation_lookup_failed',
      'Something went wrong. Please try again.',
    );
  }

  if (
    !data ||
    data.status !== 'pending' ||
    new Date(data.expires_at).getTime() <= Date.now()
  ) {
    throw new ApiError(
      422,
      'invitation_invalid_or_expired',
      'This invitation is invalid or has expired.',
    );
  }

  if (data.email_normalized !== email) {
    throw new ApiError(
      403,
      'invitation_email_mismatch',
      'Sign in or register with the email address that received this invitation.',
    );
  }

  return {
    tokenHash: hashInvitationToken(invitationToken),
    workspaceId: data.workspace_id,
  };
}

async function acceptInvitationForNewUser(
  supabase: SupabaseClient,
  invitation: { tokenHash: string },
  user: UserRow,
) {
  const { data, error } = await supabase
    .rpc('accept_participant_invitation', {
      p_token_hash: invitation.tokenHash,
      p_user_id: user.id,
      p_email_normalized: normalizeEmail(user.email),
      p_now: new Date().toISOString(),
    })
    .single<WorkspaceMemberRow>();

  if (error) {
    const message = error.message;

    if (message === 'invitation_email_mismatch') {
      throw new ApiError(
        403,
        'invitation_email_mismatch',
        'Sign in or register with the email address that received this invitation.',
      );
    }

    if (
      message === 'invitation_invalid_or_expired' ||
      message === 'participant_not_found'
    ) {
      throw new ApiError(
        422,
        'invitation_invalid_or_expired',
        'This invitation is invalid or has expired.',
      );
    }

    if (message === 'workspace_member_already_linked') {
      throw new ApiError(
        409,
        'workspace_member_already_linked',
        'This account is already linked to another participant in this workspace.',
      );
    }

    throw new ApiError(
      500,
      'invitation_accept_failed',
      'Something went wrong. Please try again.',
    );
  }

  return data;
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

async function getSignInMethods(
  supabase: SupabaseClient,
  user: Pick<UserRow, 'id' | 'password_hash'>,
): Promise<SignInMethodDto[]> {
  const { data, error } = await supabase
    .from('auth_identities')
    .select('provider')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .limit(1)
    .returns<Array<{ provider: 'google' }>>();

  if (error) {
    throw new ApiError(
      500,
      'auth_identity_lookup_failed',
      'Something went wrong. Please try again.',
    );
  }

  const methods: SignInMethodDto[] = [];
  if (user.password_hash) {
    methods.push('password');
  }
  if ((data ?? []).some((identity) => identity.provider === 'google')) {
    methods.push('google');
  }

  if (methods.length === 0) {
    throw invalidSessionError;
  }

  return methods;
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
  const signInMethods = await getSignInMethods(supabase, user);

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
    user: mapAuthUser(user, member, signInMethods),
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
  const invitation = await resolveInvitationForRegistration(
    supabase,
    body.invitationToken,
    email,
  );
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
        'email_already_registered',
        'An account with this email address already exists. Sign in instead.',
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
    if (invitation) {
      const member = await acceptInvitationForNewUser(supabase, invitation, user);

      return await createSessionResponse(supabase, user, member);
    }

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

    await createInitialParticipants(
      supabase,
      workspace.id,
      body.displayName,
      email,
      user.id,
    );

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
  invitationToken?: string,
) {
  const email = normalizeEmail(identity.email);
  const displayName = googleDisplayName(identity);
  const invitation = await resolveInvitationForRegistration(
    supabase,
    invitationToken,
    email,
  );
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

    if (invitation) {
      const member = await acceptInvitationForNewUser(supabase, invitation, user);

      return await createSessionResponse(supabase, user, member);
    }

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

    await createInitialParticipants(
      supabase,
      workspace.id,
      displayName,
      email,
      user.id,
    );

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
  if (existingIdentity) {
    const user = await getUserById(supabase, existingIdentity.user_id);

    if (!user) {
      throw invalidGoogleTokenError;
    }

    const member = await getActiveMemberForUser(supabase, user.id);

    if (!member) {
      throw invalidGoogleTokenError;
    }

    return createSessionResponse(supabase, user, member);
  }

  const userWithEmail = await getUserByEmail(supabase, identity.email);
  if (userWithEmail) {
    throw new ApiError(
      409,
      'account_link_required',
      'This email already has an account. Sign in with your password, then link Google from Settings.',
    );
  }

  return registerGoogleUser(supabase, identity, body.invitationToken);
}

function mapGoogleLinkError(error: { message?: string; code?: string } | null) {
  if (!error) {
    return;
  }

  if (error.message === 'account_link_email_mismatch') {
    throw new ApiError(
      409,
      'account_link_email_mismatch',
      'Use the Google account with the same email as your OurWeek account.',
    );
  }

  if (error.message === 'account_link_conflict') {
    throw new ApiError(
      409,
      'account_link_conflict',
      'This Google account is linked to another OurWeek account.',
    );
  }

  if (error.message === 'google_already_linked') {
    throw new ApiError(
      409,
      'google_already_linked',
      'A different Google account is already linked.',
    );
  }

  if (error.message === 'auth_user_not_found') {
    throw invalidSessionError;
  }

  throw new ApiError(
    500,
    'auth_identity_link_failed',
    'Something went wrong. Please try again.',
  );
}

export async function linkGoogleIdentityForAuthenticatedUser(
  supabase: SupabaseClient,
  auth: AuthContext | undefined,
  body: GoogleLinkRequestDto,
  provider: GoogleAuthProvider = googleAuthProvider,
  logger?: Pick<FastifyBaseLogger, 'warn'>,
): Promise<AuthUserDto> {
  const context = requireAuthenticatedContext(auth);
  const identity = await provider.verifyIdToken(body.idToken, logger);
  const { error } = await supabase.rpc('link_google_auth_identity', {
    p_user_id: context.userId,
    p_provider_subject: identity.subject,
    p_email: normalizeEmail(identity.email),
    p_display_name: identity.displayName ?? null,
    p_avatar_url: identity.avatarUrl ?? null,
  });

  mapGoogleLinkError(error);

  const user = await getUserById(supabase, context.userId);
  const member = await getActiveMemberForUser(
    supabase,
    context.userId,
    context.workspaceId,
  );

  if (!user || !member) {
    throw invalidSessionError;
  }

  const signInMethods = await getSignInMethods(supabase, user);
  return mapAuthUser(
    user,
    member,
    signInMethods,
    context.planType,
    context.role,
  );
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

export async function acceptWorkspaceInvitation(
  supabase: SupabaseClient,
  auth: AuthContext | undefined,
  body: AcceptWorkspaceInvitationRequestDto,
): Promise<AuthSessionDto> {
  const context = requireAuthenticatedContext(auth);
  const user = await getUserById(supabase, context.userId);

  if (!user) {
    throw invalidSessionError;
  }

  const { data, error } = await supabase
    .rpc('accept_participant_invitation', {
      p_token_hash: hashInvitationToken(body.token),
      p_user_id: user.id,
      p_email_normalized: normalizeEmail(user.email),
      p_now: new Date().toISOString(),
    })
    .returns<WorkspaceMemberRow[]>();

  mapInvitationAcceptanceError(error);

  if (error) {
    throw new ApiError(
      500,
      'invitation_accept_failed',
      'Unable to accept the invitation. Please try again.',
    );
  }

  const member = (Array.isArray(data) ? data : [])[0];
  if (!member) {
    throw new ApiError(
      422,
      'invitation_invalid_or_expired',
      'This invitation is invalid or has expired.',
    );
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
  const signInMethods = await getSignInMethods(supabase, user);

  return {
    user: mapAuthUser(user, member, signInMethods),
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

  const signInMethods = await getSignInMethods(supabase, user);

  return mapAuthUser(user, member, signInMethods, auth.planType, auth.role);
}

const passwordResetTtlMinutes = 30;

const invalidResetCodeError = new ApiError(
  422,
  'invalid_reset_code',
  'The reset code is invalid or has expired.',
);

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
  const passwordHash = await hashPassword(body.password);
  const confirmedAt = new Date().toISOString();
  const { data: confirmed, error } = await supabase.rpc(
    'confirm_password_reset',
    {
      p_code_hash: codeHash,
      p_password_hash: passwordHash,
      p_confirmed_at: confirmedAt,
    },
  );

  if (error) {
    throw new ApiError(
      500,
      'password_reset_failed',
      'Something went wrong. Please try again.',
    );
  }

  if (confirmed !== true) {
    throw invalidResetCodeError;
  }
}
