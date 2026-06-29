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
  verifyIdToken(idToken: string): Promise<VerifiedGoogleIdentity>;
};

const invalidGoogleTokenError = new ApiError(
  401,
  'invalid_google_token',
  'Google sign-in could not be verified.',
);

export const googleAuthProvider: GoogleAuthProvider = {
  configured: env.GOOGLE_SIGN_IN_CONFIGURED,

  async verifyIdToken(idToken: string) {
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
      throw invalidGoogleTokenError;
    }

    const payload = ticket.getPayload();

    if (
      !payload?.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
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
