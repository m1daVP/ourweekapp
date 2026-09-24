import { createHash } from 'node:crypto';

import type { FastifyBaseLogger } from 'fastify';
import { google } from 'googleapis';

import { env } from '../../config/env.js';
import { ApiError } from '../../shared/errors/index.js';

export type VerifiedGoogleIdentity = {
  subject: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type GoogleAuthProvider = {
  configured: boolean;
  verifyIdToken(
    idToken: string,
    logger?: GoogleAuthDiagnosticsLogger,
  ): Promise<VerifiedGoogleIdentity>;
};

const invalidGoogleTokenError = new ApiError(
  401,
  'invalid_google_token',
  'Google sign-in could not be verified.',
);

type GoogleAuthDiagnosticsLogger = Pick<FastifyBaseLogger, 'warn'>;

function safeHash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function maskClientId(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length <= 24) {
    return '[short-value]';
  }

  return `...${normalized.slice(-24)}`;
}

function parseJwtPayload(idToken: string) {
  const [, payloadSegment] = idToken.split('.');

  if (!payloadSegment) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(payloadSegment, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function safeIssuer(value: unknown) {
  if (
    value === 'accounts.google.com' ||
    value === 'https://accounts.google.com'
  ) {
    return value;
  }

  return typeof value === 'string' ? 'unrecognized' : undefined;
}

function safeAudience(value: unknown) {
  if (typeof value === 'string') {
    return {
      hash: safeHash(value),
      masked: maskClientId(value),
    };
  }

  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => ({
        hash: safeHash(entry),
        masked: maskClientId(entry),
      }));
  }

  return undefined;
}

function googleTokenDiagnostics(idToken: string) {
  const payload = parseJwtPayload(idToken);

  return {
    configuredClientIdCount: env.GOOGLE_SIGN_IN_CLIENT_IDS.length,
    configuredClientIdHashes: env.GOOGLE_SIGN_IN_CLIENT_IDS.map(safeHash),
    idTokenClaims: payload
      ? {
          issuer: safeIssuer(payload.iss),
          audience: safeAudience(payload.aud),
          emailVerified:
            typeof payload.email_verified === 'boolean'
              ? payload.email_verified
              : undefined,
        }
      : {
          parseable: false,
        },
  };
}

function logInvalidGoogleToken(
  reason: 'verification_failed' | 'payload_invalid',
  idToken: string,
  logger?: GoogleAuthDiagnosticsLogger,
) {
  logger?.warn(
    {
      code: invalidGoogleTokenError.code,
      reason,
      googleSignIn: googleTokenDiagnostics(idToken),
    },
    'Google ID token verification failed',
  );
}

export const googleAuthProvider: GoogleAuthProvider = {
  configured: env.GOOGLE_SIGN_IN_CONFIGURED,

  async verifyIdToken(idToken: string, logger?: GoogleAuthDiagnosticsLogger) {
    if (!env.GOOGLE_SIGN_IN_CONFIGURED) {
      throw new ApiError(
        500,
        'google_sign_in_not_configured',
        'Google sign-in is not configured.',
      );
    }

    let ticket;

    try {
      ticket = await new google.auth.OAuth2().verifyIdToken({
        idToken,
        audience: env.GOOGLE_SIGN_IN_CLIENT_IDS,
      });
    } catch {
      logInvalidGoogleToken('verification_failed', idToken, logger);
      throw invalidGoogleTokenError;
    }

    const payload = ticket.getPayload();

    if (
      !payload?.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      logInvalidGoogleToken('payload_invalid', idToken, logger);
      throw invalidGoogleTokenError;
    }

    return {
      subject: payload.sub,
      email: payload.email,
      displayName: payload.name ?? null,
      avatarUrl: payload.picture ?? null,
    };
  },
};
