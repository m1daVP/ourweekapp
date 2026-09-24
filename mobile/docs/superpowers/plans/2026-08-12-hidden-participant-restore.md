# Hidden Participant Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep hidden household members reachable in Settings so users can show them in new meetings again.

**Architecture:** Add a management-only Pinia getter that returns all non-deleted participants with active people first, while leaving the meeting-facing `activeParticipants` getter unchanged. Render that getter in `HouseholdMembersSettings.vue`, visibly label inactive rows, and reuse the existing edit-sheet restore action.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia 3, Vitest, vue-i18n, existing global CSS.

## Global Constraints

- The application is mobile-only; retain semantic buttons and existing touch targets.
- Hidden participants must remain excluded from new meetings until restored.
- Past meetings and existing participant references must not change.
- Do not add a dependency or change the persisted participant shape.
- Use the existing localized `settings.hiddenFromNewMeetings` and `settings.showInNewMeetings` copy.
- Do not create a Git commit unless the user explicitly requests one.

---

### Task 1: Add the household-management participant list

**Files:**

- Modify: `src/app/stores/participants.ts:292-303`
- Test: `src/app/stores/__tests__/participants.test.ts`

**Interfaces:**

- Consumes: `ParticipantsState.participants: Participant[]` and each participant's `isActive` and optional `deletedAt` properties.
- Produces: Pinia getter `householdParticipants: Participant[]`, containing active non-deleted participants followed by inactive non-deleted participants, with relative order preserved inside each group.

- [x] **Step 1: Write the failing management-list tests**

Append this suite to `src/app/stores/__tests__/participants.test.ts`:

```ts
describe('participants store household management list', () => {
  it('keeps hidden participants manageable after active participants', () => {
    mocks.storedParticipants = {
      participants: [
        participant('active-1', 'Rita'),
        participant('hidden-1', 'Alex', 'adult', false),
        participant('active-2', 'Sam', 'child'),
        {
          ...participant('deleted-1', 'Deleted'),
          deletedAt: '2026-08-12T09:00:00.000Z',
        },
      ],
      currentParticipantId: 'active-1',
    };

    const store = useParticipantsStore();

    expect(store.householdParticipants.map(({ id }) => id)).toEqual([
      'active-1',
      'active-2',
      'hidden-1',
    ]);
  });

  it('moves a restored participant back into the active group and persists it', () => {
    mocks.storedParticipants = {
      participants: [
        participant('active-1', 'Rita'),
        participant('hidden-1', 'Alex', 'adult', false),
      ],
      currentParticipantId: 'active-1',
    };
    const store = useParticipantsStore();

    store.enableParticipant('hidden-1');

    expect(store.getParticipantById('hidden-1')?.isActive).toBe(true);
    expect(store.householdParticipants.map(({ id }) => id)).toEqual([
      'active-1',
      'hidden-1',
    ]);
    expect(mocks.writeStorageSlice).toHaveBeenCalledWith('participants', {
      participants: store.participants,
      currentParticipantId: 'active-1',
    });
  });
});
```

- [x] **Step 2: Run the tests and verify the new getter is missing**

Run:

```bash
npx vitest run src/app/stores/__tests__/participants.test.ts
```

Expected: FAIL because `householdParticipants` does not exist.

- [x] **Step 3: Add the minimal management getter**

Add this getter beside `activeParticipants` in `src/app/stores/participants.ts`:

```ts
householdParticipants: (state) => {
  const participants = state.participants.filter(
    (participant) => !participant.deletedAt
  );

  return [
    ...participants.filter((participant) => participant.isActive),
    ...participants.filter((participant) => !participant.isActive),
  ];
},
```

Do not change `activeParticipants`; meeting creation must continue to exclude inactive participants.

- [x] **Step 4: Run the focused store tests**

Run:

```bash
npx vitest run src/app/stores/__tests__/participants.test.ts
```

Expected: all participant-store tests PASS.

### Task 2: Keep hidden members visible and expose restoration

**Files:**

- Modify: `src/features/participants/components/HouseholdMembersSettings.vue:65-67, 437-455`

**Interfaces:**

- Consumes: `participantsStore.householdParticipants: Participant[]` from Task 1 and existing `enableParticipant(participantId: string)`.
- Produces: A household member list where inactive rows remain tappable, show `settings.hiddenFromNewMeetings`, and open the existing edit sheet containing `settings.showInNewMeetings`.

- [x] **Step 1: Switch the component to the management getter**

Replace the current computed list with:

```ts
const visibleParticipants = computed(
  () => participantsStore.householdParticipants
);
```

- [x] **Step 2: Expose the inactive state in the row**

Update the list item and hidden-state markup to:

```vue
<li
  v-for="participant in visibleParticipants"
  :key="participant.id"
  :class="{ 'is-disabled': !participant.isActive }"
>
  <button
    class="household-member-row"
    type="button"
    :aria-label="
      t('settings.editParticipantLabel', { name: participant.name })
    "
    @click="openEditSheet(participant)"
  >
    <span
      class="participant-avatar participant-avatar--large"
      :style="{ backgroundColor: participant.avatarColor }"
    >
      {{ participant.initials }}
    </span>
    <span class="household-member-row__body">
      <strong>{{ participant.name }}</strong>
      <small>{{ getTypeLabel(participant.type) }}</small>
      <small v-if="!participant.isActive">
        {{ t('settings.hiddenFromNewMeetings') }}
      </small>
    </span>
  </button>
</li>
```

Retain the existing button's `@click="openEditSheet(participant)"`. Remove the `sr-only` class from the hidden-state text so the state is visible. The existing `.household-member-list li.is-disabled` style supplies the subdued presentation without introducing new CSS.

- [x] **Step 3: Format and lint the changed implementation files**

Run:

```bash
npx prettier --write src/app/stores/participants.ts src/app/stores/__tests__/participants.test.ts src/features/participants/components/HouseholdMembersSettings.vue
npx eslint src/app/stores/participants.ts src/app/stores/__tests__/participants.test.ts src/features/participants/components/HouseholdMembersSettings.vue
```

Expected: both commands succeed.

- [x] **Step 4: Run focused and full automated verification**

Run:

```bash
npx vitest run src/app/stores/__tests__/participants.test.ts
npm test
npm run build
```

Expected: focused tests PASS, full tests PASS, and production build succeeds.

- [x] **Step 5: Run final format and diff checks**

Run:

```bash
npx prettier --check src/app/stores/participants.ts src/app/stores/__tests__/participants.test.ts src/features/participants/components/HouseholdMembersSettings.vue docs/superpowers/specs/2026-08-12-hidden-participant-restore-design.md docs/superpowers/plans/2026-08-12-hidden-participant-restore.md
git diff --check
```

Expected: Prettier reports all matched files formatted and `git diff --check` reports no whitespace errors. Line-ending warnings are acceptable when no error is reported.
