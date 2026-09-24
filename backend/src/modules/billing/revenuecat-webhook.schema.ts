import { z } from 'zod';

export const revenueCatWorkspaceIdSchema = z.uuid();

export const revenueCatWebhookEventSchema = z.looseObject({
  id: z.string().optional(),
  type: z.string().optional(),
  store: z.string().optional(),
  app_user_id: z.string().min(1).optional(),
  transferred_from: z.array(z.string()).optional(),
  transferred_to: z.array(z.string()).optional(),
});

export const revenueCatWebhookBodySchema = z.looseObject({
  api_version: z.string().optional(),
  event: revenueCatWebhookEventSchema,
});

export const revenueCatWebhookAckSchema = z.object({
  received: z.literal(true),
});
