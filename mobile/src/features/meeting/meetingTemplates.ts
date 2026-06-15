import type {
  MeetingSectionId,
  MeetingTemplate,
  MeetingTemplateId,
} from '@/features/meeting/types';
import { translate } from '@/features/localization/i18n';

export const DEFAULT_MEETING_TEMPLATE_ID: MeetingTemplateId =
  'weekly-family-check-in';

export const taskSectionIds: MeetingSectionId[] = [
  'tasks',
  'familyCare',
  'emotionalLoad',
  'timeTogether',
  'parentResponsibilities',
  'purchases',
  'upcomingExpenses',
  'concreteNextStep',
  'childcare',
  'shopping',
  'adminTasks',
];

export const agreementSectionIds: MeetingSectionId[] = [
  'money',
  'finalAgreements',
  'practicalAgreements',
  'purchases',
  'decisions',
  'whatShouldChange',
  'concreteNextStep',
  'followUpDate',
  'backupPlans',
];

export const meetingTemplates: MeetingTemplate[] = [
  {
    id: DEFAULT_MEETING_TEMPLATE_ID,
    name: 'Weekly family check-in',
    description: 'The standard weekly rhythm for notes, tasks, and agreements.',
    access: 'free',
    sections: [
      {
        id: 'goodThings',
        title: 'Good things',
        prompt: 'What went well this week?',
      },
      {
        id: 'tensions',
        title: 'Tensions',
        prompt: 'What felt stressful, unfair, or unresolved?',
      },
      {
        id: 'tasks',
        title: 'Tasks',
        prompt: 'What needs to be handled this week?',
      },
      {
        id: 'money',
        title: 'Money / purchases',
        prompt: 'What should we buy, pause, or decide about money?',
      },
      {
        id: 'familyCare',
        title: 'Kids / family care',
        prompt: 'What needs attention around routines, care, or family needs?',
      },
      {
        id: 'plans',
        title: 'Plans',
        prompt: 'What is coming up next week?',
      },
      {
        id: 'finalAgreements',
        title: 'Final agreements',
        prompt: 'What should we agree on before we finish?',
      },
    ],
  },
  {
    id: 'couple-reset',
    name: 'Couple reset',
    description: 'A short practical reset for partners after a full week.',
    access: 'premium',
    sections: [
      {
        id: 'appreciation',
        title: 'Appreciation',
        prompt: 'What did you appreciate this week?',
      },
      {
        id: 'frustrations',
        title: 'Frustrations',
        prompt: 'What felt frustrating or hard to carry?',
      },
      {
        id: 'emotionalLoad',
        title: 'Emotional load',
        prompt: 'What felt mentally or emotionally heavy this week?',
      },
      {
        id: 'timeTogether',
        title: 'Time together',
        prompt: 'What time together would help this week?',
      },
      {
        id: 'practicalAgreements',
        title: 'Practical agreements',
        prompt: 'What should be clear before the next week starts?',
      },
    ],
  },
  {
    id: 'family-with-kids',
    name: 'Family with kids',
    description: 'A focused check-in for routines, care, and kid logistics.',
    access: 'premium',
    sections: [
      {
        id: 'childRoutines',
        title: 'Child routines',
        prompt: 'What routines need attention this week?',
      },
      {
        id: 'school',
        title: 'School / kindergarten',
        prompt: 'What should we remember for school or kindergarten?',
      },
      {
        id: 'health',
        title: 'Health',
        prompt: 'Any health needs, appointments, or care details?',
      },
      {
        id: 'activities',
        title: 'Activities',
        prompt: 'What activities need planning or support?',
      },
      {
        id: 'parentResponsibilities',
        title: 'Parent responsibilities',
        prompt: 'Who will take care of what this week?',
      },
      {
        id: 'purchases',
        title: 'Purchases',
        prompt: 'What needs to be bought, replaced, or decided?',
      },
    ],
  },
  {
    id: 'money-check-in',
    name: 'Money check-in',
    description: 'A simple agenda for household spending and money decisions.',
    access: 'premium',
    sections: [
      {
        id: 'upcomingExpenses',
        title: 'Upcoming expenses',
        prompt: 'What expenses are expected soon?',
      },
      {
        id: 'subscriptionsBills',
        title: 'Subscriptions / bills',
        prompt: 'What bills or subscriptions should we review?',
      },
      {
        id: 'purchases',
        title: 'Purchases',
        prompt: 'What purchases should we approve, pause, or compare?',
      },
      {
        id: 'savingGoals',
        title: 'Saving goals',
        prompt: 'What saving goal needs attention?',
      },
      {
        id: 'financialConcerns',
        title: 'Financial concerns',
        prompt: 'What money concern should we name clearly?',
      },
      {
        id: 'decisions',
        title: 'Decisions',
        prompt: 'What did we decide?',
      },
    ],
  },
  {
    id: 'conflict-cleanup',
    name: 'Conflict cleanup',
    description: 'A calm way to turn one unresolved issue into next steps.',
    access: 'premium',
    sections: [
      {
        id: 'whatHappened',
        title: 'What happened',
        prompt: 'What happened, in simple terms?',
      },
      {
        id: 'personNeeds',
        title: 'What each person needs',
        prompt: 'What does each person need now?',
      },
      {
        id: 'whatShouldChange',
        title: 'What should change',
        prompt: 'What would make this less likely next time?',
      },
      {
        id: 'concreteNextStep',
        title: 'Concrete next step',
        prompt: 'What is the next clear action?',
      },
      {
        id: 'followUpDate',
        title: 'Follow-up date',
        prompt: 'When should we revisit this?',
      },
    ],
  },
  {
    id: 'busy-week-planning',
    name: 'Busy week planning',
    description: 'A practical plan for schedule, errands, and backup options.',
    access: 'premium',
    sections: [
      {
        id: 'scheduleOverview',
        title: 'Schedule overview',
        prompt: 'What does the week look like?',
      },
      {
        id: 'meals',
        title: 'Meals',
        prompt: 'What meals or food decisions would make the week easier?',
      },
      {
        id: 'childcare',
        title: 'Childcare',
        prompt: 'What childcare needs to be covered?',
      },
      {
        id: 'shopping',
        title: 'Shopping',
        prompt: 'What shopping needs to happen?',
      },
      {
        id: 'adminTasks',
        title: 'Admin tasks',
        prompt: 'What admin tasks should not be missed?',
      },
      {
        id: 'backupPlans',
        title: 'Backup plans',
        prompt: 'What is the backup plan if the week changes?',
      },
    ],
  },
];

