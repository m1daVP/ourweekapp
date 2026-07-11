import { z } from 'zod';

export const revenueCatWebhookEventSchema = z.looseObject({
  id: z.string().optional(),
  type: z.string().optional(),
  store: z.string().optional(),
  app_user_id: z.string().min(1),
});

export const revenueCatWebhookBodySchema = z.looseObject({
  api_version: z.string().optional(),
  event: revenueCatWebhookEventSchema,
});

export const revenueCatWebhookAckSchema = z.object({
  received: z.literal(true),
});
