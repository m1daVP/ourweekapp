import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refreshSession = vi.hoisted(() => vi.fn());

vi.mock('../src/modules/auth/auth.service.js', () => ({
  confirmPasswordReset: vi.fn(),
  getCurrentUser: vi.fn(),
  refreshSession,
  registerUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInUser: vi.fn(),
  signOutUser: vi.fn(),
}));

const authSession = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    workspaceId: '22222222-2222-4222-8222-222222222222',
    email: 'rita@example.com',
    displayName: 'Rita',
    role: 'owner',
    planType: 'free',
    createdAt: '2026-07-12T12:00:00.000Z',
    updatedAt: '2026-07-12T12:00:00.000Z',
  },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: '2026-07-12T13:00:00.000Z',
};

async function buildRefreshRouteApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  const { authRoutes } = await import('../src/modules/auth/auth.routes.js');
  const { registerErrorHandler } = await import(
    '../src/shared/errors/error-handler.js'
  );

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await app.register(rateLimit);
  app.decorate('supabase', {});
  await app.register(authRoutes, { prefix: '/v1/auth' });

  return app;
}

describe('POST /v1/auth/refresh rate limit', () => {
  beforeEach(() => {
    refreshSession.mockReset();
    refreshSession.mockResolvedValue(authSession);
  });

  it('returns 429 on the eleventh request within one minute', async () => {
    const app = await buildRefreshRouteApp();
    const responses = [];

    for (let index = 0; index < 11; index += 1) {
      responses.push(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/refresh',
          payload: { refreshToken: 'refresh-token' },
          remoteAddress: '198.51.100.30',
        })
      );
    }

    expect(responses.slice(0, 10).map((response) => response.statusCode)).toEqual(
      Array.from({ length: 10 }, () => 200)
    );
    expect(responses[10]?.statusCode).toBe(429);
    expect(responses[10]?.json()).toMatchObject({
      code: 'rate_limit_exceeded',
    });
    expect(refreshSession).toHaveBeenCalledTimes(10);
    await app.close();
  });
});
