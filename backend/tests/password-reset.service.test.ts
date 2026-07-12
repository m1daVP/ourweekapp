import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mailer = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn(async () => undefined),
}));

vi.mock('../src/shared/mailer/mailer.js', () => mailer);

const testEnv = {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  PUBLIC_API_BASE_URL: 'http://localhost:3000/v1',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ACCESS_TOKEN_SECRET: 'access-token-secret-at-least-32-bytes',
  REFRESH_TOKEN_SECRET: 'refresh-token-secret-at-least-32-bytes',
  PASSWORD_RESET_TOKEN_SECRET: 'password-reset-secret-at-least-32-bytes',
  TOKEN_ENCRYPTION_KEY: 'token-encryption-key-at-least-32-byte',
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_DAYS: '30',
  ARGON2_MEMORY_COST: '19456',
  ARGON2_TIME_COST: '2',
};

const smtpEnv = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'mailer@example.com',
  SMTP_PASSWORD: 'smtp-password',
  EMAIL_FROM: 'OurWeek <no-reply@example.com>',
};

async function loadAuthModules({ smtpConfigured = true } = {}) {
  vi.resetModules();
  Object.assign(process.env, testEnv);

  for (const key of Object.keys(smtpEnv)) {
    delete process.env[key];
  }

  if (smtpConfigured) {
    Object.assign(process.env, smtpEnv);
  }

  const [authService, tokenService] = await Promise.all([
    import('../src/modules/auth/auth.service.js'),
    import('../src/modules/auth/token.service.js'),
  ]);

  return { authService, tokenService };
}

type QueryResult = { data?: unknown; error: unknown };
type QueryStep =
  | { result: QueryResult }
  | { rows: Record<string, unknown>[] };

function createQuery(step: QueryStep) {
  const filters: Array<(row: Record<string, unknown>) => boolean> = [];

  const resolveResult = (): QueryResult => {
    if ('result' in step) {
      return step.result;
    }

    const match = step.rows.find((row) => filters.every((fn) => fn(row)));

    return { data: match ?? null, error: null };
  };

  const query = {
    delete: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return query;
    }),
    gt: vi.fn((column: string, value: unknown) => {
      filters.push((row) => String(row[column]) > String(value));
      return query;
    }),
    insert: vi.fn(() => query),
    is: vi.fn((column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return query;
    }),
    maybeSingle: vi.fn(async () => resolveResult()),
    returns: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(async () => resolveResult()),
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(resolveResult()).then(resolve, reject),
    update: vi.fn(() => query),
  };

  return query;
}

type MockQuery = ReturnType<typeof createQuery>;

function createSupabase(steps: QueryStep[]) {
  const queries: MockQuery[] = [];
  const tables: string[] = [];
  const supabase = {
    from: vi.fn((table: string) => {
      const step = steps.shift();

      if (!step) {
        throw new Error(`Unexpected Supabase call for table ${table}`);
      }

      const query = createQuery(step);
      queries.push(query);
      tables.push(table);

      return query;
    }),
  } as unknown as SupabaseClient;

  return { supabase, queries, tables };
}

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'rita@example.com',
    display_name: 'Rita',
    password_hash: 'hash',
    created_at: '2026-06-06T10:00:00.000Z',
    updated_at: '2026-06-06T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function isoMinutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

const resetCodePattern = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/;

