import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { SignJWT, jwtVerify } from 'jose';

import { env } from '../../config/env.js';
import type { UserRole } from '../../shared/auth/index.js';

const accessTokenSecret = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);
const accessTokenAlgorithm = 'HS256';
const refreshTokenByteLength = 64;
const refreshTokenHashPrefix = 'hmac-sha256:';

export type AccessTokenClaims = {
  sub: string;
  sessionId: string;
  workspaceId: string;
  role: UserRole;
  iat: number;
  exp: number;
};

export type IssueAccessTokenInput = {
  userId: string;
  sessionId: string;
  workspaceId: string;
  role: UserRole;
};

export type RefreshTokenSession = {
  refreshToken: string;
  refreshTokenHash: string;
  expiresAt: Date;
};

function isUserRole(value: unknown): value is UserRole {
  return value === 'owner' || value === 'adult_member' || value === 'viewer';
}

function requireStringClaim(value: unknown, claim: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid access token ${claim} claim`);
  }

  return value;
}

function toAccessTokenClaims(payload: Record<string, unknown>): AccessTokenClaims {
  const role = payload.role;

  if (!isUserRole(role)) {
    throw new Error('Invalid access token role claim');
  }

  if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
    throw new Error('Invalid access token timestamp claims');
  }

  return {
    sub: requireStringClaim(payload.sub, 'sub'),
    sessionId: requireStringClaim(payload.sessionId, 'sessionId'),
    workspaceId: requireStringClaim(payload.workspaceId, 'workspaceId'),
    role,
    iat: payload.iat,
    exp: payload.exp,
  };
}

export async function issueAccessToken(input: IssueAccessTokenInput) {
  return new SignJWT({
    sub: input.userId,
    sessionId: input.sessionId,
    workspaceId: input.workspaceId,
    role: input.role,
  })
    .setProtectedHeader({ alg: accessTokenAlgorithm })
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(accessTokenSecret);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, accessTokenSecret, {
    algorithms: [accessTokenAlgorithm],
  });

  return toAccessTokenClaims(payload);
}

export function generateRefreshToken() {
  return randomBytes(refreshTokenByteLength).toString('base64url');
}

export function hashRefreshToken(refreshToken: string) {
  const digest = createHmac('sha256', env.REFRESH_TOKEN_SECRET)
    .update(refreshToken, 'utf8')
    .digest('base64url');

  return `${refreshTokenHashPrefix}${digest}`;
}

export function verifyRefreshTokenHash(
  refreshToken: string,
  expectedRefreshTokenHash: string,
) {
  const actualHash = hashRefreshToken(refreshToken);
  const actual = Buffer.from(actualHash, 'utf8');
  const expected = Buffer.from(expectedRefreshTokenHash, 'utf8');

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function getRefreshTokenExpiresAt(now = new Date()) {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_TTL_DAYS);

  return expiresAt;
}

export function issueRefreshTokenSession(now = new Date()): RefreshTokenSession {
  const refreshToken = generateRefreshToken();

  return {
    refreshToken,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshTokenExpiresAt(now),
  };
}

export function rotateRefreshTokenSession(
  currentRefreshToken: string,
  currentRefreshTokenHash: string,
  now = new Date(),
): RefreshTokenSession {
  if (!verifyRefreshTokenHash(currentRefreshToken, currentRefreshTokenHash)) {
    throw new Error('Invalid refresh token');
  }

  return issueRefreshTokenSession(now);
}
