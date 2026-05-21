export type PlanType = 'free' | 'premium';

export type FeatureKey =
  | 'basicMeetings'
  | 'defaultTemplate'
  | 'tasksAndAgreements'
  | 'manualResponsibility'
  | 'limitedHistory'
  | 'localReminders'
  | 'unlimitedHistory'
  | 'aiSummary'
  | 'agreementReminders'
  | 'additionalTemplates'
  | 'privateNotes'
  | 'googleCalendarSync'
  | 'export'
  | 'advancedStatistics';

export type UserRole = 'owner' | 'adult_member' | 'viewer';

export interface FeatureAccess {
  key: FeatureKey;
  label: string;
  description: string;
  plans: PlanType[];
  roles?: UserRole[];
  freeLimit?: number;
  lockedReason?: string;
}
