import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../src/shared/errors/index.js';
import { registerErrorHandler } from '../src/shared/errors/error-handler.js';

const exportAccount = vi.fn(async () => ({
  exportedAt: '2026-06-07T12:00:00.000Z',
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'rita@example.com',
    displayName: 'Rita',
    createdAt: '2026-06-07T12:00:00.000Z',
    updatedAt: '2026-06-07T12:00:00.000Z',
  },
  workspaces: [],
}));

const deleteAccount = vi.fn(async () => undefined);

vi.mock('../src/modules/account/account.service.js', () => ({
  AccountService: {
    fromSupabase: () => ({
      exportAccount,
      deleteAccount,
    }),
  },
}));

vi.mock('../src/modules/auth/auth.middleware.js', () => ({
  requireAuth: () => async (request: { headers: { authorization?: string }; auth?: unknown }) => {
    if (request.headers.authorization !== 'Bearer valid-token') {
      throw new ApiError(401, 'unauthenticated', 'Authentication is required.');
    }

    request.auth = {
      userId: '11111111-1111-4111-8111-111111111111',
      sessionId: '22222222-2222-4222-8222-222222222222',
      workspaceId: '33333333-3333-4333-8333-333333333333',
      role: 'owner',
      planType: 'free',
    };
  },
}));

async function buildAccountRoutesApp() {
  const { accountRoutes } = await import('../src/modules/account/account.routes.js');
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  app.decorate('supabase', {});
  await app.register(accountRoutes, { prefix: '/account' });

  return app;
}

describe('account routes', () => {
  it('requires auth for account export', async () => {
    const app = await buildAccountRoutesApp();
    const response = await app.inject({
      method: 'GET',
      url: '/account/export',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: 'unauthenticated',
    });
    await app.close();
  });

  it('routes authenticated account deletion through the account service', async () => {
    const app = await buildAccountRoutesApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/account',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(deleteAccount).toHaveBeenCalled();
    await app.close();
  });
});
