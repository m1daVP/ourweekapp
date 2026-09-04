import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { messages } from '@/features/localization/messages';
import { createSubscriptionSnapshotFromStatus } from '@/features/subscription/services/backendSubscriptionProvider';
import type { Meeting, MeetingSummary } from '../types';
import type { AssistantRecapAllowance } from '@/features/subscription/types';

export const savedRecap: MeetingSummary = {
  id: 'recap-1',
  meetingId: 'meeting-1',
  shortSummary: 'Keep Sunday planning short.',
  mainTopics: [],
  keyTensions: [],
  agreements: [],
  tasks: [],
  suggestedNextMeetingFocus: [],
  createdAt: '2026-09-04T10:00:00.000Z',
};
export function allowance(
  remaining = 3,
  canGenerate = remaining > 0
): AssistantRecapAllowance {
  return {
    limit: 3,
    used: 3 - remaining,
    remaining,
    canGenerate,
    periodEndsAt: null,
  };
}
export function meetingFixture(summary = true): Meeting {
  return {
    id: 'meeting-1',
    templateId: 'weekly-family-check-in',
    title: 'Weekly check-in',
    status: 'completed',
    participantIds: [],
    checkInCompleted: true,
    sections: [
      {
        id: 'goodThings',
        title: 'Good things',
        prompt: 'What went well?',
        notes: [
          {
            id: 'note-1',
            sectionId: 'goodThings',
            participantId: 'participant-1',
            text: 'Plan Sunday.',
            createdAt: '2026-09-04T10:00:00.000Z',
          },
        ],
        tasks: [],
        agreements: [],
      },
    ],
    currentSectionIndex: 0,
    createdAt: '2026-09-04T10:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
    completedAt: '2026-09-04T10:00:00.000Z',
    serverRevision: 3,
    ...(summary ? { aiSummary: { ...savedRecap } } : {}),
  };
}
export function setupRecapTest(summary = true) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages,
  });
  const meetings = useMeetingsStore();
  meetings.meetings = [meetingFixture(summary)];
  const subscription = useSubscriptionStore();
  subscription.applySnapshot(
    createSubscriptionSnapshotFromStatus({
      planType: 'free',
      provider: null,
      enabledFeatures: [],
      expiresAt: null,
      checkedAt: '2026-09-04T10:00:00.000Z',
      assistantRecap: allowance(),
    })
  );
  const workspace = useWorkspaceStore();
  workspace.currentUserId = 'local-owner';
  workspace.workspace.members = [
    {
      userId: 'local-owner',
      displayName: 'Alex',
      role: 'owner',
      status: 'active',
    },
  ];
  return { pinia, i18n, meetings, subscription, workspace };
}
