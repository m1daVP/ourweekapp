# Self Participant Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist which participant profile represents the current user and prevent that profile from showing app-invitation controls, even after it is renamed.

**Architecture:** Add `currentParticipantId` as local participant-store metadata with deterministic migration from existing data. Keep invitation eligibility in a pure participant-feature helper so the Settings component uses one tested rule for post-save prompts, edit actions, and access-status visibility.

**Tech Stack:** Vue 3.5, TypeScript 6, Pinia 3, Vitest, Vite 8, npm

## Global Constraints

- Do not change the backend participant sync DTO or API contract.
- The self identity must survive participant renaming, recoloring, enabling, and disabling.
- Fresh state identifies the seeded **Me** profile; existing state follows the approved deterministic adult fallback rules.
- New adults created later must never automatically become the current participant.
- Preserve all unrelated uncommitted changes in the dirty worktree.
- Do not stage or commit without explicit approval.
- Run `npm test` and `npm run build`; run focused ESLint and Prettier checks for touched files.

---

## File Structure

- `src/app/stores/participants.ts`: owns persisted `currentParticipantId`, migration, default assignment, and `isCurrentParticipant()`.
- `src/app/stores/__tests__/participants.test.ts`: verifies fresh state, hydration, migration fallbacks, renaming, and empty-adult behavior.
- `src/features/participants/participantInvitationEligibility.ts`: pure rule for adult invitation actions and status visibility.
- `src/features/participants/__tests__/participantInvitationEligibility.test.ts`: verifies self and non-self eligibility cases.
- `src/features/participants/components/HouseholdMembersSettings.vue`: consumes the store identity and pure rule in the existing combined participant/invitation flow.

---

### Task 1: Persist the current participant identity

**Files:**

- Modify: `src/app/stores/participants.ts:17-365`
- Create: `src/app/stores/__tests__/participants.test.ts`

**Interfaces:**

- Consumes: the existing participant storage slice and default participant factory.
- Produces: `ParticipantsState.currentParticipantId: string | null` and `participantsStore.isCurrentParticipant(participantId: string): boolean`.

- [ ] **Step 1: Write failing participant-store tests**

Create `src/app/stores/__tests__/participants.test.ts` with mutable mocked storage:

```ts
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useParticipantsStore } from '@/app/stores/participants';

const mocks = vi.hoisted(() => ({
  storedParticipants: null as unknown,
  writeStorageSlice: vi.fn(),
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) =>
    key === 'settings.defaultParticipant.me'
      ? 'Me'
      : key === 'settings.defaultParticipant.partner'
        ? 'Partner'
        : key,
}));

vi.mock('@/shared/services/storageService', () => ({
  readStorageSlice: (key: string, fallback: unknown) =>
    key === 'participants' ? (mocks.storedParticipants ?? fallback) : fallback,
  writeStorageSlice: mocks.writeStorageSlice,
}));

function participant(
  id: string,
  name: string,
  type: 'adult' | 'child' = 'adult',
  isActive = true
) {
  return {
    id,
    name,
    initials: name.slice(0, 1).toUpperCase(),
    avatarColor: '#496a8f',
    type,
    isActive,
    createdAt: '2026-08-12T08:00:00.000Z',
    updatedAt: '2026-08-12T08:00:00.000Z',
  };
}

beforeEach(() => {
  mocks.storedParticipants = null;
  mocks.writeStorageSlice.mockReset();
  setActivePinia(createPinia());
});
```

Add these cases:

