import { beforeEach, describe, expect, it, vi } from 'vitest';

const testEnv = {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  PUBLIC_API_BASE_URL: 'http://localhost:3000/v1',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_ANON_KEY: 'anon-key',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/weekly_us_test',
  ACCESS_TOKEN_SECRET: 'access-token-secret-at-least-32-bytes',
  REFRESH_TOKEN_SECRET: 'refresh-token-secret-at-least-32-bytes',
  PASSWORD_RESET_TOKEN_SECRET: 'password-reset-secret-at-least-32-bytes',
  TOKEN_ENCRYPTION_KEY: 'token-encryption-key-at-least-32-byte',
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_DAYS: '30',
};

async function loadTokenService() {
  vi.resetModules();
  Object.assign(process.env, testEnv);

  return import('../src/modules/auth/token.service.js');
}

describe('token.service', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('issues access tokens with auth context claims', async () => {
    const { issueAccessToken, verifyAccessToken } = await loadTokenService();

    const token = await issueAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      workspaceId: 'workspace-1',
      role: 'owner',
    });

    const claims = await verifyAccessToken(token);

    expect(claims).toMatchObject({
      sub: 'user-1',
      sessionId: 'session-1',
      workspaceId: 'workspace-1',
      role: 'owner',
    });
    expect(claims.iat).toEqual(expect.any(Number));
    expect(claims.exp).toEqual(expect.any(Number));
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it('hashes and verifies refresh tokens without storing the raw token', async () => {
    const {
      generateRefreshToken,
      hashRefreshToken,
      verifyRefreshTokenHash,
    } = await loadTokenService();

    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);

    expect(refreshToken).toHaveLength(86);
    expect(refreshTokenHash).not.toContain(refreshToken);
    expect(verifyRefreshTokenHash(refreshToken, refreshTokenHash)).toBe(true);
    expect(verifyRefreshTokenHash(`${refreshToken}x`, refreshTokenHash)).toBe(
      false,
    );
  });

  it('rotates refresh token sessions after validating the current token', async () => {
    const {
      issueRefreshTokenSession,
      rotateRefreshTokenSession,
      verifyRefreshTokenHash,
    } = await loadTokenService();

    const current = issueRefreshTokenSession(new Date('2026-06-05T00:00:00Z'));
    const next = rotateRefreshTokenSession(
      current.refreshToken,
      current.refreshTokenHash,
      new Date('2026-06-06T00:00:00Z'),
    );

    expect(next.refreshToken).not.toBe(current.refreshToken);
    expect(next.refreshTokenHash).not.toBe(current.refreshTokenHash);
    expect(verifyRefreshTokenHash(next.refreshToken, next.refreshTokenHash)).toBe(
      true,
    );
    expect(next.expiresAt.toISOString()).toBe('2026-07-06T00:00:00.000Z');
    expect(() =>
      rotateRefreshTokenSession('wrong-token', current.refreshTokenHash),
    ).toThrow('Invalid refresh token');
  });
});
