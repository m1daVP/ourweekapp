import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerUser = vi.hoisted(() => vi.fn());

vi.mock('../src/modules/auth/auth.service.js', () => ({
  confirmPasswordReset: vi.fn(),
  getCurrentUser: vi.fn(),
  refreshSession: vi.fn(),
  registerUser,
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

async function buildRegisterRouteApp() {
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

describe('POST /v1/auth/register rate limit', () => {
  beforeEach(() => {
    registerUser.mockReset();
    registerUser.mockResolvedValue(authSession);
  });

  it('returns 429 on the sixth request within fifteen minutes', async () => {
    const app = await buildRegisterRouteApp();
    const responses = [];

    for (let index = 0; index < 6; index += 1) {
      responses.push(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/register',
          payload: {
            email: 'newuser@example.com',
            password: 'SuperSecret123!',
            displayName: 'New User',
          },
          remoteAddress: '198.51.100.31',
        })
      );
    }

    expect(responses.slice(0, 5).map((response) => response.statusCode)).toEqual(
      Array.from({ length: 5 }, () => 201)
    );
    expect(responses[5]?.statusCode).toBe(429);
    expect(responses[5]?.json()).toMatchObject({
      code: 'rate_limit_exceeded',
    });
    expect(registerUser).toHaveBeenCalledTimes(5);
    await app.close();
  });
});
