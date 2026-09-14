import type {
  MeetingSectionId,
  MeetingTemplate,
  MeetingTemplateId,
} from '@/features/meeting/types';
import type { MeetingComposerDraftType } from '@/features/meeting/meetingComposerDrafts';

export type MeetingPhase = 'reflect' | 'plan' | 'agree';
export type MeetingScreenKind = 'conversation' | 'review';

export interface SectionPresentation {
  sectionId: MeetingSectionId;
  phase: MeetingPhase;
  screenKind: MeetingScreenKind;
  promptKey: string;
  helperKey?: string;
  exampleKeys?: string[];
  allowedItemTypes: MeetingComposerDraftType[];
  primaryCaptureType?: MeetingComposerDraftType;
  addActionLabelKey?: string;
  attributionMode: 'shared' | 'optional';
}

type ConfiguredSection = Omit<
  SectionPresentation,
  'sectionId' | 'screenKind'
> & { screenKind?: MeetingScreenKind };

type TemplatePresentation = Partial<
  Record<MeetingSectionId, ConfiguredSection>
>;

const sharedNote = (): ConfiguredSection => ({
  phase: 'reflect',
  promptKey: 'templates.sections',
  helperKey: 'meeting.presentation.reflectHelper',
  allowedItemTypes: ['note'],
  primaryCaptureType: 'note',
  addActionLabelKey: 'meeting.presentation.addNote',
  attributionMode: 'shared',
});

const planning = (
  primaryCaptureType: MeetingComposerDraftType = 'task'
): ConfiguredSection => ({
  phase: 'plan',
  promptKey: 'templates.sections',
  helperKey: 'meeting.presentation.planHelper',
  allowedItemTypes: ['note', 'task', 'agreement'],
  primaryCaptureType,
  addActionLabelKey:
    primaryCaptureType === 'task'
      ? 'meeting.presentation.addTask'
      : primaryCaptureType === 'agreement'
        ? 'meeting.presentation.addAgreement'
        : 'meeting.presentation.addNote',
  attributionMode: 'shared',
});

const agreeing = (): ConfiguredSection => ({
  phase: 'agree',
  promptKey: 'templates.sections',
  helperKey: 'meeting.presentation.agreeHelper',
  allowedItemTypes: ['note', 'task', 'agreement'],
  primaryCaptureType: 'agreement',
  addActionLabelKey: 'meeting.presentation.addAgreement',
  attributionMode: 'shared',
});

const templatePresentations: Record<MeetingTemplateId, TemplatePresentation> = {
  'weekly-family-check-in': {
    goodThings: {
      ...sharedNote(),
      exampleKeys: ['meeting.presentation.goodThingsExample'],
    },
    tensions: {
      ...sharedNote(),
      exampleKeys: ['meeting.presentation.tensionsExample'],
    },
    tasks: planning(),
    money: planning('agreement'),
    familyCare: planning(),
    plans: planning('note'),
    finalAgreements: agreeing(),
  },
  'couple-reset': {
    appreciation: sharedNote(),
    frustrations: sharedNote(),
    emotionalLoad: sharedNote(),
    timeTogether: planning('note'),
    practicalAgreements: agreeing(),
  },
  'family-with-kids': {
    childRoutines: planning('note'),
    school: planning('note'),
    health: planning('note'),
    activities: planning('note'),
    parentResponsibilities: planning(),
    purchases: planning('agreement'),
  },
  'money-check-in': {
    upcomingExpenses: planning('note'),
    subscriptionsBills: planning('note'),
    purchases: planning('agreement'),
    savingGoals: planning('note'),
    financialConcerns: sharedNote(),
    decisions: agreeing(),
  },
  'conflict-cleanup': {
    whatHappened: sharedNote(),
    personNeeds: sharedNote(),
    whatShouldChange: agreeing(),
    concreteNextStep: planning(),
    followUpDate: planning('note'),
  },
  'busy-week-planning': {
    scheduleOverview: planning('note'),
    meals: planning('note'),
    childcare: planning(),
    shopping: planning(),
    adminTasks: planning(),
    backupPlans: agreeing(),
  },
};

function reviewPresentation(sectionId: MeetingSectionId): SectionPresentation {
  return {
    sectionId,
    phase: 'agree',
    screenKind: 'review',
    promptKey: 'templates.sections',
    helperKey: 'meeting.presentation.reviewHelper',
    allowedItemTypes: [],
    attributionMode: 'shared',
  };
}

export function getSectionPresentation(
  templateId: MeetingTemplateId,
  sectionId: MeetingSectionId,
  sectionIndex?: number,
  sectionCount?: number
): SectionPresentation | null {
  if (sectionCount && sectionIndex === sectionCount - 1) {
    return reviewPresentation(sectionId);
  }

  const configuration = templatePresentations[templateId][sectionId];

  if (!configuration) {
    return {
      sectionId,
      screenKind: 'conversation',
      ...sharedNote(),
    };
  }

  return {
    sectionId,
    screenKind: configuration.screenKind ?? 'conversation',
    ...configuration,
  };
}

export function getTemplatePresentation(template: MeetingTemplate) {
  return template.sections.map((section, index) =>
    getSectionPresentation(
      template.id,
      section.id,
      index,
      template.sections.length
    )
  );
}

export function isAllowedCaptureType(
  presentation: SectionPresentation | null,
  type: MeetingComposerDraftType
) {
  return presentation?.allowedItemTypes.includes(type) ?? false;
}
