import { ApiError } from '../../shared/errors/index.js';
import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { requireRow, throwOnSupabaseError } from '../../shared/repositories/index.js';

const SESSION_COLUMNS =
  'id,user_id,refresh_token_hash,device_label,created_at,expires_at,revoked_at,last_used_at' as const;
const PUBLIC_SESSION_COLUMNS =
  'id,user_id,device_label,created_at,expires_at,revoked_at,last_used_at' as const;

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

type PublicSessionRow = Omit<SessionRow, 'refresh_token_hash'>;

export type SessionDto = {
  id: string;
  userId: string;
  deviceLabel: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

export type AuthSessionRecord = SessionDto & {
  refreshTokenHash: string;
};

export type CreateSessionInput = {
  userId: string;
  refreshTokenHash: string;
  deviceLabel?: string | null;
  expiresAt: string;
};

export type RotateSessionInput = {
  sessionId: string;
  currentRefreshTokenHash: string;
  refreshTokenHash: string;
  expiresAt: string;
  lastUsedAt: string;
  now?: Date;
};

export function mapSessionRowToDto(row: PublicSessionRow): SessionDto {
  return {
    id: row.id,
    userId: row.user_id,
    deviceLabel: row.device_label,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
  };
}

export function mapSessionRowToAuthRecord(row: SessionRow): AuthSessionRecord {
  return {
    ...mapSessionRowToDto(row),
    refreshTokenHash: row.refresh_token_hash,
  };
}

export class SessionsRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async createSession(input: CreateSessionInput) {
    const { data, error } = await this.supabase
      .from('sessions')
      .insert({
        user_id: input.userId,
        refresh_token_hash: input.refreshTokenHash,
        device_label: input.deviceLabel ?? null,
        expires_at: input.expiresAt,
      })
      .select(SESSION_COLUMNS)
      .single<SessionRow>();

    return mapSessionRowToAuthRecord(
      requireRow(data, error, 'session_create_failed', 'Unable to create the session.'),
    );
  }

  async findActiveSessionById(sessionId: string, now = new Date()) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select(SESSION_COLUMNS)
      .eq('id', sessionId)
      .is('revoked_at', null)
      .gt('expires_at', now.toISOString())
      .maybeSingle<SessionRow>();

    throwOnSupabaseError(error, 'session_lookup_failed', 'Unable to load the session.');

    return data ? mapSessionRowToAuthRecord(data) : null;
  }

  async findActiveSessionByRefreshTokenHash(refreshTokenHash: string, now = new Date()) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select(SESSION_COLUMNS)
      .eq('refresh_token_hash', refreshTokenHash)
      .is('revoked_at', null)
      .gt('expires_at', now.toISOString())
      .maybeSingle<SessionRow>();

    throwOnSupabaseError(error, 'session_lookup_failed', 'Unable to load the session.');

    return data ? mapSessionRowToAuthRecord(data) : null;
  }

  async listActiveSessionsForUser(userId: string, now = new Date()) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select(PUBLIC_SESSION_COLUMNS)
      .eq('user_id', userId)
      .is('revoked_at', null)
      .gt('expires_at', now.toISOString())
      .order('created_at', { ascending: false })
      .returns<PublicSessionRow[]>();

    throwOnSupabaseError(error, 'session_list_failed', 'Unable to list sessions.');

    return (data ?? []).map(mapSessionRowToDto);
  }

  async rotateSessionRefreshToken(input: RotateSessionInput) {
    const now = input.now ?? new Date();
    const { data, error } = await this.supabase
      .from('sessions')
      .update({
        refresh_token_hash: input.refreshTokenHash,
        expires_at: input.expiresAt,
        last_used_at: input.lastUsedAt,
      })
      .eq('id', input.sessionId)
      .eq('refresh_token_hash', input.currentRefreshTokenHash)
      .is('revoked_at', null)
      .gt('expires_at', now.toISOString())
      .select(SESSION_COLUMNS)
      .maybeSingle<SessionRow>();

    throwOnSupabaseError(error, 'session_update_failed', 'Unable to update the session.');

    if (!data) {
      throw new ApiError(401, 'invalid_session', 'Please sign in again.');
    }

    return mapSessionRowToAuthRecord(data);
  }

  async touchSession(sessionId: string, lastUsedAt: string) {
    const { error } = await this.supabase
      .from('sessions')
      .update({ last_used_at: lastUsedAt })
      .eq('id', sessionId)
      .is('revoked_at', null);

    throwOnSupabaseError(error, 'session_update_failed', 'Unable to update the session.');
  }

  async revokeSession(sessionId: string, revokedAt: string) {
    const { error } = await this.supabase
      .from('sessions')
      .update({ revoked_at: revokedAt })
      .eq('id', sessionId)
      .is('revoked_at', null);

    throwOnSupabaseError(error, 'session_revoke_failed', 'Unable to revoke the session.');
  }

  async revokeUserSessions(userId: string, revokedAt: string) {
    const { error } = await this.supabase
      .from('sessions')
      .update({ revoked_at: revokedAt })
      .eq('user_id', userId)
      .is('revoked_at', null);

    throwOnSupabaseError(error, 'session_revoke_failed', 'Unable to revoke sessions.');
  }
}
