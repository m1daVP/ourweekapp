import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { describe, expect, it, vi } from 'vitest';

import { RevenueCatClientError } from '../src/modules/billing/revenuecat.client.js';
import { registerErrorHandler } from '../src/shared/errors/error-handler.js';

Object.assign(process.env, {
  PUBLIC_API_BASE_URL: 'http://127.0.0.1:3000',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'revenuecat-webhook-test-service-role-key',
  ACCESS_TOKEN_SECRET: 'a'.repeat(32),
  REFRESH_TOKEN_SECRET: 'b'.repeat(32),
  PASSWORD_RESET_TOKEN_SECRET: 'c'.repeat(32),
  TOKEN_ENCRYPTION_KEY: 'd'.repeat(32),
});

const secret = 'revenuecat-test-secret';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const secondWorkspaceId = '22222222-2222-4222-8222-222222222222';
const unknownWorkspaceId = '33333333-3333-4333-8333-333333333333';

function serviceThat(error?: unknown) {
  return {
    syncEntitlementForWorkspace: vi.fn(async () => {
      if (error) throw error;
      return null;
    }),
  };
}

async function buildApp(
  options: {
    sharedSecret?: string;
    revenueCatConfigured?: boolean;
    service?: ReturnType<typeof serviceThat>;
  } = {},
) {
  const { revenueCatWebhookRoutes } =
    await import('../src/modules/billing/revenuecat-webhook.routes.js');
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  app.decorate('supabase', {});
  await app.register(revenueCatWebhookRoutes, {
    sharedSecret: options.sharedSecret ?? secret,
    revenueCatConfigured: options.revenueCatConfigured ?? true,
    service: options.service ?? serviceThat(),
  });
  return app;
}

const body = {
  api_version: '1.0',
  event: {
    id: 'event-1',
    type: 'CANCELLATION',
    store: 'PLAY_STORE',
    app_user_id: workspaceId,
  },
};

function webhookBody(type: string, appUserId = workspaceId) {
  return {
    api_version: '1.0',
    event: {
      id: `event-${type}`,
      type,
      store: 'PLAY_STORE',
      app_user_id: appUserId,
    },
  };
}

describe('RevenueCat webhook routes', () => {
  it.each([
    ['missing authorization', undefined],
    ['wrong authorization of the same length', 'revenuecat-test-secrex'],
    ['wrong authorization of a different length', 'wrong'],
  ])('returns 401 for %s', async (_name, authorization) => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/revenuecat',
      headers: authorization ? { authorization } : {},
      payload: body,
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it.each([
    ['an empty secret', { sharedSecret: '' }],
    ['an unconfigured provider', { revenueCatConfigured: false }],
  ])('returns 503 for %s', async (_name, options) => {
    const app = await buildApp(options);
    const response = await app.inject({
      method: 'POST',
      url: '/revenuecat',
      headers: { authorization: secret },
      payload: body,
    });
    expect(response.statusCode).toBe(503);
    await app.close();
  });

  it('syncs the event workspace and accepts loose extra fields', async () => {
    const service = serviceThat();
    const app = await buildApp({ service });
    const response = await app.inject({
      method: 'POST',
      url: '/revenuecat',
      headers: { authorization: secret },
      payload: {
        ...body,
        extra: true,
        event: { ...body.event, new_provider_field: true },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
    expect(service.syncEntitlementForWorkspace).toHaveBeenCalledWith(
      workspaceId,
    );
    await app.close();
  });

  it.each([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'CANCELLATION',
    'EXPIRATION',
    'REFUND',
  ])('refreshes the event workspace for %s', async (eventType) => {
    const service = serviceThat();
    const app = await buildApp({ service });
    const response = await app.inject({
      method: 'POST',
      url: '/revenuecat',
      headers: { authorization: secret },
      payload: webhookBody(eventType),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
    expect(service.syncEntitlementForWorkspace).toHaveBeenCalledOnce();
    expect(service.syncEntitlementForWorkspace).toHaveBeenCalledWith(
      workspaceId,
    );
    await app.close();
  });

  it('returns 400 when a non-transfer event is missing app_user_id', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/revenuecat',
      headers: { authorization: secret },
      payload: { event: { type: 'TEST' } },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('acknowledges an anonymous app user without syncing it', async () => {
    const service = serviceThat();
    const app = await buildApp({ service });
    const response = await app.inject({
      method: 'POST',
      url: '/revenuecat',
      headers: { authorization: secret },
      payload: webhookBody('INITIAL_PURCHASE', '$RCAnonymousID:anonymous-1'),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
    expect(service.syncEntitlementForWorkspace).not.toHaveBeenCalled();
    await app.close();
  });

  it.each([
    ['provider 404', new RevenueCatClientError('missing', 404), 200],
    ['provider network failure', new RevenueCatClientError('network'), 502],
    ['provider 5xx', new RevenueCatClientError('failed', 500), 502],
    ['unknown workspace', { details: { databaseCode: '23503' } }, 200],
    ['unexpected failure', new Error('unexpected'), 500],
  ])('maps %s to %i', async (_name, error, statusCode) => {
    const app = await buildApp({ service: serviceThat(error) });
    const response = await app.inject({
      method: 'POST',
      url: '/revenuecat',
      headers: { authorization: secret },
      payload: body,
    });
    expect(response.statusCode).toBe(statusCode);
    await app.close();
  });

  it('skips unusable transfer identities and syncs deduplicated workspace UUIDs', async () => {
    const service = serviceThat();
    const app = await buildApp({ service });
    const response = await app.inject({
      method: 'POST',
      url: '/revenuecat',
      headers: { authorization: secret },
      payload: {
        event: {
          id: 'event-transfer',
          type: 'TRANSFER',
          transferred_from: ['$RCAnonymousID:old', workspaceId],
          transferred_to: [secondWorkspaceId, 'not-a-workspace', workspaceId],
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(service.syncEntitlementForWorkspace.mock.calls).toEqual([
      [secondWorkspaceId],
      [workspaceId],
    ]);
    await app.close();
  });

  it('continues syncing a transfer after an unknown workspace', async () => {
    const service = serviceThat();
    service.syncEntitlementForWorkspace
      .mockRejectedValueOnce({ details: { databaseCode: '23503' } })
      .mockResolvedValueOnce(null);
    const app = await buildApp({ service });
    const response = await app.inject({
      method: 'POST',
      url: '/revenuecat',
      headers: { authorization: secret },
      payload: {
        event: {
          type: 'TRANSFER',
          transferred_to: [unknownWorkspaceId, secondWorkspaceId],
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(service.syncEntitlementForWorkspace.mock.calls).toEqual([
      [unknownWorkspaceId],
      [secondWorkspaceId],
    ]);
    await app.close();
  });

  it('returns 502 when transfer sync hits a provider network error', async () => {
    const service = serviceThat(new RevenueCatClientError('network'));
    const app = await buildApp({ service });
    const response = await app.inject({
      method: 'POST',
      url: '/revenuecat',
      headers: { authorization: secret },
      payload: {
        event: {
          type: 'TRANSFER',
          transferred_to: [workspaceId],
        },
      },
    });
    expect(response.statusCode).toBe(502);
    await app.close();
  });
});
