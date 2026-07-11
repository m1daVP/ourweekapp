import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { describe, expect, it, vi } from 'vitest';

import { RevenueCatClientError } from '../src/modules/billing/revenuecat.client.js';
import { registerErrorHandler } from '../src/shared/errors/error-handler.js';

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

  it('returns 400 when app_user_id is missing', async () => {
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

  it('acknowledges transfer events', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/revenuecat',
      headers: { authorization: secret },
      payload: {
        event: {
          ...body.event,
          type: 'TRANSFER',
          transferred_from: ['old'],
          transferred_to: ['new'],
        },
      },
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
});
