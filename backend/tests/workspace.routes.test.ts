import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { describe, expect, it, vi } from 'vitest';

import { registerErrorHandler } from '../src/shared/errors/error-handler.js';
import type { SupabaseRepositoryClient } from '../src/shared/repositories/index.js';

vi.mock('../src/modules/auth/auth.middleware.js', () => ({
  requireAuth: () => async (request: { auth?: unknown }) => {
    request.auth = {
      userId: '11111111-1111-4111-8111-111111111111',
      sessionId: '22222222-2222-4222-8222-222222222222',
      workspaceId: '33333333-3333-4333-8333-333333333333',
      role: 'owner',
      planType: 'free',
    };
  },
}));

type QueryRecord = {
  table: string;
};

class FakeQuery {
  constructor(private readonly record: QueryRecord) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  is() {
    return this;
  }

  order() {
    return this;
  }

  maybeSingle<T>() {
    if (this.record.table === 'workspaces') {
      return Promise.resolve({
        data: {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Family',
          owner_id: '11111111-1111-4111-8111-111111111111',
          created_at: '2026-06-11T17:16:13.351+02:00',
          updated_at: '2026-06-11T17:17:13.351+02:00',
        } as T,
        error: null,
      });
    }

    return Promise.resolve({ data: null as T, error: null });
  }

  returns<T>() {
    if (this.record.table === 'workspace_members') {
      return Promise.resolve({
        data: [
          {
            workspace_id: '33333333-3333-4333-8333-333333333333',
            user_id: '11111111-1111-4111-8111-111111111111',
            display_name: 'Rita',
            email: 'rita@example.com',
            role: 'owner',
            status: 'active',
            created_at: '2026-06-11T17:16:13.351+02:00',
            updated_at: '2026-06-11T17:17:13.351+02:00',
          },
        ] as T,
        error: null,
      });
    }

    if (this.record.table === 'workspace_invitations') {
      return Promise.resolve({
        data: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            workspace_id: '33333333-3333-4333-8333-333333333333',
            email: 'alex@example.com',
            email_normalized: 'alex@example.com',
            display_name: 'Alex',
            role: 'adult_member',
            status: 'pending',
            created_at: '2026-06-11T17:18:13.351+02:00',
            expires_at: '2026-06-18T17:18:13.351+02:00',
          },
        ] as T,
        error: null,
      });
    }

    return Promise.resolve({ data: [] as T, error: null });
  }
}

function createSupabaseClient(): SupabaseRepositoryClient {
  return {
    from(table: string) {
      return new FakeQuery({ table });
    },
  } as unknown as SupabaseRepositoryClient;
}

async function buildApp() {
  const { workspaceRoutes } = await import('../src/modules/workspace/workspace.routes.js');
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  app.decorate('supabase', createSupabaseClient());
  await app.register(workspaceRoutes, { prefix: '/v1/workspace' });

  return app;
}

describe('workspace routes', () => {
  it('serializes workspace timestamps returned from Supabase offset datetimes', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/workspace/',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      createdAt: '2026-06-11T15:16:13.351Z',
      updatedAt: '2026-06-11T15:17:13.351Z',
      invitations: [
        {
          invitationId: '44444444-4444-4444-8444-444444444444',
          email: 'alex@example.com',
          displayName: 'Alex',
          role: 'adult_member',
          status: 'pending',
          createdAt: '2026-06-11T15:18:13.351Z',
          expiresAt: '2026-06-18T15:18:13.351Z',
        },
      ],
    });
    await app.close();
  });
});
