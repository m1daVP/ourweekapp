import type { PlanComparisonItem, SubscriptionPlanOption } from './types';
import { appConfig } from '@/shared/config/env';

export const premiumPlanOptions: SubscriptionPlanOption[] = [
  {
    id: 'premium_monthly',
    name: 'Monthly',
    priceLabel: 'Price pending',
    description: 'A flexible Premium option for households trying Premium.',
    cadence: 'monthly',
    planType: 'premium',
    entitlementKey: 'premium',
    productIds: {
      android: appConfig.revenueCatAndroidMonthlyProductId ?? 'monthly',
      ios: 'monthly',
    },
  },
  {
    id: 'premium_yearly',
    name: 'Yearly',
    priceLabel: 'Price pending',
    description: 'A yearly Premium option for households using OurWeek often.',
    cadence: 'yearly',
    planType: 'premium',
    entitlementKey: 'premium',
    productIds: {
      android: appConfig.revenueCatAndroidYearlyProductId ?? 'yearly',
      ios: 'yearly',
    },
  },
];

export const planComparisonItems: PlanComparisonItem[] = [
  {
    planType: 'free',
    label: 'Free',
    benefits: [
      { label: 'Basic weekly meetings', featureKey: 'basicMeetings' },
      { label: 'Tasks and agreements', featureKey: 'tasksAndAgreements' },
      { label: 'Meeting history', featureKey: 'meetingHistory' },
      { label: 'Default template', featureKey: 'defaultTemplate' },
      {
        label: 'Unfinished agreement reminders',
        featureKey: 'agreementReminders',
      },
    ],
  },
  {
    planType: 'premium',
    label: 'Premium',
    benefits: [
      { label: 'AI summaries', featureKey: 'aiSummary' },
      { label: 'Extra templates', featureKey: 'additionalTemplates' },
      { label: 'Private notes', featureKey: 'privateNotes' },
      { label: 'Google Calendar sync', featureKey: 'googleCalendarSync' },
      { label: 'Export', featureKey: 'export' },
    ],
  },
];
