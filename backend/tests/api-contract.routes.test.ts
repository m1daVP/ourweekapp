import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authContext = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  workspaceId: '33333333-3333-4333-8333-333333333333',
  role: 'owner',
  planType: 'free',
};

const now = '2026-06-07T12:00:00.000Z';
const meetingId = '44444444-4444-4444-8444-444444444444';
const participantId = '55555555-5555-4555-8555-555555555555';
const userId = '66666666-6666-4666-8666-666666666666';

const syncParticipantsWithSupabase = vi.hoisted(() => vi.fn());
const meetingsService = vi.hoisted(() => ({
  listMeetings: vi.fn(),
  saveMeetingSummary: vi.fn(),
  syncMeetings: vi.fn(),
}));
const tasksService = vi.hoisted(() => ({
  listTasks: vi.fn(),
  syncTasks: vi.fn(),
}));
const workspaceService = vi.hoisted(() => ({
  createInvitation: vi.fn(),
  getWorkspace: vi.fn(),
  removeMember: vi.fn(),
  updateMember: vi.fn(),
  updateWorkspace: vi.fn(),
}));
const subscriptionService = vi.hoisted(() => ({
  getManageUrl: vi.fn(),
  getStatus: vi.fn(),
  restore: vi.fn(),
  validate: vi.fn(),
}));
const signInUser = vi.hoisted(() => vi.fn());
const signInWithGoogle = vi.hoisted(() => vi.fn());
const authMe = vi.hoisted(() => vi.fn());

Object.assign(process.env, {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  PUBLIC_API_BASE_URL: 'http://localhost:3000/v1',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ACCESS_TOKEN_SECRET: 'access-token-secret-at-least-32-bytes',
  REFRESH_TOKEN_SECRET: 'refresh-token-secret-at-least-32-bytes',
  PASSWORD_RESET_TOKEN_SECRET: 'password-reset-secret-at-least-32-bytes',
  TOKEN_ENCRYPTION_KEY: 'token-encryption-key-at-least-32-byte',
});

vi.mock('../src/modules/auth/auth.middleware.js', async () => {
  const { ApiError } = await vi.importActual<typeof import('../src/shared/errors/index.js')>(
    '../src/shared/errors/index.js',
  );

  const authenticate = () => async (request: {
    headers: { authorization?: string };
    auth?: unknown;
  }) => {
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new ApiError(401, 'unauthenticated', 'Authentication is required.');
    }

    if (authorization === 'Bearer viewer-token') {
      request.auth = { ...authContext, role: 'viewer' };
      return;
    }

    if (authorization === 'Bearer valid-token') {
      request.auth = authContext;
      return;
    }

    throw new ApiError(401, 'unauthenticated', 'Authentication is required.');
  };

  return {
    buildAuthPreHandler: authenticate,
    requireAuth: authenticate,
  };
});

vi.mock('../src/modules/participants/participants.service.js', () => ({
  syncParticipantsWithSupabase,
}));

vi.mock('../src/modules/meetings/meetings.service.js', () => ({
  createDefaultMeetingsService: () => meetingsService,
}));

vi.mock('../src/modules/tasks/tasks.service.js', () => ({
  createDefaultTasksService: () => tasksService,
}));

vi.mock('../src/modules/workspace/workspace.service.js', () => ({
  WorkspaceService: {
    fromSupabase: () => workspaceService,
  },
}));

vi.mock('../src/modules/billing/billing.service.js', () => ({
  SubscriptionService: vi.fn(function SubscriptionService() {
    return subscriptionService;
  }),
}));

vi.mock('../src/modules/billing/revenuecat.client.js', () => ({
  RevenueCatClient: vi.fn(function RevenueCatClient() {}),
}));

vi.mock('../src/modules/billing/subscriptions.repository.js', () => ({
  SubscriptionsRepository: vi.fn(function SubscriptionsRepository() {}),
}));

