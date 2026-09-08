# Owner-only Household-name Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict household-name editing to workspace owners in the client UI and store.

**Architecture:** The existing backend owner guard remains authoritative. The household-settings component will reuse its owner-only capability to hide and guard name editing, while the workspace store will prevent direct non-owner calls to its update API wrapper.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vitest, Vue Test Utils.

## Global Constraints

- Reuse `manageWorkspace`; do not change roles, API contracts, or backend code.
- Keep non-owner workspace viewing unchanged.
- Do not stage or commit changes without explicit user approval.

---

### Task 1: Restrict household-name UI and store action

**Files:**

- Modify: `src/features/participants/components/HouseholdMembersSettings.vue:396-422,566-575`
- Modify: `src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts`
- Modify: `src/app/stores/workspace.ts:393-412`
- Modify: `src/app/stores/__tests__/workspace.test.ts`

**Interfaces:**

- Consumes: `canManageHouseholdParticipants: ComputedRef<boolean>` and `roleCan(this.currentUserRole, 'manageWorkspace')`.
- Produces: no edit-name button or update API call for adult members and viewers.

- [ ] **Step 1: Add failing regressions**

Extend the component test with the owner-only edit control:

```ts
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
```

Extend the workspace-store test with an adult member case:

```ts
await expect(store.saveWorkspaceName('Renamed home')).resolves.toBe(false);
expect(updateWorkspaceMock).not.toHaveBeenCalled();
```

- [ ] **Step 2: Verify the test fails**

Run: `npm exec vitest -- run src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts src/app/stores/__tests__/workspace.test.ts`

Expected: non-owner tests fail because the edit button and store API call are currently allowed.

- [ ] **Step 3: Apply the minimal permission gates**

Render the `.household-settings-edit` button only when `canManageHouseholdParticipants` is true. At the start of `openHouseholdNameSheet` and `saveHouseholdName`, return when it is false. At the start of `saveWorkspaceName`, add:

```ts
if (!roleCan(this.currentUserRole, 'manageWorkspace')) {
  return false;
}
```

- [ ] **Step 4: Verify and review**

Run: `npm exec prettier -- --write src/features/participants/components/HouseholdMembersSettings.vue src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts src/app/stores/workspace.ts src/app/stores/__tests__/workspace.test.ts`

Run: `npm exec vitest -- run src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts src/app/stores/__tests__/workspace.test.ts`

Run: `npm run build`

Run: `npm exec eslint -- src/features/participants/components/HouseholdMembersSettings.vue src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts src/app/stores/workspace.ts src/app/stores/__tests__/workspace.test.ts`

Expected: all targeted checks pass; owner behavior remains unchanged; no non-owner update request is sent.

## Self-review

- Spec coverage: component visibility/action guards and store API prevention are covered; backend remains unchanged because it already enforces ownership.
- Placeholder scan: no unresolved work markers remain.
- Type consistency: both permission checks use existing boolean interfaces and return values of the current actions.