describe('password reset service', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mailer.sendPasswordResetEmail.mockClear();
    mailer.sendPasswordResetEmail.mockResolvedValue(undefined);
  });

  describe('requestPasswordReset', () => {
    it('stores a hashed code and emails it to a password user', async () => {
      const { authService, tokenService } = await loadAuthModules();
      const { supabase, queries, tables } = createSupabase([
        { result: { data: userRow(), error: null } },
        { result: { error: null } },
        { result: { error: null } },
      ]);

      const response = await authService.requestPasswordReset(supabase, {
        email: 'Rita@Example.com',
      });

      expect(response).toEqual({
        message: 'If an account exists, reset instructions have been sent.',
      });
      expect(mailer.sendPasswordResetEmail).toHaveBeenCalledTimes(1);

      const [to, code] = mailer.sendPasswordResetEmail.mock.calls[0] as [
        string,
        string,
      ];
      expect(to).toBe('rita@example.com');
      expect(code).toMatch(resetCodePattern);

      expect(tables).toEqual(['users', 'password_reset_tokens', 'password_reset_tokens']);

      const insertQuery = queries[2];
      expect(insertQuery.insert).toHaveBeenCalledTimes(1);

      const inserted = insertQuery.insert.mock.calls[0][0] as {
        user_id: string;
        code_hash: string;
        expires_at: string;
      };
      expect(inserted.user_id).toBe('user-1');
      expect(inserted.code_hash).toBe(tokenService.hashPasswordResetCode(code));
      expect(inserted.code_hash).toMatch(/^hmac-sha256:/);
      expect(inserted.code_hash).not.toContain(code);

      const expiresInMs = new Date(inserted.expires_at).getTime() - Date.now();
      expect(expiresInMs).toBeGreaterThan(29 * 60 * 1000);
      expect(expiresInMs).toBeLessThanOrEqual(30 * 60 * 1000);
    });

    it('deletes any prior reset tokens for the user', async () => {
      const { authService } = await loadAuthModules();
      const { supabase, queries, tables } = createSupabase([
        { result: { data: userRow(), error: null } },
        { result: { error: null } },
        { result: { error: null } },
      ]);

      await authService.requestPasswordReset(supabase, {
        email: 'rita@example.com',
      });

      const deleteQuery = queries[1];
      expect(tables[1]).toBe('password_reset_tokens');
      expect(deleteQuery.delete).toHaveBeenCalledTimes(1);
      expect(deleteQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('returns the generic message without sending for an unknown email', async () => {
      const { authService } = await loadAuthModules();
      const { supabase, tables } = createSupabase([
        { result: { data: null, error: null } },
      ]);

      const response = await authService.requestPasswordReset(supabase, {
        email: 'nobody@example.com',
      });

      expect(response).toEqual({
        message: 'If an account exists, reset instructions have been sent.',
      });
      expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(tables).toEqual(['users']);
    });

    it('returns the generic message without sending for a Google-only account', async () => {
      const { authService } = await loadAuthModules();
      const { supabase, tables } = createSupabase([
        { result: { data: userRow({ password_hash: null }), error: null } },
      ]);

      const response = await authService.requestPasswordReset(supabase, {
        email: 'rita@example.com',
      });

      expect(response).toEqual({
        message: 'If an account exists, reset instructions have been sent.',
      });
      expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(tables).toEqual(['users']);
    });

    it('returns the generic message and warns without sending when SMTP is unconfigured', async () => {
      const { authService } = await loadAuthModules({ smtpConfigured: false });
      const { supabase, tables } = createSupabase([
        { result: { data: userRow(), error: null } },
      ]);
      const logger = { warn: vi.fn(), error: vi.fn() };

      const response = await authService.requestPasswordReset(
        supabase,
        { email: 'rita@example.com' },
        logger,
      );

      expect(response).toEqual({
        message: 'If an account exists, reset instructions have been sent.',
      });
      expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(tables).toEqual(['users']);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('still returns the generic message when the email fails to send', async () => {
      const { authService } = await loadAuthModules();
      const { supabase } = createSupabase([
        { result: { data: userRow(), error: null } },
        { result: { error: null } },
        { result: { error: null } },
      ]);
      const logger = { warn: vi.fn(), error: vi.fn() };
      mailer.sendPasswordResetEmail.mockRejectedValueOnce(
        new Error('SMTP connection refused'),
      );

      const response = await authService.requestPasswordReset(
        supabase,
        { email: 'rita@example.com' },
        logger,
      );

      expect(response).toEqual({
        message: 'If an account exists, reset instructions have been sent.',
      });
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirmPasswordReset', () => {
    function tokenRow(
      tokenService: { hashPasswordResetCode: (code: string) => string },
      code: string,
      overrides: Record<string, unknown> = {},
    ) {
      return {
        id: 'token-1',
        user_id: 'user-1',
        code_hash: tokenService.hashPasswordResetCode(code),
        expires_at: isoMinutesFromNow(20),
        consumed_at: null,
        ...overrides,
      };
    }

    it('updates the password, revokes sessions, and consumes the token', async () => {
      const { authService, tokenService } = await loadAuthModules();
      const code = 'ABCD2345';
      const { supabase, queries, tables } = createSupabase([
        { rows: [tokenRow(tokenService, code)] },
        { result: { error: null } },
        { result: { error: null } },
        { result: { error: null } },
      ]);

      await expect(
        authService.confirmPasswordReset(supabase, {
          token: code,
          password: 'new-strong-password',
        }),
      ).resolves.toBeUndefined();

      expect(tables).toEqual([
        'password_reset_tokens',
        'users',
        'sessions',
        'password_reset_tokens',
      ]);

      const passwordUpdate = queries[1];
      expect(passwordUpdate.update).toHaveBeenCalledTimes(1);
      const updatedUser = passwordUpdate.update.mock.calls[0][0] as {
        password_hash: string;
      };
      expect(updatedUser.password_hash).toMatch(/^\$argon2id\$/);
      await expect(
        authService.verifyPassword(
          updatedUser.password_hash,
          'new-strong-password',
        ),
      ).resolves.toBe(true);
      expect(passwordUpdate.eq).toHaveBeenCalledWith('id', 'user-1');

      const sessionRevoke = queries[2];
      expect(sessionRevoke.update).toHaveBeenCalledWith({
        revoked_at: expect.any(String),
      });
      expect(sessionRevoke.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(sessionRevoke.is).toHaveBeenCalledWith('revoked_at', null);

      const consumeUpdate = queries[3];
      expect(consumeUpdate.update).toHaveBeenCalledWith({
        consumed_at: expect.any(String),
      });
      expect(consumeUpdate.eq).toHaveBeenCalledWith('id', 'token-1');
    });

    it('accepts the code case-insensitively', async () => {
      const { authService, tokenService } = await loadAuthModules();
      const code = 'ABCD2345';
      const { supabase } = createSupabase([
        { rows: [tokenRow(tokenService, code)] },
        { result: { error: null } },
        { result: { error: null } },
        { result: { error: null } },
      ]);

      await expect(
        authService.confirmPasswordReset(supabase, {
          token: '  abcd2345  ',
          password: 'new-strong-password',
        }),
      ).resolves.toBeUndefined();
    });

    it('rejects an expired code with 422', async () => {
      const { authService, tokenService } = await loadAuthModules();
      const code = 'ABCD2345';
      const { supabase, tables } = createSupabase([
        {
          rows: [
            tokenRow(tokenService, code, {
              expires_at: isoMinutesFromNow(-5),
            }),
          ],
        },
      ]);

      await expect(
        authService.confirmPasswordReset(supabase, {
          token: code,
          password: 'new-strong-password',
        }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'invalid_reset_code',
      });
      expect(tables).toEqual(['password_reset_tokens']);
    });

    it('rejects an already consumed code with 422', async () => {
      const { authService, tokenService } = await loadAuthModules();
      const code = 'ABCD2345';
      const { supabase } = createSupabase([
        {
          rows: [
            tokenRow(tokenService, code, {
              consumed_at: isoMinutesFromNow(-1),
            }),
          ],
        },
      ]);

      await expect(
        authService.confirmPasswordReset(supabase, {
          token: code,
          password: 'new-strong-password',
        }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'invalid_reset_code',
      });
    });

    it('rejects a wrong code with 422', async () => {
      const { authService, tokenService } = await loadAuthModules();
      const { supabase } = createSupabase([
        { rows: [tokenRow(tokenService, 'ABCD2345')] },
      ]);

      await expect(
        authService.confirmPasswordReset(supabase, {
          token: 'WXYZ6789',
          password: 'new-strong-password',
        }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'invalid_reset_code',
      });
    });
  });
});
