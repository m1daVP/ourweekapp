import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeExportMeeting = vi.hoisted(() => vi.fn());

vi.mock('../src/modules/auth/auth.middleware.js', async () => {
  const { ApiError } = await vi.importActual<typeof import('../src/shared/errors/index.js')>(
    '../src/shared/errors/index.js',
  );

  return {
    requireAuth: () => async (request: {
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

vi.mock('../src/modules/exports/exports.service.js', () => ({
  ExportsService: {
    fromSupabase: () => ({
      exportMeeting: routeExportMeeting,
    }),
  },
}));

async function buildExportsRoutesApp() {
  const [{ exportsRoutes }, { registerErrorHandler }] = await Promise.all([
    import('../src/modules/exports/exports.routes.js'),
    import('../src/shared/errors/error-handler.js'),
  ]);
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  app.decorate('supabase', {});
  await app.register(exportsRoutes, { prefix: '/v1/exports' });

  return app;
}

describe('exports routes', () => {
  beforeEach(() => {
    routeExportMeeting.mockReset();
  });

  it('returns 401 for unauthenticated meeting export requests', async () => {
    const app = await buildExportsRoutesApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/exports/meeting',
      payload: { meetingId: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'unauthenticated' });
    expect(routeExportMeeting).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 403 for insufficient role before the service is called', async () => {
    const app = await buildExportsRoutesApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/exports/meeting',
      headers: { authorization: 'Bearer viewer-token' },
      payload: { meetingId: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
    expect(routeExportMeeting).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 403 for non-premium adult members before the service is called', async () => {
    const app = await buildExportsRoutesApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/exports/meeting',
      headers: { authorization: 'Bearer free-token' },
      payload: { meetingId: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'premium_required' });
    expect(routeExportMeeting).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns 422 for invalid request bodies', async () => {
    const app = await buildExportsRoutesApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/exports/meeting',
      headers: { authorization: 'Bearer premium-token' },
      payload: { meetingId: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'validation_failed' });
    expect(routeExportMeeting).not.toHaveBeenCalled();
    await app.close();
  });

  it('exports markdown through route wiring', async () => {
    routeExportMeeting.mockResolvedValueOnce({
      meetingId: '11111111-1111-4111-8111-111111111111',
      format: 'markdown',
      contentType: 'text/markdown',
      filename: 'weekly-check-in-11111111-1111-4111-8111-111111111111.md',
      content: '# Weekly check-in',
      generatedAt: '2026-06-07T12:00:00.000Z',
    });
    const app = await buildExportsRoutesApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/exports/meeting',
      headers: { authorization: 'Bearer premium-token' },
      payload: {
        meetingId: '11111111-1111-4111-8111-111111111111',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      meetingId: '11111111-1111-4111-8111-111111111111',
      format: 'markdown',
      contentType: 'text/markdown',
      content: '# Weekly check-in',
    });
    expect(routeExportMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '11111111-1111-4111-8111-111111111111',
        workspaceId: '33333333-3333-4333-8333-333333333333',
        planType: 'premium',
      }),
      {
        meetingId: '11111111-1111-4111-8111-111111111111',
        format: 'markdown',
      },
    );
    await app.close();
  });
});