vi.mock('../src/modules/auth/auth.service.js', () => ({
  confirmPasswordReset: vi.fn(),
  getCurrentUser: authMe,
  refreshSession: vi.fn(),
  registerUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  signInWithGoogle,
  signInUser,
  signOutUser: vi.fn(),
}));

async function buildRouteApp(
  routeName:
    | 'auth'
    | 'billing'
    | 'meetings'
    | 'participants'
    | 'tasks'
    | 'workspace',
) {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  const { registerErrorHandler } = await import('../src/shared/errors/error-handler.js');

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await app.register(rateLimit);
  app.decorate('supabase', {});

  if (routeName === 'auth') {
    const { authRoutes } = await import('../src/modules/auth/auth.routes.js');
    await app.register(authRoutes, { prefix: '/v1/auth' });
  }

  if (routeName === 'billing') {
    const { billingRoutes } = await import('../src/modules/billing/billing.routes.js');
    await app.register(billingRoutes, { prefix: '/v1/subscriptions' });
  }

  if (routeName === 'meetings') {
    const { meetingsRoutes } = await import('../src/modules/meetings/meetings.routes.js');
    await app.register(meetingsRoutes, { prefix: '/v1/meetings' });
  }

  if (routeName === 'participants') {
    const { participantRoutes } = await import('../src/modules/participants/participants.routes.js');
    await app.register(participantRoutes, { prefix: '/v1/participants' });
  }

  if (routeName === 'tasks') {
    const { tasksRoutes } = await import('../src/modules/tasks/tasks.routes.js');
    await app.register(tasksRoutes, { prefix: '/v1/tasks' });
  }

  if (routeName === 'workspace') {
    const { workspaceRoutes } = await import('../src/modules/workspace/workspace.routes.js');
    await app.register(workspaceRoutes, { prefix: '/v1/workspace' });
  }

  return app;
}

function participantPayload() {
  return {
    participants: [
      {
        id: participantId,
        name: 'Rita',
        initials: 'R',
        avatarColor: '#7A8C6B',
        type: 'adult',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        serverRevision: 1,
      },
    ],
    clientUpdatedAt: now,
  };
}

function meetingPayload() {
  return {
    id: meetingId,
    templateId: 'weekly-family-check-in',
    title: 'Weekly check-in',
    status: 'draft',
    participantIds: [participantId],
    sections: [
      {
        id: 'section-1',
        notes: [],
        tasks: [],
        agreements: [
          {
            id: 'agreement-1',
            text: 'Alternate pickup',
            participantIds: [participantId],
          },
        ],
      },
    ],
    currentSectionIndex: 0,
    createdAt: now,
    updatedAt: now,
    serverRevision: 1,
  };
}

function taskPayload() {
  return {
    id: 'task-1',
    title: 'Buy groceries',
    responsibilityType: 'participant',
    responsibleParticipantIds: [participantId],
    status: 'open',
    sourceMeetingId: meetingId,
    createdAt: now,
    updatedAt: now,
    serverRevision: 1,
  };
}

function authSessionResponse() {
  return {
    user: {
      id: authContext.userId,
      email: 'rita@example.com',
      displayName: 'Rita',
      role: 'owner',
      planType: 'free',
      createdAt: now,
      updatedAt: now,
    },
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: now,
  };
}

