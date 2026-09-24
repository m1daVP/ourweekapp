import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { featureAccessConfig } from '@/features/access/featureAccess.config';
import { meetingTemplates } from '@/features/meeting/meetingTemplates';
import { messages } from '../messages';

type MessageLeaf = string | readonly string[];

const meetingSectionIds = [
  'goodThings',
  'tensions',
  'tasks',
  'money',
  'familyCare',
  'plans',
  'finalAgreements',
  'appreciation',
  'frustrations',
  'emotionalLoad',
  'timeTogether',
  'practicalAgreements',
  'childRoutines',
  'school',
  'health',
  'activities',
  'parentResponsibilities',
  'purchases',
  'upcomingExpenses',
  'subscriptionsBills',
  'savingGoals',
  'financialConcerns',
  'decisions',
  'whatHappened',
  'personNeeds',
  'whatShouldChange',
  'concreteNextStep',
  'followUpDate',
  'scheduleOverview',
  'meals',
  'childcare',
  'shopping',
  'adminTasks',
  'backupPlans',
] as const;

const days = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const taskStatuses = ['open', 'done', 'skipped'] as const;

const templateTranslationKeys = {
  'weekly-family-check-in': 'weeklyFamilyCheckIn',
  'couple-reset': 'coupleReset',
  'family-with-kids': 'familyWithKids',
  'money-check-in': 'moneyCheckIn',
  'conflict-cleanup': 'conflictCleanup',
  'busy-week-planning': 'busyWeekPlanning',
} as const;

function flattenMessagePaths(
  value: unknown,
  prefix = ''
): Map<string, MessageLeaf> {
  const leaves = new Map<string, MessageLeaf>();

  if (typeof value === 'string' || Array.isArray(value)) {
    leaves.set(prefix, value);
    return leaves;
  }

  if (!value || typeof value !== 'object') {
    return leaves;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPrefix = prefix ? `${prefix}.${key}` : key;

    for (const [path, leaf] of flattenMessagePaths(child, childPrefix)) {
      leaves.set(path, leaf);
    }
  }

  return leaves;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(entryPath);
    }

    return /\.(ts|vue)$/.test(entry.name) ? [entryPath] : [];
  });
}

function literalTranslationKeys() {
  const rootDirectory = fileURLToPath(new URL('../../../../', import.meta.url));
  const sourceDirectory = resolve(rootDirectory, 'src');
  const keyPattern = /(?:\$t|\bt|translate)\(\s*(['"])([a-z][\w.-]*)\1/g;
  const keys = new Set<string>();

  for (const file of sourceFiles(sourceDirectory)) {
    const source = readFileSync(file, 'utf8');

    for (const match of source.matchAll(keyPattern)) {
      keys.add(match[2]);
    }
  }

  return [...keys].sort();
}

function hasRealValue(value: MessageLeaf) {
  return Array.isArray(value)
    ? value.length > 0 && value.every((item) => item.trim().length > 0)
    : value.trim().length > 0;
}

describe('localization message catalogue', () => {
  const englishLeaves = flattenMessagePaths(messages.en);
  const englishPaths = [...englishLeaves.keys()].sort();

  it.each(['en', 'uk', 'es'] as const)(
    'has a non-empty value for every %s message',
    (locale) => {
      for (const [path, value] of flattenMessagePaths(messages[locale])) {
        expect(hasRealValue(value), `${locale}.${path}`).toBe(true);
      }
    }
  );

  it.each(['uk', 'es'] as const)(
    'matches the English leaf paths for %s',
    (locale) => {
      expect([...flattenMessagePaths(messages[locale]).keys()].sort()).toEqual(
        englishPaths
      );
    }
  );

  it('defines English messages for every literal translation key used by the app', () => {
    for (const key of literalTranslationKeys()) {
      expect(englishLeaves.has(key), key).toBe(true);
    }
  });

  it.each(meetingSectionIds)(
    'defines a note placeholder for the %s meeting section',
    (sectionId) => {
      expect(englishLeaves.has(`meeting.notePlaceholders.${sectionId}`)).toBe(
        true
      );
    }
  );

  it('defines English messages for every finite dynamic key family', () => {
    const dynamicKeys = [
      ...days.flatMap((day) => [
        `days.${day}`,
        `calendar.schedule.weekdays.${day}`,
      ]),
      ...taskStatuses.flatMap((status) => [
        `meeting.taskStatus.${status}`,
        `export.taskStatus.${status}`,
      ]),
      ...meetingSectionIds.map(
        (sectionId) => `meeting.notePlaceholders.${sectionId}`
      ),
      ...Object.keys(featureAccessConfig).flatMap((featureKey) => [
        `features.${featureKey}.label`,
        `features.${featureKey}.description`,
      ]),
      ...meetingTemplates.flatMap((template) => {
        const templateKey = templateTranslationKeys[template.id];

        return [
          `templates.${templateKey}.name`,
          `templates.${templateKey}.description`,
          `templates.outcomes.${template.outcomeTagKeys[0]}`,
          `templates.outcomes.${template.outcomeTagKeys[1]}`,
          ...template.sections.flatMap((section) => [
            `templates.sections.${section.id}.title`,
            `templates.sections.${section.id}.prompt`,
          ]),
        ];
      }),
      'settings.participantType.adult',
      'settings.participantType.child',
      'settings.participantType.other',
      'upgrade.plans.premiumMonthly.name',
      'upgrade.plans.premiumMonthly.description',
      'upgrade.plans.premiumYearly.name',
      'upgrade.plans.premiumYearly.description',
      'upgrade.plans.monthlyBillingPeriod',
      'upgrade.plans.yearlyBillingPeriod',
      'sync.failed',
      'sync.offline',
      'sync.savedLocally',
      'sync.syncing',
      'sync.synced',
    ];

    for (const key of dynamicKeys) {
      expect(englishLeaves.has(key), key).toBe(true);
    }
  });
});
