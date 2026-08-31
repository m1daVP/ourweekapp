# Participant Email Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retain server-owned participant email after frontend hydration and sync so profile badges identify the signed-in owner or member.

**Architecture:** Add a narrow participant-specific merge helper in `syncService.ts`. It will use the existing timestamp merge for editable participant fields, then overlay only the backend response’s optional email by participant ID before mapping to the local participant model. Outbound sync DTO construction remains unchanged.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest.

## Global Constraints

- Do not include `email` in participant sync request DTOs.
- Do not modify the backend, database, or public API contract.
- Preserve the generic `mergeSyncItems` timestamp semantics for editable fields.
- Do not stage or commit changes without explicit user authorization.

---

### Task 1: Preserve backend participant email through merges

**Files:**
- Modify: `src/shared/services/syncService.ts:255-264,495-499`
- Test: `src/shared/services/__tests__/syncService.test.ts`

**Interfaces:**
- Consumes: local `Participant[]` and backend `ParticipantDto[]`, where email is optional and server-owned.
- Produces: stored `Participant[]` retaining a backend email even if equal timestamps make the generic merge select the local representation.

- [ ] **Step 1: Write the failing hydration regression test**

In `syncService.test.ts`, seed `useParticipantsStore().participants` with `participant('participant-1', 'Rita', 3)` and make `listParticipants` return the same participant plus `email: 'rita@example.com'` with the same timestamps. Call `syncCoreData()` and assert:

```ts
expect(useParticipantsStore().participants).toEqual([
  expect.objectContaining({
    id: 'participant-1',
    email: 'rita@example.com',
  }),
]);
```

- [ ] **Step 2: Run the focused test to verify the current failure**

Run: `npx vitest run src/shared/services/__tests__/syncService.test.ts`

Expected: FAIL because `toParticipantDto` removes the local email and equal timestamps retain that email-less representation.

- [ ] **Step 3: Implement a participant-specific merge helper**

Add a helper near `applyParticipantsFromBackend` with this behavior:

```ts
function mergeParticipants(
  localParticipants: Participant[],
  remoteParticipants: ParticipantDto[]
) {
  const remoteEmailsById = new Map(
    remoteParticipants.map((participant) => [participant.id, participant.email])
  );

  return mergeSyncItems<ParticipantDto>(
    localParticipants.map(toParticipantDto),
    remoteParticipants
  ).map((participant) =>
    fromParticipantDto({
      ...participant,
      email: remoteEmailsById.get(participant.id),
    })
  );
}
```

Use this helper in both initial backend hydration and `syncParticipants`. Keep `toParticipantDto` unchanged so email remains excluded from POST bodies.

- [ ] **Step 4: Run the focused test to verify the fix**

Run: `npx vitest run src/shared/services/__tests__/syncService.test.ts src/shared/components/__tests__/AppShell.test.ts`

Expected: PASS; the sync test preserves email and the header test renders the matching participant avatar.

- [ ] **Step 5: Run static and build verification**

Run: `npm run build`

Expected: PASS with Vue type-checking and Vite bundle generation.

- [ ] **Step 6: Leave the change unstaged**

Do not run `git add` or `git commit`; commits require separate explicit authorization.

## Self-Review

- Spec coverage: Task 1 retains server email after both read paths while leaving writes unchanged.
- Placeholder scan: all merge behavior, test setup, and commands are explicit.
- Type consistency: `Participant.email` and `ParticipantDto.email` are optional strings, and the helper maps the merged DTO back through the existing `fromParticipantDto` converter.
