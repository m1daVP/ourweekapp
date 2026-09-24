import { z } from 'zod';

import {
  isoDateTimeStringSchema,
  nullableIsoDateTimeStringSchema,
} from '../../shared/schemas/index.js';
import { planTypeSchema } from '../auth/auth.schema.js';
import {
  featureAccessMapSchema,
  subscriptionFeatureSchema,
} from './feature-access.js';

export const subscriptionProviderSchema = z.enum([
  'google_play',
  'app_store',
  'revenuecat',
]);

export const mobilePurchaseProviderSchema = z.enum([
  'google_play',
  'app_store',
]);

export { subscriptionFeatureSchema } from './feature-access.js';

export const freeSubscriptionFeatures = [
  'basicMeetings',
  'defaultTemplate',
  'tasksAndAgreements',
  'manualResponsibility',
  'meetingHistory',
  'limitedHistory',
  'localReminders',
  'unlimitedHistory',
  'agreementReminders',
] as const satisfies Array<z.infer<typeof subscriptionFeatureSchema>>;

export const premiumSubscriptionFeatures = [
  ...freeSubscriptionFeatures,
  'aiSummary',
  'smartFollowUps',
  'additionalTemplates',
  'privateNotes',
  'googleCalendarSync',
  'export',
  'advancedStatistics',
] as const satisfies Array<z.infer<typeof subscriptionFeatureSchema>>;

export const subscriptionStatusSchema = z.object({
  planType: planTypeSchema,
  provider: subscriptionProviderSchema.nullable(),
  enabledFeatures: z.array(subscriptionFeatureSchema),
  features: featureAccessMapSchema,
  expiresAt: nullableIsoDateTimeStringSchema,
  checkedAt: isoDateTimeStringSchema,
  assistantRecap: z.object({
    limit: z.number().int().positive(),
    used: z.number().int().min(0),
    remaining: z.number().int().min(0),
    periodEndsAt: nullableIsoDateTimeStringSchema,
    canGenerate: z.boolean(),
  }),
});

export const restoreSubscriptionRequestSchema = z.object({
  provider: mobilePurchaseProviderSchema,
});

export const manageSubscriptionResponseSchema = z.object({
  url: z.string().url(),
});

export type SubscriptionProviderDto = z.infer<typeof subscriptionProviderSchema>;
export type MobilePurchaseProviderDto = z.infer<
  typeof mobilePurchaseProviderSchema
>;
export type SubscriptionFeatureDto = z.infer<typeof subscriptionFeatureSchema>;
export type SubscriptionStatusDto = z.infer<typeof subscriptionStatusSchema>;
export type RestoreSubscriptionRequestDto = z.infer<
  typeof restoreSubscriptionRequestSchema
>;
