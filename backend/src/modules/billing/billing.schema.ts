import { z } from 'zod';

import {
  isoDateTimeStringSchema,
  nullableIsoDateTimeStringSchema,
} from '../../shared/schemas/index.js';
import { planTypeSchema } from '../auth/auth.schema.js';

export const subscriptionProviderSchema = z.enum([
  'google_play',
  'app_store',
  'revenuecat',
]);

export const mobilePurchaseProviderSchema = z.enum([
  'google_play',
  'app_store',
]);

export const subscriptionFeatureSchema = z.enum([
  'basicMeetings',
  'defaultTemplate',
  'tasksAndAgreements',
  'manualResponsibility',
  'limitedHistory',
  'localReminders',
  'unlimitedHistory',
  'aiSummary',
  'agreementReminders',
  'additionalTemplates',
  'privateNotes',
  'googleCalendarSync',
  'export',
  'advancedStatistics',
]);

export const freeSubscriptionFeatures = [
  'basicMeetings',
  'defaultTemplate',
  'tasksAndAgreements',
  'manualResponsibility',
  'limitedHistory',
] as const satisfies Array<z.infer<typeof subscriptionFeatureSchema>>;

export const premiumSubscriptionFeatures = [
  ...freeSubscriptionFeatures,
  'localReminders',
  'unlimitedHistory',
  'aiSummary',
  'agreementReminders',
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
  expiresAt: nullableIsoDateTimeStringSchema,
  checkedAt: isoDateTimeStringSchema,
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