export function getMeetingTemplate(templateId?: string) {
  return (
    meetingTemplates.find((template) => template.id === templateId) ??
    meetingTemplates[0]
  );
}

const templateTranslationKeys: Record<MeetingTemplateId, string> = {
  'weekly-family-check-in': 'weeklyFamilyCheckIn',
  'couple-reset': 'coupleReset',
  'family-with-kids': 'familyWithKids',
  'money-check-in': 'moneyCheckIn',
  'conflict-cleanup': 'conflictCleanup',
  'busy-week-planning': 'busyWeekPlanning',
};

export function getMeetingTemplateName(templateId?: string, fallback?: string) {
  const template = getMeetingTemplate(templateId);
  const key = templateTranslationKeys[template.id];
  const translated = translate(`templates.${key}.name`);
  return translated || fallback || template.name;
}

export function getMeetingTemplateDescription(
  templateId?: string,
  fallback?: string
) {
  const template = getMeetingTemplate(templateId);
  const key = templateTranslationKeys[template.id];
  const translated = translate(`templates.${key}.description`);
  return translated || fallback || template.description;
}

export function getMeetingSectionTitle(
  sectionId: MeetingSectionId,
  fallback?: string
) {
  const translated = translate(`templates.sections.${sectionId}.title`);
  return translated || fallback || sectionId;
}

export function getMeetingSectionPrompt(
  sectionId: MeetingSectionId,
  fallback?: string
) {
  const translated = translate(`templates.sections.${sectionId}.prompt`);
  return translated || fallback || '';
}
