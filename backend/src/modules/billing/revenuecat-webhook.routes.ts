import { createHash, timingSafeEqual } from 'node:crypto';

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { env } from '../../config/env.js';
import { ApiError } from '../../shared/errors/index.js';
import { errorResponseSchema } from '../../shared/schemas/index.js';
import { SubscriptionService } from './billing.service.js';
import {
  RevenueCatClient,
  RevenueCatClientError,
} from './revenuecat.client.js';
import {
  revenueCatWebhookAckSchema,
  revenueCatWebhookBodySchema,
} from './revenuecat-webhook.schema.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';

type WebhookSubscriptionService = Pick<
  SubscriptionService,
  'syncEntitlementForWorkspace'
>;

type RevenueCatWebhookRoutesOptions = {
  sharedSecret?: string;
  service?: WebhookSubscriptionService;
  revenueCatConfigured?: boolean;
};

function secretsMatch(actual: string, expected: string) {
  const actualHash = createHash('sha256').update(actual).digest();
  const expectedHash = createHash('sha256').update(expected).digest();

  return timingSafeEqual(actualHash, expectedHash);
}

function databaseCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('details' in error)) {
    return undefined;
  }

  const details = error.details;
  return details && typeof details === 'object' && 'databaseCode' in details
    ? details.databaseCode
    : undefined;
}

export const revenueCatWebhookRoutes: FastifyPluginAsyncZod<
  RevenueCatWebhookRoutesOptions
> = async (app, options) => {
  const sharedSecret =
    options.sharedSecret ?? env.REVENUECAT_WEBHOOK_SHARED_SECRET;
  const revenueCatConfigured =
    options.revenueCatConfigured ?? env.REVENUECAT_CONFIGURED;
  const service =
    options.service ??
    new SubscriptionService(
      new SubscriptionsRepository(app.supabase),
      new RevenueCatClient(env.REVENUECAT_API_KEY),
      env.REVENUECAT_ENTITLEMENT_ID,
    );

  if (revenueCatConfigured && !sharedSecret) {
    app.log.warn('RevenueCat webhook secret is not configured');
  }

  app.post(
    '/revenuecat',
    {
      errorHandler(error, _request, reply) {
        if ('validation' in error && error.validation) {
          return reply.status(400).send({
            message: 'Please check the request and try again.',
            code: 'validation_failed',
            details: {},
          });
        }

        throw error;
      },
      schema: {
        hide: true,
        body: revenueCatWebhookBodySchema,
        response: {
          200: revenueCatWebhookAckSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request) => {
      if (!sharedSecret || !revenueCatConfigured) {
        throw new ApiError(
          503,
          'webhook_not_configured',
          'The webhook is not configured.',
        );
      }

      const authorization = request.headers.authorization;
      if (!authorization || !secretsMatch(authorization, sharedSecret)) {
        throw new ApiError(
          401,
          'webhook_unauthorized',
          'Webhook authorization failed.',
        );
      }

      const event = request.body.event;
      request.log.info(
        {
          eventId: event.id,
          eventType: event.type,
          appUserId: event.app_user_id,
        },
        'RevenueCat webhook received',
      );

      if (event.type === 'TRANSFER') {
        request.log.info(
          {
            transferredFrom: event.transferred_from,
            transferredTo: event.transferred_to,
          },
          'RevenueCat transfer received',
        );
      }

      try {
        await service.syncEntitlementForWorkspace(event.app_user_id);
      } catch (error) {
        if (error instanceof RevenueCatClientError) {
          if (error.statusCode === 404) {
            request.log.info(
              { eventId: event.id, appUserId: event.app_user_id },
              'RevenueCat webhook workspace was not found by provider',
            );
            return { received: true as const };
          }

          throw new ApiError(
            502,
            'subscription_provider_unavailable',
            'Subscription validation is temporarily unavailable.',
          );
        }

        if (databaseCode(error) === '23503') {
          request.log.warn(
            { eventId: event.id, appUserId: event.app_user_id },
            'RevenueCat webhook referenced an unknown workspace',
          );
          return { received: true as const };
        }

        throw error;
      }

      return { received: true as const };
    },
  );
};
