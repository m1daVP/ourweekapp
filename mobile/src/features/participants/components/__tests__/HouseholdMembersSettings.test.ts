// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import type { Participant } from '@/features/participants/types';
import type { Meeting } from '@/features/meeting/types';

const state = vi.hoisted(() => ({
  role: 'owner' as 'owner' | 'adult_member' | 'viewer',
  participants: [] as Participant[],
  meetings: [] as Meeting[],
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/app/stores/participants', () => ({
  participantColors: ['#496a8f'],
  useParticipantsStore: () => ({
    get householdParticipants() {
      return state.participants;
    },
    get participants() {
      return state.participants;
    },
    getParticipantById: (participantId: string) =>
      state.participants.find(
        (participant) => participant.id === participantId
      ) ?? null,
    isCurrentParticipant: vi.fn(() => false),
    createParticipant: (payload: {
      name: string;
      initials?: string;
      avatarColor?: string;
      avatarType?: Participant['avatarType'];
      type: Participant['type'];
    }) => {
      const name = payload.name.trim();

      if (!name) {
        return null;
      }

      const participant: Participant = {
        id: `participant-${state.participants.length + 1}`,
        name,
        initials: payload.initials?.trim() || name.slice(0, 1).toUpperCase(),
        avatarColor: payload.avatarColor ?? '#496a8f',
        avatarType: payload.avatarType ?? null,
        type: payload.type,
        isActive: true,
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      };

      state.participants.push(participant);
      return participant;
    },
    enableParticipant: (participantId: string) => {
      const participant = state.participants.find(
        (item) => item.id === participantId
      );

      if (participant) {
        participant.isActive = true;
      }

      return participant ?? null;
    },
  }),
}));

vi.mock('@/app/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    workspace: { name: 'Our home' },
    activeMembers: [],
    isSaving: false,
    getParticipantAccessState: vi.fn(() => ({ status: 'none' })),
    getParticipantPendingInvitation: vi.fn(() => null),
  }),
}));

vi.mock('@/app/stores/subscription', () => ({
  useSubscriptionStore: () => ({ currentPlan: 'free' }),
}));

vi.mock('@/app/stores/meetings', () => ({
  useMeetingsStore: () => ({ meetings: state.meetings }),
}));

vi.mock('@/app/stores/tasks', () => ({
  useTasksStore: () => ({ tasks: [], agreements: [] }),
}));

vi.mock('@/shared/composables/useWorkspacePermissions', () => ({
  useWorkspacePermissions: () => ({
    can: (permission: string) =>
      permission === 'manageWorkspace' && state.role === 'owner',
  }),
}));

import HouseholdMembersSettings from '../HouseholdMembersSettings.vue';

function mountHouseholdMembersSettings() {
  return shallowMount(HouseholdMembersSettings, {
    global: {
      stubs: {
        BaseBottomSheet: {
          template: '<div><slot /></div>',
        },
      },
    },
  });
}

beforeEach(() => {
  state.role = 'owner';
  state.participants = [];
  state.meetings = [];
});

describe('HouseholdMembersSettings participant creation', () => {
  it('shows household-name editing only to the workspace owner', () => {
    expect(
      mountHouseholdMembersSettings()
        .find('button.household-settings-edit')
        .exists()
    ).toBe(true);

    state.role = 'adult_member';

    expect(
      mountHouseholdMembersSettings()
        .find('button.household-settings-edit')
        .exists()
    ).toBe(false);
  });

  it('shows Add person to the workspace owner', () => {
    expect(
      mountHouseholdMembersSettings()
        .get('button.household-settings-add-button')
        .text()
    ).toContain('settings.addPerson');
  });

  it.each(['adult_member', 'viewer'] as const)(
    'does not show Add person to %s',
    (role) => {
      state.role = role;

      expect(
        mountHouseholdMembersSettings()
          .find('button.household-settings-add-button')
          .exists()
      ).toBe(false);
    }
  );

  it('keeps active-meeting attendance unchanged when creating a participant', async () => {
    state.meetings = [createMeeting(['existing-participant'])];
    const wrapper = mountHouseholdMembersSettings();

    await wrapper.get('button.household-settings-add-button').trigger('click');
    await wrapper
      .get('.participant-sheet-form input[type="text"]')
      .setValue('Alex');
    await wrapper.get('form.participant-sheet-form').trigger('submit');

    expect(state.participants).toEqual([
      expect.objectContaining({ name: 'Alex', isActive: true }),
    ]);
    expect(state.meetings[0]?.participantIds).toEqual(['existing-participant']);
  });

  it('keeps active-meeting attendance unchanged when re-enabling a participant', async () => {
    state.participants = [createParticipant({ id: 'hidden', isActive: false })];
    state.meetings = [createMeeting(['existing-participant'])];
    const wrapper = mountHouseholdMembersSettings();

    await wrapper.get('button.household-member-row').trigger('click');
    await wrapper.get('button.participant-secondary-action').trigger('click');

    expect(state.participants[0]?.isActive).toBe(true);
    expect(state.meetings[0]?.participantIds).toEqual(['existing-participant']);
  });
});

function createParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: 'participant-1',
    name: 'Taylor',
    initials: 'T',
    avatarColor: '#496a8f',
    avatarType: null,
    type: 'adult',
    isActive: true,
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}

function createMeeting(participantIds: string[]): Meeting {
  return {
    id: 'meeting-1',
    templateId: 'weekly-reset',
    title: 'Weekly reset',
    status: 'in_progress',
    participantIds,
    checkInCompleted: true,
    sections: [],
    currentSectionIndex: 0,
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
  };
}
