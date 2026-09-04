// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

const state = vi.hoisted(() => ({
  role: 'owner' as 'owner' | 'adult_member' | 'viewer',
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/app/stores/participants', () => ({
  participantColors: ['#496a8f'],
  useParticipantsStore: () => ({
    householdParticipants: [],
    participants: [],
    getParticipantById: vi.fn(),
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
  useMeetingsStore: () => ({ syncActiveMeetingParticipants: vi.fn() }),
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
        BaseBottomSheet: true,
      },
    },
  });
}

beforeEach(() => {
  state.role = 'owner';
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
});