describe('API route contracts', () => {
  beforeEach(() => {
    syncParticipantsWithSupabase.mockReset();
    meetingsService.listMeetings.mockReset();
    meetingsService.saveMeetingSummary.mockReset();
    meetingsService.syncMeetings.mockReset();
    tasksService.listTasks.mockReset();
    tasksService.syncTasks.mockReset();
    workspaceService.createInvitation.mockReset();
    workspaceService.getWorkspace.mockReset();
    workspaceService.removeMember.mockReset();
    workspaceService.updateMember.mockReset();
    workspaceService.updateWorkspace.mockReset();
    subscriptionService.getManageUrl.mockReset();
    subscriptionService.getStatus.mockReset();
    subscriptionService.restore.mockReset();
    subscriptionService.validate.mockReset();
    signInUser.mockReset();
    signInWithGoogle.mockReset();
    authMe.mockReset();
  });

  it('returns 401 before participant sync service code runs', async () => {
    const app = await buildRouteApp('participants');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/participants/sync',
      payload: participantPayload(),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'unauthenticated' });
    expect(syncParticipantsWithSupabase).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 422 for invalid participant sync input', async () => {
    const app = await buildRouteApp('participants');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/participants/sync',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        participants: [
          {
            ...participantPayload().participants[0],
            avatarColor: 'green',
          },
        ],
        clientUpdatedAt: now,
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'validation_failed' });
    expect(syncParticipantsWithSupabase).not.toHaveBeenCalled();
    await app.close();
  });

  it('passes authenticated workspace context into meeting sync', async () => {
    meetingsService.syncMeetings.mockResolvedValueOnce({
      meetings: [meetingPayload()],
      activeMeetingId: meetingId,
      draftSavedAt: null,
      conflicts: [],
      syncedAt: now,
    });
    const app = await buildRouteApp('meetings');
    const body = {
      meetings: [meetingPayload()],
      activeMeetingId: meetingId,
      draftSavedAt: null,
      clientUpdatedAt: now,
    };
    const response = await app.inject({
      method: 'POST',
      url: '/v1/meetings/sync',
      headers: { authorization: 'Bearer valid-token' },
      payload: body,
    });

    expect(response.statusCode).toBe(200);
    expect(meetingsService.syncMeetings).toHaveBeenCalledWith(authContext, body);
    await app.close();
  });

  it('returns 409 from the meeting summary conflict path', async () => {
    const { ApiError } = await import('../src/shared/errors/index.js');
    meetingsService.saveMeetingSummary.mockRejectedValueOnce(
      new ApiError(409, 'meeting_update_conflict', 'Meeting changed while saving summary.'),
    );
    const app = await buildRouteApp('meetings');
    const response = await app.inject({
      method: 'PUT',
      url: `/v1/meetings/${meetingId}/summary`,
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        summary: {
          id: 'summary-1',
          meetingId,
          shortSummary: 'Done',
          mainTopics: [],
          keyTensions: [],
          agreements: [],
          tasks: [],
          suggestedNextMeetingFocus: [],
          createdAt: now,
        },
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'meeting_update_conflict' });
    await app.close();
  });

  it('returns 403 from task sync before mutating data', async () => {
    const { ApiError } = await import('../src/shared/errors/index.js');
    tasksService.syncTasks.mockRejectedValueOnce(
      new ApiError(403, 'forbidden', 'You do not have permission to do that.'),
    );
    const app = await buildRouteApp('tasks');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/tasks/sync',
      headers: { authorization: 'Bearer viewer-token' },
      payload: {
        tasks: [taskPayload()],
        agreements: [],
        reviewDecisions: [],
        clientUpdatedAt: now,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
    await app.close();
  });

  it('maps subscription service authorization failures to 403 responses', async () => {
    const { ApiError } = await import('../src/shared/errors/index.js');
    subscriptionService.validate.mockRejectedValueOnce(
      new ApiError(403, 'subscription_owner_required', 'Only workspace owners can manage subscriptions.'),
    );
    const app = await buildRouteApp('billing');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/subscriptions/validate',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        provider: 'google_play',
        purchaseToken: 'purchase-token',
        productId: 'weekly_us_premium_monthly',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'subscription_owner_required' });
    expect(subscriptionService.validate).toHaveBeenCalled();
    await app.close();
  });

  it('returns 422 before subscription service code for invalid providers', async () => {
    const app = await buildRouteApp('billing');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/subscriptions/validate',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        provider: 'revenuecat',
        purchaseToken: 'purchase-token',
        productId: 'weekly_us_premium_monthly',
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'validation_failed' });
    expect(subscriptionService.validate).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 409 for duplicate workspace invitations', async () => {
    const { ApiError } = await import('../src/shared/errors/index.js');
    workspaceService.createInvitation.mockRejectedValueOnce(
      new ApiError(409, 'workspace_member_already_exists', 'This member already exists.'),
    );
    const app = await buildRouteApp('workspace');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/workspace/invitations',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        email: 'alex@example.com',
        displayName: 'Alex',
        role: 'adult_member',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'workspace_member_already_exists' });
    await app.close();
  });

  it('returns 422 before workspace member update service code for invalid bodies', async () => {
    const app = await buildRouteApp('workspace');
    const response = await app.inject({
      method: 'PUT',
      url: `/v1/workspace/members/${userId}`,
      headers: { authorization: 'Bearer valid-token' },
      payload: {},
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'validation_failed' });
    expect(workspaceService.updateMember).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 422 before workspace member update service code for invalid member IDs', async () => {
    const app = await buildRouteApp('workspace');
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/workspace/members/not-a-uuid',
      headers: { authorization: 'Bearer valid-token' },
      payload: { role: 'viewer' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'validation_failed' });
    expect(workspaceService.updateMember).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 422 before workspace member delete service code for invalid member IDs', async () => {
    const app = await buildRouteApp('workspace');
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/workspace/members/not-a-uuid',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'validation_failed' });
    expect(workspaceService.removeMember).not.toHaveBeenCalled();
    await app.close();
  });

  it('rate-limits repeated sign-in attempts with 429', async () => {
    signInUser.mockResolvedValue(authSessionResponse());
    const app = await buildRouteApp('auth');
    const payload = {
      email: 'rita@example.com',
      password: 'correct-password',
    };

    const responses = [];
    for (let index = 0; index < 6; index += 1) {
      responses.push(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/sign-in',
          payload,
          remoteAddress: '198.51.100.10',
        }),
      );
    }

    expect(responses.slice(0, 5).map((response) => response.statusCode))
      .toEqual([200, 200, 200, 200, 200]);
    expect(responses[5]?.statusCode).toBe(429);
    expect(signInUser).toHaveBeenCalledTimes(5);
    await app.close();
  });

  it('routes Google sign-in through the auth service', async () => {
    signInWithGoogle.mockResolvedValueOnce(authSessionResponse());
    const app = await buildRouteApp('auth');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: {
        idToken: 'google-id-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        id: authContext.userId,
        email: 'rita@example.com',
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(signInWithGoogle).toHaveBeenCalledWith(
      {},
      {
        idToken: 'google-id-token',
      },
      undefined,
      expect.any(Object),
    );
    await app.close();
  });

  it('returns 422 before Google sign-in service code for invalid bodies', async () => {
    const app = await buildRouteApp('auth');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: {},
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'validation_failed' });
    expect(signInWithGoogle).not.toHaveBeenCalled();
    await app.close();
  });

  it('rate-limits repeated Google sign-in attempts with 429', async () => {
    signInWithGoogle.mockResolvedValue(authSessionResponse());
    const app = await buildRouteApp('auth');
    const payload = {
      idToken: 'google-id-token',
    };

    const responses = [];
    for (let index = 0; index < 6; index += 1) {
      responses.push(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/google',
          payload,
          remoteAddress: '198.51.100.20',
        }),
      );
    }

    expect(responses.slice(0, 5).map((response) => response.statusCode))
      .toEqual([200, 200, 200, 200, 200]);
    expect(responses[5]?.statusCode).toBe(429);
    expect(signInWithGoogle).toHaveBeenCalledTimes(5);
    await app.close();
  });

  it('returns 401 for /auth/me without a valid session', async () => {
    const { ApiError } = await import('../src/shared/errors/index.js');
    authMe.mockRejectedValueOnce(
      new ApiError(401, 'invalid_session', 'Authentication is required.'),
    );
    const app = await buildRouteApp('auth');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: 'Bearer expired-token' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'invalid_session' });
    await app.close();
  });
});
