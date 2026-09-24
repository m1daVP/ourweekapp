import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { errorResponseSchema } from '../../shared/schemas/index.js';
import { requireAuth } from './auth.middleware.js';
import {
  acceptWorkspaceInvitationRequestSchema,
  authMeResponseSchema,
  authSessionResponseSchema,
  googleSignInRequestSchema,
  googleLinkRequestSchema,
  passwordResetConfirmRequestSchema,
  passwordResetRequestResponseSchema,
  passwordResetRequestSchema,
  refreshTokenRequestSchema,
  registerRequestSchema,
  signInRequestSchema,
  signOutRequestSchema,
} from './auth.schema.js';
import {
  acceptWorkspaceInvitation,
  confirmPasswordReset,
  getCurrentUser,
  linkGoogleIdentityForAuthenticatedUser,
  refreshSession,
  registerUser,
  requestPasswordReset,
  signInWithGoogle,
  signInUser,
  signOutUser,
} from './auth.service.js';

const authErrorResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  409: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
};

const authRateLimitedErrorResponses = {
  ...authErrorResponses,
  429: errorResponseSchema,
};

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const authPreHandler = requireAuth(app);

  app.post('/register', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
    schema: {
      body: registerRequestSchema,
      response: {
        201: authSessionResponseSchema,
        ...authRateLimitedErrorResponses,
      },
    },
  }, async (request, reply) => {
    const session = await registerUser(app.supabase, request.body);

    return reply.status(201).send(session);
  });

  app.post('/sign-in', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
    schema: {
      body: signInRequestSchema,
      response: {
        200: authSessionResponseSchema,
        ...authRateLimitedErrorResponses,
      },
    },
  }, async (request) => {
    return signInUser(app.supabase, request.body);
  });

  app.post('/google', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
    schema: {
      body: googleSignInRequestSchema,
      response: {
        200: authSessionResponseSchema,
        ...authRateLimitedErrorResponses,
      },
    },
  }, async (request) => {
    return signInWithGoogle(
      app.supabase,
      request.body,
      undefined,
      request.log,
    );
  });

  app.post('/refresh', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
    schema: {
      body: refreshTokenRequestSchema,
      response: {
        200: authSessionResponseSchema,
        ...authRateLimitedErrorResponses,
      },
    },
  }, async (request) => {
    return refreshSession(app.supabase, request.body);
  });

  app.post('/sign-out', {
    config: {
      authRequired: true,
    },
    schema: {
      body: signOutRequestSchema,
      response: {
        204: z.null(),
        ...authErrorResponses,
      },
    },
  }, async (request, reply) => {
    await signOutUser(
      app.supabase,
      request.body,
      request.headers.authorization,
    );

    return reply.status(204).send(null);
  });

  app.post('/google/link', {
    config: {
      authRequired: true,
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
    preHandler: authPreHandler,
    schema: {
      body: googleLinkRequestSchema,
      response: {
        200: authMeResponseSchema,
        ...authRateLimitedErrorResponses,
      },
    },
  }, async (request) => {
    return linkGoogleIdentityForAuthenticatedUser(
      app.supabase,
      request.auth,
      request.body,
      undefined,
      request.log,
    );
  });

  app.post('/invitations/accept', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      body: acceptWorkspaceInvitationRequestSchema,
      response: {
        200: authSessionResponseSchema,
        ...authErrorResponses,
      },
    },
  }, async (request) => {
    return acceptWorkspaceInvitation(app.supabase, request.auth, request.body);
  });

  app.get('/me', {
    config: {
      authRequired: true,
    },
    schema: {
      response: {
        200: authMeResponseSchema,
        ...authErrorResponses,
      },
    },
  }, async (request) => {
    return getCurrentUser(app.supabase, request.headers.authorization);
  });

  app.post('/password-reset/request', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '15 minutes',
      },
    },
    schema: {
      body: passwordResetRequestSchema,
      response: {
        200: passwordResetRequestResponseSchema,
        ...authRateLimitedErrorResponses,
      },
    },
  }, async (request) => {
    return requestPasswordReset(app.supabase, request.body, request.log);
  });

  app.post('/password-reset/confirm', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '15 minutes',
      },
    },
    schema: {
      body: passwordResetConfirmRequestSchema,
      response: {
        204: z.null(),
        ...authRateLimitedErrorResponses,
      },
    },
  }, async (request, reply) => {
    await confirmPasswordReset(app.supabase, request.body);

    return reply.status(204).send(null);
  });
};
