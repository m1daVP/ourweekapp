import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireAuth } from '../auth/auth.middleware.js';
import { errorResponseSchema } from '../../shared/schemas/index.js';
import {
  createWorkspaceInvitationRequestSchema,
  createWorkspaceInvitationResponseSchema,
  linkParticipantToExistingMemberRequestSchema,
  participantAccessAssociationSchema,
  participantMemberLinkParamsSchema,
  updateWorkspaceMemberRequestSchema,
  updateWorkspaceRequestSchema,
  workspaceInvitationParamsSchema,
  workspaceMemberParamsSchema,
  workspaceMemberSchema,
  workspaceSchema,
} from './workspace.schema.js';
import { WorkspaceService } from './workspace.service.js';

const workspaceErrorResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  422: errorResponseSchema,
  503: errorResponseSchema,
  500: errorResponseSchema,
};

export const workspaceRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = WorkspaceService.fromSupabase(app.supabase);
  const authPreHandler = requireAuth(app);

  app.get('/', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      response: {
        200: workspaceSchema,
        ...workspaceErrorResponses,
      },
    },
  }, async (request) => {
    return service.getWorkspace(request.auth);
  });

  app.put('/', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      body: updateWorkspaceRequestSchema,
      response: {
        200: workspaceSchema,
        ...workspaceErrorResponses,
      },
    },
  }, async (request) => {
    return service.updateWorkspace(request.auth, request.body);
  });

  app.post('/invitations', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      body: createWorkspaceInvitationRequestSchema,
      response: {
        201: createWorkspaceInvitationResponseSchema,
        ...workspaceErrorResponses,
      },
    },
  }, async (request, reply) => {
    const invitation = await service.createInvitation(request.auth, request.body);

    return reply.status(201).send(invitation);
  });

  app.post('/invitations/:invitationId/resend', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      params: workspaceInvitationParamsSchema,
      response: {
        200: createWorkspaceInvitationResponseSchema,
        ...workspaceErrorResponses,
      },
    },
  }, async (request) => {
    return service.resendInvitation(request.auth, request.params.invitationId);
  });

  app.post('/participants/:participantId/link-member', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      params: participantMemberLinkParamsSchema,
      body: linkParticipantToExistingMemberRequestSchema,
      response: {
        200: participantAccessAssociationSchema,
        ...workspaceErrorResponses,
      },
    },
  }, async (request) => {
    return service.linkParticipantToExistingMember(
      request.auth,
      request.params.participantId,
      request.body,
    );
  });

  app.delete('/invitations/:invitationId', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      params: workspaceInvitationParamsSchema,
      response: {
        204: z.null(),
        ...workspaceErrorResponses,
      },
    },
  }, async (request, reply) => {
    await service.revokeInvitation(request.auth, request.params.invitationId);

    return reply.status(204).send(null);
  });

  app.put('/members/:userId', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      params: workspaceMemberParamsSchema,
      body: updateWorkspaceMemberRequestSchema,
      response: {
        200: workspaceMemberSchema,
        ...workspaceErrorResponses,
      },
    },
  }, async (request) => {
    return service.updateMember(
      request.auth,
      request.params.userId,
      request.body,
    );
  });

  app.delete('/members/:userId', {
    config: {
      authRequired: true,
    },
    preHandler: authPreHandler,
    schema: {
      params: workspaceMemberParamsSchema,
      response: {
        204: z.null(),
        ...workspaceErrorResponses,
      },
    },
  }, async (request, reply) => {
    await service.removeMember(request.auth, request.params.userId);

    return reply.status(204).send(null);
  });
};
