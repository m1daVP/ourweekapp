import { describe, expect, it } from 'vitest';

import { messages } from '../messages';

const weekdays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

describe('calendar schedule translations', () => {
  it.each(['en', 'uk', 'es'] as const)(
    'defines complete schedule labels for %s',
    (locale) => {
      const schedule = messages[locale].calendar.schedule;

      expect(schedule.day.length).toBeGreaterThan(0);
      expect(schedule.time.length).toBeGreaterThan(0);

      weekdays.forEach((weekday) => {
        expect(schedule.weekdays[weekday].length).toBeGreaterThan(0);
      });

      expect(
        messages[locale].calendar.disconnectConfirmText.length
      ).toBeGreaterThan(0);
      expect(
        messages[locale].calendar.options.weeklyMeeting.cleanupDescription
          .length
      ).toBeGreaterThan(0);
      expect(
        messages[locale].calendar.options.taskDueDates.cleanupDescription.length
      ).toBeGreaterThan(0);
    }
  );
});
