# Meeting Permissions and Composer Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure only workspace viewers receive the meeting read-only state and make the add-item composer use OurWeek’s existing mobile controls.

**Architecture:** Keep permission decisions in the workspace store and meeting-session helper: the authenticated fallback role applies only before server membership hydration, while server membership remains authoritative afterward. Recompose the task-specific composer controls from existing picker components; no new dependency or feature-specific picker is needed.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, Vitest, Vue Test Utils, vue-i18n.

## Global Constraints

- Use Vue 3 `<script setup lang="ts">`, typed props, and existing component boundaries.
- The mobile app must use large touch targets and shared bottom-sheet/picker behavior.
- `owner` and `adult_member` can create and edit meetings; `viewer` cannot.
- Do not change backend role authorization, role definitions, invitation behavior, or meeting data shape.
- Reuse existing `SelectPickerField` and `DatePickerField`; do not add a dependency.
- Run `npm run build` and `npm run check` before handoff.
- Do not create a Git commit without an explicit user request.

---

## File Structure

| File                                                                    | Responsibility                                                                |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/app/stores/workspace.ts`                                           | Preserve authenticated role in the unsynced workspace placeholder.            |
| `src/app/stores/__tests__/workspace.test.ts`                            | Prove hydration fallback preserves owner/adult access and viewer restriction. |
| `src/features/meeting/composables/useMeetingSession.ts`                 | Convert role capability into the read-only/resume/templates route decision.   |
| `src/features/meeting/composables/__tests__/useMeetingSession.test.ts`  | Cover owner, adult, and viewer route outcomes.                                |
| `src/features/meeting/components/MeetingItemComposer.vue`               | Reuse shared mobile selectors and style composer fields/actions.              |
| `src/features/meeting/components/__tests__/MeetingItemComposer.test.ts` | Assert shared picker components and action classes.                           |

### Task 1: Preserve the authenticated workspace role before hydration

**Files:**

- Modify: `src/app/stores/workspace.ts`
- Modify: `src/app/stores/__tests__/workspace.test.ts`

**Interfaces:**

- Consumes: `resetForAuthenticatedUser(userId: string, role: UserRole)` from the workspace store and `UserRole` from `src/features/access/types.ts`.
- Produces: `currentUserRole: UserRole`, returning the placeholder member’s authenticated role until server membership is applied.

- [ ] **Step 1: Add regression cases for every authenticated placeholder role**

Add a `describe('authenticated workspace placeholder role', ...)` block in `workspace.test.ts`:

```ts
it.each(['owner', 'adult_member', 'viewer'] as const)(
  'keeps %s as the effective role until workspace hydration',
  (role) => {
    const store = useWorkspaceStore();

    store.resetForAuthenticatedUser('session-user', role);

    expect(store.currentUserRole).toBe(role);
  }
);
```

- [ ] **Step 2: Run the focused workspace test to verify the owner and adult cases fail**

Run: `npx vitest run src/app/stores/__tests__/workspace.test.ts`

Expected: the `owner` and `adult_member` cases fail because the current unsynced getter falls back to `viewer`.

- [ ] **Step 3: Store the passed authenticated role in the placeholder membership**

In `resetForAuthenticatedUser`, ensure the placeholder member created for `userId` has `role` set from the method parameter rather than a literal `viewer`. Retain the existing `currentUserRole` getter so it returns that member’s role until `applyWorkspace()` supplies hydrated membership.

```ts
resetForAuthenticatedUser(userId: string, role: UserRole = 'viewer') {
  this.currentUserId = userId;
  this.workspace = createAuthenticatedWorkspacePlaceholder(userId, role);
}
```

Use the actual existing placeholder construction rather than introducing `createAuthenticatedWorkspacePlaceholder` if it does not already exist.

- [ ] **Step 4: Run the focused workspace test to verify all roles pass**

Run: `npx vitest run src/app/stores/__tests__/workspace.test.ts`

Expected: PASS; owner and adult retain access before hydration, and viewer remains viewer.

- [ ] **Step 5: Review the scoped diff without committing**

Run: `git -c safe.directory=D:/Projects/myself/weekly-us diff -- src/app/stores/workspace.ts src/app/stores/__tests__/workspace.test.ts`

Expected: only placeholder-role handling and its regression cases are present.

### Task 2: Make the read-only meeting route viewer-only

**Files:**

- Modify: `src/features/meeting/composables/useMeetingSession.ts`
- Modify: `src/features/meeting/composables/__tests__/useMeetingSession.test.ts`

**Interfaces:**

- Consumes: `can('createMeetings')` supplied by `useWorkspacePermissions()`.
- Produces: `getMeetingRouteDecision(canCreateMeeting: boolean, activeMeeting: Meeting | null, meetings: Meeting[]): MeetingRouteDecision`.

- [ ] **Step 1: Expand route-decision tests to name the three role outcomes**

Replace the anonymous boolean-only read-only test with role-labelled cases. Use the capability mapping implied by the product rules:

```ts
it.each([
  ['owner', true, { type: 'templates' }],
  ['adult_member', true, { type: 'templates' }],
  ['viewer', false, { type: 'readonly' }],
] as const)(
  'routes %s correctly when no meeting is active',
  (_role, canCreate, expected) => {
    expect(getMeetingRouteDecision(canCreate, null, [])).toEqual(expected);
  }
);
```

- [ ] **Step 2: Run the meeting-session unit test**

Run: `npx vitest run src/features/meeting/composables/__tests__/useMeetingSession.test.ts`

Expected: PASS after Task 1; the capability-based helper already maps editable roles to templates and viewers to read-only.

- [ ] **Step 3: Verify the session initialization retains the route result**

In `useMeetingSession`, retain the existing initialization order: call `getMeetingRouteDecision(canCreateMeeting.value, activeMeeting.value, meetingsStore.meetings)`, return immediately for `readonly`, route to `meeting-templates` for `templates`, and resume an unfinished meeting otherwise. Do not add a page-level role check; this keeps one source of truth for the meeting route decision.

- [ ] **Step 4: Run both permission-focused test files**

Run: `npx vitest run src/app/stores/__tests__/workspace.test.ts src/features/meeting/composables/__tests__/useMeetingSession.test.ts`

Expected: PASS.

- [ ] **Step 5: Review the scoped diff without committing**

Run: `git -c safe.directory=D:/Projects/myself/weekly-us diff -- src/features/meeting/composables/useMeetingSession.ts src/features/meeting/composables/__tests__/useMeetingSession.test.ts`

Expected: route logic remains capability-based and tests make the owner/adult/viewer contract explicit.

### Task 3: Replace composer-native controls with shared mobile components

**Files:**

- Modify: `src/features/meeting/components/MeetingItemComposer.vue`
- Modify: `src/features/meeting/components/__tests__/MeetingItemComposer.test.ts`

**Interfaces:**

- Consumes: `SelectPickerField` with `modelValue`, `label`, and `options`, plus `DatePickerField` with `modelValue` and `label`.
- Produces: unchanged `submitItem({ type, fields })` payload where `responsibilityChoice` and `dueDate` remain strings.

- [ ] **Step 1: Add structural composer tests before changing the template**

Mount a task composer and assert its shared mobile controls and footer action classes:

```ts
const wrapper = mount(MeetingItemComposer, {
  props: {
    open: true,
    participants: [{ id: 'rita', name: 'Rita' }],
    scope: {
      userId: 'user-1',
      workspaceId: 'workspace-1',
      meetingId: 'meeting-1',
      sectionId: 'tasks',
      type: 'task',
    },
    submitItem: vi.fn(),
  },
  global: { stubs: { BaseBottomSheet: { template: '<div><slot /></div>' } } },
});

