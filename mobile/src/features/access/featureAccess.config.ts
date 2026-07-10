import type { FeatureAccess, FeatureKey } from './types';

export const featureAccessConfig: Record<FeatureKey, FeatureAccess> = {
  basicMeetings: {
    key: 'basicMeetings',
    label: 'Basic weekly meetings',
    description: 'Create and run a simple weekly family meeting.',
    plans: ['free', 'premium'],
  },
  defaultTemplate: {
    key: 'defaultTemplate',
    label: 'Default meeting template',
    description: 'Use the standard OurWeek meeting agenda.',
    plans: ['free', 'premium'],
  },
  tasksAndAgreements: {
    key: 'tasksAndAgreements',
    label: 'Tasks and agreements',
    description: 'Create household tasks and meeting agreements.',
    plans: ['free', 'premium'],
  },
  manualResponsibility: {
    key: 'manualResponsibility',
    label: 'Manual responsibility assignment',
    description: 'Assign tasks and agreements to family members manually.',
    plans: ['free', 'premium'],
  },
  limitedHistory: {
    key: 'limitedHistory',
    label: 'Recent meeting history',
    description: 'Review the latest 3 completed meetings.',
    plans: ['free', 'premium'],
    freeLimit: 3,
  },
  localReminders: {
    key: 'localReminders',
    label: 'Local reminders',
    description: 'Use simple device reminders when supported locally.',
    plans: ['free', 'premium'],
  },
  unlimitedHistory: {
    key: 'unlimitedHistory',
    label: 'Unlimited meeting history',
    description: 'Keep and review all completed meetings.',
    plans: ['premium'],
    lockedReason: 'Upgrade to keep the full record of your family meetings.',
  },
  aiSummary: {
    key: 'aiSummary',
    label: 'AI meeting summaries',
    description: 'Turn meeting notes into a clear summary and next steps.',
    plans: ['premium'],
    lockedReason: 'Upgrade to generate meeting summaries automatically.',
  },
  agreementReminders: {
    key: 'agreementReminders',
    label: 'Unfinished agreement reminders',
    description: 'Get reminders for agreements that still need follow-up.',
    plans: ['free', 'premium'],
  },
  additionalTemplates: {
    key: 'additionalTemplates',
    label: 'Additional meeting templates',
    description: 'Use templates for different family and household situations.',
    plans: ['premium'],
    lockedReason: 'Upgrade to choose from more meeting formats.',
  },
  privateNotes: {
    key: 'privateNotes',
    label: 'Private notes',
    description: 'Keep personal notes separate from shared meeting notes.',
    plans: ['premium'],
    lockedReason: 'Upgrade to add private notes to your meeting prep.',
  },
  googleCalendarSync: {
    key: 'googleCalendarSync',
    label: 'Google Calendar sync',
    description: 'Sync meetings and follow-ups with Google Calendar.',
    plans: ['premium'],
    roles: ['owner', 'adult_member'],
    lockedReason: 'Upgrade to connect OurWeek with Google Calendar.',
  },
  export: {
    key: 'export',
    label: 'Export',
    description: 'Export meetings as PDF, text, or Markdown.',
    plans: ['premium'],
    lockedReason: 'Upgrade to export meeting notes and agreements.',
  },
  advancedStatistics: {
    key: 'advancedStatistics',
    label: 'Advanced statistics',
    description: 'See deeper household patterns over time.',
    plans: ['premium'],
    lockedReason:
      'Upgrade to unlock advanced household insights when available.',
  },
};

export const premiumFeatureKeys = Object.values(featureAccessConfig)
  .filter(
    (feature) => feature.plans.length === 1 && feature.plans.includes('premium')
  )
  .map((feature) => feature.key);
