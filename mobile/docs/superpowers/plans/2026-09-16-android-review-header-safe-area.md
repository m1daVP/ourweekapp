# Android Review Header Safe-Area Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the meeting review-and-finish header opaque and sticky at the physical top of Android screens without changing the layout of other meeting steps.

**Architecture:** `MeetingPage.vue` will expose the final-review state as a page-level modifier class. The existing meeting scroll container rule will use that modifier to transfer top safe-area ownership from `.app-main` to the review header, which already includes `env(safe-area-inset-top)`.

**Tech Stack:** Vue 3.5, TypeScript 6, Vite 8, Vitest 4, CSS, Capacitor 8 Android WebView

## Global Constraints

- Keep the change mobile-only and Android-first while remaining iOS-ready.
- Preserve the review header's existing sticky positioning and safe-area padding.
- Preserve horizontal padding, bottom action spacing, and all non-review meeting layouts.
- Add no dependencies.
- Do not commit unless the user explicitly requests it.

---

### Task 1: Mark and verify the final-review layout

**Files:**

- Modify: `src/pages/MeetingPage.vue:329-336`
- Create: `src/pages/__tests__/MeetingPage.test.ts`

**Interfaces:**

- Consumes: `isParticipantCheckInStep: Ref<boolean>` and `isFinalSection: Ref<boolean>` from `useMeetingSession()`.
- Produces: the `meeting-page--review-close` modifier on the `MeetingPage` root section only while `isFinalSection` is true.

- [ ] **Step 1: Write the failing render test**

Create a shallow-mount test with `useMeetingSession()` mocked through a hoisted state object. Set `activeMeeting` and `currentSection` to non-null values, set `isFinalSection` to `true`, and assert:

```ts
expect(wrapper.get('.meeting-page').classes()).toContain(
  'meeting-page--review-close'
);
```

Set `isFinalSection.value = false`, await `nextTick()`, and assert:

```ts
expect(wrapper.get('.meeting-page').classes()).not.toContain(
  'meeting-page--review-close'
);
```

The mock must return callable `vi.fn()` values for methods consumed as event handlers, reactive values for every destructured session field, empty arrays for list props, and `{ tasks: 0, agreements: 0, notes: 0, hasContent: false }` for `reviewCounts`. Mock `useWorkspaceStore()` with `currentUserId: 'user-1'` and `workspace: { id: 'workspace-1' }`.

- [ ] **Step 2: Run the focused test and confirm the contract is initially absent**

Run:

```bash
npx vitest run src/pages/__tests__/MeetingPage.test.ts
```

Expected: FAIL because `.meeting-page` does not yet receive `meeting-page--review-close`.

- [ ] **Step 3: Add the final-review modifier**

Change the root class binding in `MeetingPage.vue` to:

```vue
:class="[ 'meeting-page', { 'meeting-page--check-in': isParticipantCheckInStep,
'meeting-page--review-close': isFinalSection, }, ]"
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
npx vitest run src/pages/__tests__/MeetingPage.test.ts
```

Expected: PASS for both the final-review and non-final states.

- [ ] **Step 5: Review checkpoint**

Inspect the diff and confirm that this task changes only the root layout class and its focused test. Do not commit.

### Task 2: Transfer safe-area ownership to the review header

**Files:**

- Modify: `src/styles/main.css:472-475`

**Interfaces:**

- Consumes: `.app-shell--meeting`, `.app-main`, and the `meeting-page--review-close` descendant marker produced by Task 1.
- Produces: review-only `.app-main` top padding of `0`, with existing horizontal and bottom padding retained.

- [ ] **Step 1: Add the scoped override immediately after the generic meeting rule**

```css
.app-shell--meeting .app-main:has(.meeting-page--review-close) {
  padding-top: 0;
}
```

This lets `.review-close-top-bar` remain `position: sticky; top: 0` and own `env(safe-area-inset-top)` through its existing minimum height and padding.

- [ ] **Step 2: Run the focused meeting tests**

Run:

```bash
npx vitest run src/pages/__tests__/MeetingPage.test.ts src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run repository verification**

Run:

```bash
npm run build
npm run check
```

Expected: both commands exit successfully. If `format:check` reports unrelated pre-existing files, report them separately and do not rewrite unrelated work.

- [ ] **Step 4: Review the final diff**

Confirm that:

- the review modifier is present only when `isFinalSection` is true;
- the CSS override changes only `padding-top`;
- `.review-close-top-bar` still has `position: sticky`, `top: 0`, an opaque background, and internal safe-area padding;
- unrelated worktree changes remain untouched.

- [ ] **Step 5: Android manual verification**

After syncing or installing the resulting build on Android, open a meeting's review-and-finish step, scroll until a card passes behind the header, and verify that no content appears in the status-bar area. Also verify that the close button, title, and menu remain below the status bar and that the bottom finish actions remain above the navigation bar.