expect(wrapper.findComponent({ name: 'SelectPickerField' }).exists()).toBe(
  true
);
expect(wrapper.findComponent({ name: 'DatePickerField' }).exists()).toBe(true);
expect(
  wrapper.get('.meeting-item-composer__actions .secondary-button').exists()
).toBe(true);
expect(
  wrapper.get('.meeting-item-composer__actions .meeting-primary').exists()
).toBe(true);
```

- [ ] **Step 2: Run the composer test to verify it fails**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingItemComposer.test.ts`

Expected: FAIL because the composer still renders native `select` and `input[type='date']`, and Cancel has no secondary class.

- [ ] **Step 3: Reuse the existing picker components while preserving draft updates**

Import `SelectPickerField`, `DatePickerField`, and `PickerOption`. Build `taskResponsibilityOptions` from unassigned, shared, and `props.participants`. Bind both picker components through computed setters that call `updateTaskField`:

```ts
const taskResponsibilityChoice = computed({
  get: () =>
    String(composer.fields.value.responsibilityChoice ?? 'needsDiscussion'),
  set: (value: string) => updateTaskField('responsibilityChoice', value),
});
const taskDueDate = computed({
  get: () => String(composer.fields.value.dueDate ?? ''),
  set: (value: string) => updateTaskField('dueDate', value),
});
```

Replace the native `select` with `SelectPickerField v-model="taskResponsibilityChoice"` and the native date input with `DatePickerField v-model="taskDueDate"`. Give Cancel `class="secondary-button"`.

- [ ] **Step 4: Apply locally scoped layout refinements to the composer**

Keep the sheet content’s 16px mobile padding, increase its vertical rhythm through existing spacing tokens, make the footer actions span the available width, and give each action an equal, touch-safe width. Do not restyle shared inputs globally. Use the existing `meeting-primary` and `secondary-button` classes for colors, focus states, and disabled behavior.

- [ ] **Step 5: Run the composer test to verify it passes**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingItemComposer.test.ts`

Expected: PASS; note validation remains covered and task composer uses shared controls.

- [ ] **Step 6: Review the scoped diff without committing**

Run: `git -c safe.directory=D:/Projects/myself/weekly-us diff -- src/features/meeting/components/MeetingItemComposer.vue src/features/meeting/components/__tests__/MeetingItemComposer.test.ts`

Expected: no dependency changes, no native task select/date input, and no change to saved payload field names.

### Task 4: Verify the integrated repair

**Files:**

- Modify: no source files expected

**Interfaces:**

- Consumes: Tasks 1–3.
- Produces: validated build and project checks.

- [ ] **Step 1: Run all focused regression tests**

Run: `npx vitest run src/app/stores/__tests__/workspace.test.ts src/features/meeting/composables/__tests__/useMeetingSession.test.ts src/features/meeting/components/__tests__/MeetingItemComposer.test.ts`

Expected: PASS.

- [ ] **Step 2: Run formatting and static checks**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: PASS; Vue type checking and Vite production build complete without errors.

- [ ] **Step 4: Inspect final changes before handoff**

Run: `git -c safe.directory=D:/Projects/myself/weekly-us diff --check`

Expected: no whitespace errors.

## Plan Self-Review

- Spec coverage: Tasks 1–2 cover the owner/adult/viewer route contract and pre-hydration fallback. Task 3 covers replacing native controls and visual consistency. Task 4 covers all required validation.
- Placeholder scan: the implementation calls, components, test targets, and commands are all specified; no deferred work is included.
- Type consistency: the plan preserves the existing `UserRole`, `MeetingRouteDecision`, and string-based composer field payloads.
