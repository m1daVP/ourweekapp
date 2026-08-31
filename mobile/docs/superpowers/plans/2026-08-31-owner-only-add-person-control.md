# Owner-only Add-person Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide and prevent the household “Add person” flow for non-owner workspace members.

**Architecture:** Reuse the existing `manageWorkspace` role permission inside `HouseholdMembersSettings`. A component-level capability derived from `useWorkspacePermissions().can` controls both the button rendering and defensive action guards, keeping the UI and behavior aligned.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, vue-i18n, Vitest, Vue Test Utils.

## Global Constraints

- Reuse the existing owner-only `manageWorkspace` permission; do not add a role or dependency.
- Keep invitation, meeting guest, participant editing, and backend behavior unchanged.
- Prevent direct or stale UI calls from creating a participant for a non-owner.
- Do not stage or commit changes without explicit user approval.

---

## File structure

- `src/features/participants/components/HouseholdMembersSettings.vue`: controls household participant creation and renders the Add person action.
- `src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts`: verifies owner-only control visibility and non-owner action safety.

### Task 1: Restrict the household add-person flow to owners

**Files:**
- Modify: `src/features/participants/components/HouseholdMembersSettings.vue:34,187-196,433-464,606-615`
- Create: `src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts`

**Interfaces:**
- Consumes: `can(permission: WorkspacePermission): boolean` from `useWorkspacePermissions()`.
- Produces: a `canManageHouseholdParticipants` computed boolean based on `can('manageWorkspace')`.
- Uses: `participantsStore.createParticipant(payload)` only when `canManageHouseholdParticipants.value` is true.

- [ ] **Step 1: Write the failing component regression tests**

Mount `HouseholdMembersSettings` with active Pinia and the project i18n plugin. Seed an owner workspace for the owner case and an `adult_member` workspace for the non-owner case. Stub `BaseBottomSheet` and `AvatarColorPickerSheet` as simple components.

```ts
it('shows Add person only to the workspace owner', () => {
  setWorkspaceRole('owner');
  expect(mountHouseholdMembersSettings().get('button.household-settings-add-button').text())
    .toContain('Add person');

  setWorkspaceRole('adult_member');
  expect(mountHouseholdMembersSettings().find('button.household-settings-add-button').exists())
    .toBe(false);
});
```

Use the exposed component method or trigger the form submission after forcing create mode to assert that an adult member does not call `participantsStore.createParticipant`.

- [ ] **Step 2: Run the focused component test before implementation**

Run: `npm exec vitest -- run src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts`

Expected: FAIL because the button currently renders for every role and `openCreateSheet` has no permission gate.

- [ ] **Step 3: Add a single derived permission and use it for rendering**

After destructuring `can`, add:

```ts
const canManageHouseholdParticipants = computed(() =>
  can('manageWorkspace')
);
```

Wrap the add button with its owner-only condition:

```vue
<button
  v-if="canManageHouseholdParticipants"
  class="household-settings-add-button"
  type="button"
  @click="openCreateSheet"
>
  <!-- existing icon and translated label -->
</button>
```

- [ ] **Step 4: Guard both creation entry points**

At the start of `openCreateSheet`, add:

```ts
if (!canManageHouseholdParticipants.value) {
  return;
}
```

At the start of the `sheetMode.value === 'create'` branch in `saveParticipantDraft`, add the same return before calling `participantsStore.createParticipant(payload)`.

- [ ] **Step 5: Verify focused behavior and client checks**

Run: `npm exec vitest -- run src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts src/app/stores/__tests__/workspace.test.ts`

Run: `npm run build`

Run: `npm exec eslint -- src/features/participants/components/HouseholdMembersSettings.vue src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts`

Expected: tests, TypeScript, build, and scoped lint pass. The owner sees and can use Add person; non-owners do not see it and cannot create a participant through a direct action.

- [ ] **Step 6: Review the scoped diff**

Run: `git -c safe.directory='D:/Projects/myself/weekly-us' diff --check`

Expected: no whitespace errors. Do not stage or commit without explicit user approval.

## Self-review

- Spec coverage: the plan hides the owner-only control and adds guards for both normal and direct/stale create flows; it leaves unrelated participant and invitation behavior alone.
- Placeholder scan: no unresolved work markers remain.
- Type consistency: `canManageHouseholdParticipants` is a Vue computed ref and is accessed with `.value` in script and auto-unwrapped in the template.
