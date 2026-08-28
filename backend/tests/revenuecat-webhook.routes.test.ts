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
    app_user_id: 'workspace-1',
  },
};

function webhookBody(type: string, appUserId = 'workspace-1') {
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
      'workspace-1',
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
      'workspace-1',
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

  it('syncs deduplicated transfer targets before sources without app_user_id', async () => {
    const service = serviceThat();
    const app = await buildApp({ service });
    const response = await app.inject({
      method: 'POST',
      url: '/revenuecat',
      headers: { authorization: secret },
      payload: {
        event: {
          type: 'TRANSFER',
          transferred_from: ['old', 'shared'],
          transferred_to: ['new', 'shared'],
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(service.syncEntitlementForWorkspace.mock.calls).toEqual([
      ['new'],
      ['shared'],
      ['old'],
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
          transferred_to: ['unknown', 'workspace-2'],
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(service.syncEntitlementForWorkspace.mock.calls).toEqual([
      ['unknown'],
      ['workspace-2'],
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
          transferred_to: ['workspace-1'],
        },
      },
    });
    expect(response.statusCode).toBe(502);
    await app.close();
  });
});
