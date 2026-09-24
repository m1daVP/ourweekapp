export type ReminderDay =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export interface ReminderTimeSlot {
  day: ReminderDay;
  time: string;
}

export interface ReminderSettings {
  enabled: boolean;
  weeklyMeetingReminder: ReminderTimeSlot;
  unfinishedTaskReminder: ReminderTimeSlot;
  updatedAt: string;
}