```ts
it('marks the seeded Me participant in fresh state', () => {
  const store = useParticipantsStore();
  const me = store.participants.find((item) => item.name === 'Me');

  expect(me).toBeDefined();
  expect(store.currentParticipantId).toBe(me?.id);
  expect(store.isCurrentParticipant(me?.id ?? '')).toBe(true);
});

it('keeps a valid stored identity after the participant is renamed', () => {
  mocks.storedParticipants = {
    participants: [
      participant('self-1', 'Rita'),
      participant('adult-2', 'Alex'),
    ],
    currentParticipantId: 'self-1',
  };
  const store = useParticipantsStore();

  store.updateParticipant('self-1', { name: 'Rita Nowak' });

  expect(store.currentParticipantId).toBe('self-1');
  expect(store.isCurrentParticipant('self-1')).toBe(true);
  expect(mocks.writeStorageSlice).toHaveBeenLastCalledWith('participants', {
    participants: store.participants,
    currentParticipantId: 'self-1',
  });
});

it('migrates a missing identity to the localized Me profile', () => {
  mocks.storedParticipants = {
    participants: [participant('adult-2', 'Alex'), participant('self-1', 'Me')],
  };

  expect(useParticipantsStore().currentParticipantId).toBe('self-1');
});

it('falls back to the first active adult when Me was already renamed', () => {
  mocks.storedParticipants = {
    participants: [
      participant('inactive', 'Old profile', 'adult', false),
      participant('self-1', 'Rita'),
      participant('adult-2', 'Alex'),
    ],
  };

  expect(useParticipantsStore().currentParticipantId).toBe('self-1');
});

it('uses an inactive adult only when no active adult exists', () => {
  mocks.storedParticipants = {
    participants: [participant('adult-1', 'Rita', 'adult', false)],
  };

  expect(useParticipantsStore().currentParticipantId).toBe('adult-1');
});

it('uses no current participant for child-only state', () => {
  mocks.storedParticipants = {
    participants: [participant('child-1', 'Sam', 'child')],
  };

  expect(useParticipantsStore().currentParticipantId).toBeNull();
  expect(useParticipantsStore().isCurrentParticipant('child-1')).toBe(false);
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
npm exec vitest -- run src/app/stores/__tests__/participants.test.ts
```

Expected: failures because `currentParticipantId` and `isCurrentParticipant()` do not exist.

- [ ] **Step 3: Add deterministic identity selection**

In `src/app/stores/participants.ts`, extend state and add the selection helper:

```ts
interface ParticipantsState {
  participants: Participant[];
  currentParticipantId: string | null;
}

function selectCurrentParticipantId(
  participants: Participant[],
  storedParticipantId?: string | null
) {
  const availableParticipants = participants.filter(
    (participant) => !participant.deletedAt
  );
  const storedParticipant = availableParticipants.find(
    (participant) => participant.id === storedParticipantId
  );

  if (storedParticipant) {
    return storedParticipant.id;
  }

  const meLabel = translate('settings.defaultParticipant.me')
    .trim()
    .toLocaleLowerCase();
  const namedMe = availableParticipants.find(
    (participant) =>
      participant.type === 'adult' &&
      participant.name.trim().toLocaleLowerCase() === meLabel
  );

  return (
    namedMe?.id ??
    availableParticipants.find(
      (participant) => participant.type === 'adult' && participant.isActive
    )?.id ??
    availableParticipants.find((participant) => participant.type === 'adult')
      ?.id ??
    null
  );
}
```

- [ ] **Step 4: Assign identity for fresh, legacy, and stored state**

Change default creation to return a full state without generating participants twice:

```ts
function createDefaultParticipantsState(): ParticipantsState {
  const me = createParticipant(
    translate('settings.defaultParticipant.me'),
    'adult',
    0
  );
  const partner = createParticipant(
    translate('settings.defaultParticipant.partner'),
    'adult',
    1
  );

  return {
    participants: [me, partner],
    currentParticipantId: me.id,
  };
}
```

In `getStoredState()`, return the default state when no stored or legacy participants exist. For legacy and stored participants, normalize once and return:

```ts
return {
  participants,
  currentParticipantId: selectCurrentParticipantId(
    participants,
    storedState.currentParticipantId
  ),
};
```

For recovered legacy meeting participants, omit the second argument so the same migration rules apply.

- [ ] **Step 5: Persist and expose the stable identity**

Update store actions:

```ts
persist() {
  writeStorageSlice('participants', {
    participants: this.participants,
    currentParticipantId: this.currentParticipantId,
  });
},
ensureDefaultParticipants() {
  if (this.participants.length) {
    return;
  }

  const defaults = createDefaultParticipantsState();
  this.participants = defaults.participants;
  this.currentParticipantId = defaults.currentParticipantId;
  this.persist();
},
isCurrentParticipant(participantId: string) {
  return Boolean(participantId) && this.currentParticipantId === participantId;
},
```

