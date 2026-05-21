import type { PlanComparisonItem, SubscriptionPlanOption } from './types';

export const premiumPlanOptions: SubscriptionPlanOption[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    priceLabel: 'Price pending',
    description: 'A flexible Premium placeholder for future billing.',
  },
  {
    id: 'yearly',
    name: 'Yearly',
    priceLabel: 'Price pending',
    description: 'A yearly Premium placeholder. Payments are not connected.',
  },
];

export const planComparisonItems: PlanComparisonItem[] = [
  {
    planType: 'free',
    label: 'Free',
    benefits: [
      { label: 'Basic weekly meetings', featureKey: 'basicMeetings' },
      { label: 'Tasks and agreements', featureKey: 'tasksAndAgreements' },
      { label: 'Last 3 meetings history', featureKey: 'limitedHistory' },
      { label: 'Default template', featureKey: 'defaultTemplate' },
    ],
  },
  {
    planType: 'premium',
    label: 'Premium',
    benefits: [
      { label: 'Unlimited meeting history', featureKey: 'unlimitedHistory' },
      { label: 'AI summaries', featureKey: 'aiSummary' },
      { label: 'Reminder system', featureKey: 'agreementReminders' },
      { label: 'Extra templates', featureKey: 'additionalTemplates' },
      { label: 'Private notes', featureKey: 'privateNotes' },
      { label: 'Google Calendar sync', featureKey: 'googleCalendarSync' },
      { label: 'Export', featureKey: 'export' },
    ],
  },
];
