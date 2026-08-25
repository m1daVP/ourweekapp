export type PlanType = 'free' | 'premium';

export type FeatureKey =
  | 'basicMeetings'
  | 'defaultTemplate'
  | 'tasksAndAgreements'
  | 'manualResponsibility'
  | 'meetingHistory'
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

export type FeatureTier = 'free' | 'premium';
export type FeatureLifecycle = 'available' | 'planned' | 'retired';
export type FeatureAccessState =
  | 'available'
  | 'upgradeRequired'
  | 'roleRestricted'
  | 'notYetAvailable'
  | 'unavailable';

export interface FeatureAccessDto {
  key: FeatureKey;
  tier: FeatureTier;
  lifecycle: FeatureLifecycle;
  state: FeatureAccessState;
  roleEligible: boolean;
  upgradeEligible: boolean;
}

export type FeatureAccessMap = Record<FeatureKey, FeatureAccessDto>;

export interface FeatureAccess {
  key: FeatureKey;
  label: string;
  description: string;
  freeLimit?: number;
  lockedReason?: string;
}