Do not change `currentParticipantId` in `createParticipant()` or `updateParticipant()`.

- [ ] **Step 6: Run participant-store tests**

Run:

```bash
npm exec vitest -- run src/app/stores/__tests__/participants.test.ts
```

Expected: all participant identity tests pass.

- [ ] **Step 7: Review checkpoint**

Confirm the persisted participant slice contains both fields and the participant sync DTO remains unchanged. Do not stage or commit.

---

### Task 2: Centralize invitation eligibility and hide self access UI

**Files:**

- Create: `src/features/participants/participantInvitationEligibility.ts`
- Create: `src/features/participants/__tests__/participantInvitationEligibility.test.ts`
- Modify: `src/features/participants/components/HouseholdMembersSettings.vue:165-184,607-636`

**Interfaces:**

- Consumes: `Participant | null`, `ParticipantAccessStatus`, current-participant identity, and workspace permission.
- Produces: `canOfferParticipantInvitation(input): boolean` and `shouldShowParticipantAccessStatus(input): boolean`.

- [ ] **Step 1: Write failing pure eligibility tests**

Create `src/features/participants/__tests__/participantInvitationEligibility.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  canOfferParticipantInvitation,
  shouldShowParticipantAccessStatus,
} from '@/features/participants/participantInvitationEligibility';
import type { Participant } from '@/features/participants/types';

const adult: Participant = {
  id: 'adult-1',
  name: 'Alex',
  initials: 'A',
  avatarColor: '#496a8f',
  type: 'adult',
  isActive: true,
  createdAt: '2026-08-12T08:00:00.000Z',
  updatedAt: '2026-08-12T08:00:00.000Z',
};

const eligibleInput = {
  participant: adult,
  isCurrentParticipant: false,
  canInviteMembers: true,
  accessStatus: 'none' as const,
};

describe('participant invitation eligibility', () => {
  it('never offers an invitation or access status for the current participant', () => {
    const input = { ...eligibleInput, isCurrentParticipant: true };

    expect(canOfferParticipantInvitation(input)).toBe(false);
    expect(
      shouldShowParticipantAccessStatus({ ...input, accessStatus: 'active' })
    ).toBe(false);
  });

  it('offers an invitation for another unlinked adult with permission', () => {
    expect(canOfferParticipantInvitation(eligibleInput)).toBe(true);
  });

  it('rejects children, linked adults, and users without permission', () => {
    expect(
      canOfferParticipantInvitation({
        ...eligibleInput,
        participant: { ...adult, type: 'child' },
      })
    ).toBe(false);
    expect(
      canOfferParticipantInvitation({
        ...eligibleInput,
        accessStatus: 'pending',
      })
    ).toBe(false);
    expect(
      canOfferParticipantInvitation({
        ...eligibleInput,
        canInviteMembers: false,
      })
    ).toBe(false);
  });

  it('shows access status only for another linked adult with permission', () => {
    expect(
      shouldShowParticipantAccessStatus({
        ...eligibleInput,
        accessStatus: 'pending',
      })
    ).toBe(true);
    expect(shouldShowParticipantAccessStatus(eligibleInput)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run:

```bash
npm exec vitest -- run src/features/participants/__tests__/participantInvitationEligibility.test.ts
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement the pure eligibility helper**

Create `src/features/participants/participantInvitationEligibility.ts`:

```ts
import type { Participant } from '@/features/participants/types';
import type { ParticipantAccessStatus } from '@/features/workspace/types';

interface ParticipantInvitationEligibilityInput {
  participant: Participant | null;
  isCurrentParticipant: boolean;
  canInviteMembers: boolean;
  accessStatus: ParticipantAccessStatus;
}

export function canOfferParticipantInvitation({
  participant,
  isCurrentParticipant,
  canInviteMembers,
  accessStatus,
}: ParticipantInvitationEligibilityInput) {
  return Boolean(
    participant &&
    participant.type === 'adult' &&
    !isCurrentParticipant &&
    canInviteMembers &&
    accessStatus === 'none'
  );
}

export function shouldShowParticipantAccessStatus({
  participant,
  isCurrentParticipant,
  canInviteMembers,
  accessStatus,
}: ParticipantInvitationEligibilityInput) {
  return Boolean(
    participant &&
    participant.type === 'adult' &&
    !isCurrentParticipant &&
    canInviteMembers &&
    accessStatus !== 'none'
  );
}
```

