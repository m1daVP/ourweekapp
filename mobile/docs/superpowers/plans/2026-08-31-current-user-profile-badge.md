# Current User Profile Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each signed-in user the initials and color of their own linked participant profile in the app header.

**Architecture:** `AppShell` will obtain the authenticated email from the existing auth store and select the active participant with the same normalized email. It retains the neutral `WU` badge only while no matching participant is available; API and participant persistence contracts remain unchanged.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, Vue Test Utils.

## Global Constraints

- Do not modify the backend, database schema, API contract, or persistent participant-selection state.
- Normalize both emails before comparison and render only an active matching participant.
- Do not stage or commit changes without explicit user authorization.

---

### Task 1: Select and render the signed-in participant badge

**Files:**
- Modify: `src/shared/components/AppShell.vue:1-40,133-147`
- Test: `src/shared/components/__tests__/AppShell.test.ts`

**Interfaces:**
- Consumes: `useAuthStore().user?.email` and `useParticipantsStore().activeParticipants`, whose entries contain `email`, `initials`, and `avatarColor`.
- Produces: the `.app-top-bar__avatar` content using the current signed-in participant’s presentation data.

- [ ] **Step 1: Write the failing component test**

Extend the mock state so it includes two active participants and an authenticated user with the second participant’s email. Assert that the rendered nested `span` has the second participant’s initials and `background-color` style:

```ts
expect(mountAppShell().find('.app-top-bar__avatar > span').text()).toBe('AL');
expect(mountAppShell().find('.app-top-bar__avatar > span').attributes('style'))
  .toContain('background-color: #6b8f71');
```

- [ ] **Step 2: Run the focused test to verify the current failure**

Run: `npx vitest run src/shared/components/__tests__/AppShell.test.ts`

Expected: FAIL because `AppShell` renders the first participant rather than the email-matched participant.

- [ ] **Step 3: Implement the minimal component change**

Import `useAuthStore` in `AppShell.vue`. Replace the first-active-participant computed value with one that reads `authStore.user?.email`, normalizes it with `trim().toLocaleLowerCase()`, and finds the active participant whose optional `email` normalizes to the same value. Bind the existing avatar style and initials to that computed participant. Leave the fallback `WU` span unchanged.

- [ ] **Step 4: Run the focused test to verify the fix**

Run: `npx vitest run src/shared/components/__tests__/AppShell.test.ts`

Expected: PASS, including the existing Premium-ring assertions.

- [ ] **Step 5: Run static verification**

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Leave the change unstaged**

Do not run `git add` or `git commit`; commits require separate explicit authorization.

## Self-Review

- Spec coverage: Task 1 matches the authenticated email to the active participant, preserves the `WU` loading state, and adds the requested regression test.
- Placeholder scan: no implementation details or verification steps are unspecified.
- Type consistency: `AuthUser.email` is a string and `Participant.email` is optional, so the computed selection guards the missing participant-email case before normalizing it.
