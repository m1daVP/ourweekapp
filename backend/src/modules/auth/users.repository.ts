import { formatApiDateTime, formatNullableApiDateTime } from '../../shared/dates.js';
import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { requireRow, throwOnSupabaseError } from '../../shared/repositories/index.js';

const PUBLIC_USER_COLUMNS =
  'id,email,email_normalized,display_name,created_at,updated_at' as const;
const AUTH_USER_COLUMNS =
  'id,email,email_normalized,display_name,password_hash,created_at,updated_at,deleted_at' as const;

type UserRow = {
  id: string;
  email: string;
  email_normalized: string;
  display_name: string | null;
  password_hash: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PublicUserDto = {
  id: string;
  email: string;
  emailNormalized: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthUserRecord = PublicUserDto & {
  passwordHash: string;
  deletedAt: string | null;
};

export type CreateUserInput = {
  email: string;
  emailNormalized: string;
  displayName?: string | null;
  passwordHash: string;
};

export type UpdateUserPasswordInput = {
  userId: string;
  passwordHash: string;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function mapUserRowToPublicUserDto(row: Pick<UserRow, 'id' | 'email' | 'email_normalized' | 'display_name' | 'created_at' | 'updated_at'>): PublicUserDto {
  return {
    id: row.id,
    email: row.email,
    emailNormalized: row.email_normalized,
    displayName: row.display_name,
    createdAt: formatApiDateTime(row.created_at),
    updatedAt: formatApiDateTime(row.updated_at),
  };
}

export function mapUserRowToAuthUserRecord(row: UserRow): AuthUserRecord {
  return {
    ...mapUserRowToPublicUserDto(row),
    passwordHash: row.password_hash,
    deletedAt: formatNullableApiDateTime(row.deleted_at),
  };
}

export class UsersRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async createUser(input: CreateUserInput) {
    const { data, error } = await this.supabase
      .from('users')
      .insert({
        email: input.email.trim(),
        email_normalized: input.emailNormalized,
        display_name: input.displayName ?? null,
        password_hash: input.passwordHash,
      })
      .select(AUTH_USER_COLUMNS)
      .single<UserRow>();

    return mapUserRowToAuthUserRecord(
      requireRow(data, error, 'user_create_failed', 'Unable to create the user.'),
    );
  }

  async findUserById(userId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select(PUBLIC_USER_COLUMNS)
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle<Pick<UserRow, 'id' | 'email' | 'email_normalized' | 'display_name' | 'created_at' | 'updated_at'>>();

    throwOnSupabaseError(error, 'user_lookup_failed', 'Unable to load the user.');

    return data ? mapUserRowToPublicUserDto(data) : null;
  }

  async findUserByNormalizedEmail(emailNormalized: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select(AUTH_USER_COLUMNS)
      .eq('email_normalized', emailNormalized)
      .is('deleted_at', null)
      .maybeSingle<UserRow>();

    throwOnSupabaseError(error, 'user_lookup_failed', 'Unable to load the user.');

    return data ? mapUserRowToAuthUserRecord(data) : null;
  }

  async updateUserPassword(input: UpdateUserPasswordInput) {
    const { data, error } = await this.supabase
      .from('users')
      .update({ password_hash: input.passwordHash })
      .eq('id', input.userId)
      .is('deleted_at', null)
      .select(AUTH_USER_COLUMNS)
      .single<UserRow>();

    return mapUserRowToAuthUserRecord(
      requireRow(data, error, 'user_update_failed', 'Unable to update the user.'),
    );
  }
}