- [ ] **Step 4: Use the helper for every participant access decision**

Import both helpers in `HouseholdMembersSettings.vue`. Replace the local eligibility body with:

```ts
function getInvitationEligibilityInput(participant: Participant | null) {
  const accessStatus = participant
    ? workspaceStore.getParticipantAccessState(participant.id).status
    : 'none';

  return {
    participant,
    isCurrentParticipant: participant
      ? participantsStore.isCurrentParticipant(participant.id)
      : false,
    canInviteMembers: can('inviteMembers'),
    accessStatus,
  };
}

function canInviteParticipant(participant: Participant | null) {
  return canOfferParticipantInvitation(
    getInvitationEligibilityInput(participant)
  );
}

const showSelectedParticipantAccess = computed(() =>
  shouldShowParticipantAccessStatus(
    getInvitationEligibilityInput(selectedParticipant.value)
  )
);
```

Change the template's access-status condition to:

```vue
<p
  v-else-if="showSelectedParticipantAccess"
  class="participant-access-status"
  role="status"
>
```

The existing create, type-change, edit-action, and status paths now all use the same self-aware rule.

- [ ] **Step 5: Run focused tests and type-check build**

Run:

```bash
npm exec vitest -- run src/app/stores/__tests__/participants.test.ts src/features/participants/__tests__/participantInvitationEligibility.test.ts
npm run build
```

Expected: focused tests and build pass.

- [ ] **Step 6: Review checkpoint**

Confirm the own profile renders neither **Give app access** nor access status, while another adult still can. Do not stage or commit.

---

### Task 3: Complete verification

**Files:**

- Verify: all files changed in Tasks 1-2

**Interfaces:**

- Consumes: completed participant identity and invitation eligibility changes.
- Produces: a regression-tested correction ready for manual review.

- [ ] **Step 1: Format touched files**

Run:

```bash
npm exec prettier -- --write src/app/stores/participants.ts src/app/stores/__tests__/participants.test.ts src/features/participants/participantInvitationEligibility.ts src/features/participants/__tests__/participantInvitationEligibility.test.ts src/features/participants/components/HouseholdMembersSettings.vue
```

- [ ] **Step 2: Run focused lint and format checks**

Run:

```bash
npm exec eslint -- src/app/stores/participants.ts src/app/stores/__tests__/participants.test.ts src/features/participants/participantInvitationEligibility.ts src/features/participants/__tests__/participantInvitationEligibility.test.ts src/features/participants/components/HouseholdMembersSettings.vue
npm exec prettier -- --check src/app/stores/participants.ts src/app/stores/__tests__/participants.test.ts src/features/participants/participantInvitationEligibility.ts src/features/participants/__tests__/participantInvitationEligibility.test.ts src/features/participants/components/HouseholdMembersSettings.vue
```

Expected: both focused checks pass.

- [ ] **Step 3: Run full regression tests and build**

Run:

```bash
npm test
npm run build
```

Expected: all tests and the production web build pass.

- [ ] **Step 4: Manually verify the correction**

In Settings:

1. Open the seeded **Me** profile: no **Give app access** action appears.
2. Rename **Me**, close, and reopen it: the action remains absent.
3. Open the other adult: **Give app access** remains available when unlinked.
4. Create another adult: the optional invitation step still appears.
5. Open a linked non-self adult: pending or active access status still appears.

- [ ] **Step 5: Audit the dirty worktree**

Run:

```bash
git -c safe.directory=D:/Projects/myself/weekly-us diff --check
git -c safe.directory=D:/Projects/myself/weekly-us status --short
```

Do not stage, commit, restore, or discard unrelated changes.
