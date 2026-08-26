import type { FeatureAccess, FeatureKey } from './types';

export const featureAccessConfig: Record<FeatureKey, FeatureAccess> = {
  basicMeetings: {
    key: 'basicMeetings',
    label: 'Basic weekly meetings',
    description: 'Create and run a simple weekly family meeting.',
  },
  defaultTemplate: {
    key: 'defaultTemplate',
    label: 'Default meeting template',
    description: 'Use the standard OurWeek meeting agenda.',
  },
  tasksAndAgreements: {
    key: 'tasksAndAgreements',
    label: 'Tasks and agreements',
    description: 'Create household tasks and meeting agreements.',
  },
  manualResponsibility: {
    key: 'manualResponsibility',
    label: 'Manual responsibility assignment',
    description: 'Assign tasks and agreements to family members manually.',
  },
  meetingHistory: {
    key: 'meetingHistory',
    label: 'Meeting history',
    description:
      'Review every completed meeting, agreement, task, and saved summary.',
  },
  limitedHistory: {
    key: 'limitedHistory',
    label: 'Recent meeting history',
    description: 'Compatibility access for meeting history.',
  },
  localReminders: {
    key: 'localReminders',
    label: 'Local reminders',
    description: 'Use simple device reminders when supported locally.',
  },
  unlimitedHistory: {
    key: 'unlimitedHistory',
    label: 'Unlimited meeting history',
    description: 'Keep and review all completed meetings.',
  },
  aiSummary: {
    key: 'aiSummary',
    label: 'AI meeting summaries',
    description: 'Turn meeting notes into a clear summary and next steps.',
    lockedReason: 'Upgrade to generate meeting summaries automatically.',
  },
  agreementReminders: {
    key: 'agreementReminders',
    label: 'Unfinished agreement reminders',
    description: 'Get reminders for agreements that still need follow-up.',
  },
  additionalTemplates: {
    key: 'additionalTemplates',
    label: 'Additional meeting templates',
    description: 'Use templates for different family and household situations.',
    lockedReason: 'Upgrade to choose from more meeting formats.',
  },
  privateNotes: {
    key: 'privateNotes',
    label: 'Private notes',
    description: 'Keep personal notes separate from shared meeting notes.',
    lockedReason: 'Upgrade to add private notes to your meeting prep.',
  },
  googleCalendarSync: {
    key: 'googleCalendarSync',
    label: 'Google Calendar sync',
    description: 'Sync meetings and follow-ups with Google Calendar.',
    lockedReason: 'Upgrade to connect OurWeek with Google Calendar.',
  },
  export: {
    key: 'export',
    label: 'Export',
    description: 'Export meetings as PDF, text, or Markdown.',
    lockedReason: 'Upgrade to export meeting notes and agreements.',
  },
  advancedStatistics: {
    key: 'advancedStatistics',
    label: 'Advanced statistics',
    description: 'See deeper household patterns over time.',
    lockedReason: 'Upgrade to unlock advanced household insights.',
  },
};
