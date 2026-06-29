import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeGenerateMeetingSummary = vi.hoisted(() => vi.fn());

Object.assign(process.env, {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  PUBLIC_API_BASE_URL: 'http://localhost:3000/v1',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_ANON_KEY: 'anon-key',
  ACCESS_TOKEN_SECRET: 'access-token-secret-at-least-32-bytes',
  REFRESH_TOKEN_SECRET: 'refresh-token-secret-at-least-32-bytes',
  PASSWORD_RESET_TOKEN_SECRET: 'password-reset-secret-at-least-32-bytes',
  TOKEN_ENCRYPTION_KEY: 'token-encryption-key-at-least-32-byte',
  AI_PROVIDER: 'openai',
  AI_API_KEY: 'test-ai-key',
});

vi.mock('../src/modules/auth/auth.middleware.js', async () => {
  const { ApiError } = await vi.importActual<typeof import('../src/shared/errors/index.js')>(
    '../src/shared/errors/index.js',
  );

  return {
    buildAuthPreHandler: () => async (request: {
      headers: { authorization?: string };
      auth?: unknown;
    }) => {
      const authorization = request.headers.authorization;

      if (!authorization) {
        throw new ApiError(401, 'unauthenticated', 'Authentication is required.');
      }

      const baseAuth = {
        userId: '11111111-1111-4111-8111-111111111111',
        sessionId: '22222222-2222-4222-8222-222222222222',
        workspaceId: '33333333-3333-4333-8333-333333333333',
      };

      if (authorization === 'Bearer viewer-token') {
        request.auth = { ...baseAuth, role: 'viewer', planType: 'premium' };
        return;
      }

      if (authorization === 'Bearer free-token') {
        request.auth = { ...baseAuth, role: 'adult_member', planType: 'free' };
        return;
      }

      if (authorization === 'Bearer premium-token') {
        request.auth = { ...baseAuth, role: 'adult_member', planType: 'premium' };
        return;
      }

      throw new ApiError(401, 'unauthenticated', 'Authentication is required.');
    },
  };
});

vi.mock('../src/modules/billing/require-premium.middleware.js', async () => {
  const { ApiError } = await vi.importActual<typeof import('../src/shared/errors/index.js')>(
    '../src/shared/errors/index.js',
  );

  return {
    requirePremiumAdultMember: () => async (request: {
      auth?: { role?: string; planType?: string };
    }) => {
      if (request.auth?.role !== 'adult_member' && request.auth?.role !== 'owner') {
        throw new ApiError(403, 'forbidden', 'You do not have permission to do that.');
      }

      if (request.auth?.planType !== 'premium') {
        throw new ApiError(403, 'premium_required', 'Premium is required for this feature.');
      }
    },
  };
});

vi.mock('../src/modules/ai/ai.service.js', () => ({
  createDefaultAiSummaryService: () => ({
    generateMeetingSummary: routeGenerateMeetingSummary,
  }),
}));

async function buildAiRoutesApp() {
  const [{ aiRoutes }, { registerErrorHandler }] = await Promise.all([
    import('../src/modules/ai/ai.routes.js'),
    import('../src/shared/errors/error-handler.js'),
  ]);
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  app.decorate('supabase', {});
  await app.register(aiRoutes, { prefix: '/v1/ai' });

  return app;
}

describe('AI summary routes', () => {
  beforeEach(() => {
    routeGenerateMeetingSummary.mockReset();
  });

  it('selects the mock AI provider when configured', async () => {
    const { createAiSummaryProvider } = await import('../src/modules/ai/ai.routes.js');
    const provider = createAiSummaryProvider({
      AI_CONFIGURED: true,
      AI_PROVIDER: 'mock',
      AI_API_KEY: '',
    });

    await expect(
      provider.generateMeetingSummary({
        systemPrompt: 'system',
        userPrompt: 'user',
        model: 'test-model',
        maxOutputTokens: 800,
      }),
    ).resolves.toEqual({
      shortSummary:
        'Mock summary: this meeting was summarized with the local mock AI provider.',
      mainTopics: ['Mock main topic'],
      keyTensions: [],
      agreements: ['Mock agreement'],
      tasks: [],
      suggestedNextMeetingFocus: [
        'Review this mock summary before using real AI output',
      ],
    });
  });

  it('returns 401 for unauthenticated summary requests', async () => {
    const app = await buildAiRoutesApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/ai/meeting-summary',
      payload: { meetingId: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'unauthenticated' });
    expect(routeGenerateMeetingSummary).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 403 for insufficient role before the service is called', async () => {
    const app = await buildAiRoutesApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/ai/meeting-summary',
      headers: { authorization: 'Bearer viewer-token' },
      payload: { meetingId: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
    expect(routeGenerateMeetingSummary).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 403 for non-premium adult members before the service is called', async () => {
    const app = await buildAiRoutesApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/ai/meeting-summary',
      headers: { authorization: 'Bearer free-token' },
      payload: { meetingId: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'premium_required' });
    expect(routeGenerateMeetingSummary).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 422 for invalid request bodies', async () => {
    const app = await buildAiRoutesApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/ai/meeting-summary',
      headers: { authorization: 'Bearer premium-token' },
      payload: { locale: 'en' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'validation_failed' });
    expect(routeGenerateMeetingSummary).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns a successful AI summary response through route wiring', async () => {
    routeGenerateMeetingSummary.mockResolvedValueOnce({
      summary: {
        id: '44444444-4444-4444-8444-444444444444',
        meetingId: '11111111-1111-4111-8111-111111111111',
        shortSummary: 'You agreed on one practical next step.',
        mainTopics: ['Planning'],
        keyTensions: [],
        agreements: ['Alternate pickup'],
        tasks: [],
        suggestedNextMeetingFocus: ['Review the pickup plan'],
        createdAt: '2026-06-07T12:00:00.000Z',
      },
      disclaimer: 'AI summaries can miss context. Please review before relying on them.',
      generatedAt: '2026-06-07T12:00:00.000Z',
    });
    const app = await buildAiRoutesApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/ai/meeting-summary',
      headers: { authorization: 'Bearer premium-token' },
      payload: {
        meetingId: '11111111-1111-4111-8111-111111111111',
        locale: 'en',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: {
        meetingId: '11111111-1111-4111-8111-111111111111',
        shortSummary: 'You agreed on one practical next step.',
      },
      disclaimer: expect.stringContaining('AI summaries'),
      generatedAt: '2026-06-07T12:00:00.000Z',
    });
    expect(routeGenerateMeetingSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '11111111-1111-4111-8111-111111111111',
        workspaceId: '33333333-3333-4333-8333-333333333333',
        planType: 'premium',
      }),
      {
        meetingId: '11111111-1111-4111-8111-111111111111',
        locale: 'en',
      },
    );
    await app.close();
  });
});
