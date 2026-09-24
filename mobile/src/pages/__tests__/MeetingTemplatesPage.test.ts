// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Meeting } from '@/features/meeting/types';

const state = vi.hoisted(() => ({
  activeMeetingId: null as string | null,
  meetings: [] as Meeting[],
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/app/stores/meetings', () => ({
  useMeetingsStore: () => ({
    get activeMeeting() {
      return (
        state.meetings.find(
          (meeting) =>
            meeting.id === state.activeMeetingId && !meeting.deletedAt
        ) ?? null
      );
    },
    meetings: state.meetings,
    resumeMeeting: vi.fn(),
    startNewMeetingFromTemplate: vi.fn(),
  }),
}));

vi.mock('@/app/stores/tasks', () => ({
  useTasksStore: () => ({ syncFromMeetings: vi.fn() }),
}));

vi.mock('@/shared/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canUseFeature: () => true }),
}));

vi.mock('@/shared/composables/useWorkspacePermissions', () => ({
  useWorkspacePermissions: () => ({ can: () => true }),
}));

vi.mock('@/shared/services/hapticsService', () => ({
  haptics: { confirm: vi.fn() },
}));

vi.mock('@/features/meeting/components/TemplateCard.vue', () => ({
  default: { template: '<article />' },
}));

import MeetingTemplatesPage from '../MeetingTemplatesPage.vue';

function deletedDraftMeeting(): Meeting {
  return {
    id: 'meeting-deleted',
    templateId: 'weekly-family-check-in',
    title: 'Saved draft',
    status: 'draft',
    participantIds: [],
    checkInCompleted: false,
    sections: [],
    currentSectionIndex: 0,
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-08T10:05:00.000Z',
    deletedAt: '2026-09-08T10:06:00.000Z',
  };
}

beforeEach(() => {
  state.activeMeetingId = null;
  state.meetings = [];
});

describe('MeetingTemplatesPage', () => {
  it('does not offer a deleted draft as a meeting to continue', () => {
    state.meetings = [deletedDraftMeeting()];

    const wrapper = mount(MeetingTemplatesPage);

    expect(wrapper.find('.template-draft-panel').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('templatePage.continueDraft');
  });
});
