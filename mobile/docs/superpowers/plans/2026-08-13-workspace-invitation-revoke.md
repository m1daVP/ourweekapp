# Workspace Invitation Revoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an owner revoke a participant’s pending workspace invitation from the participant editor with a safe confirmation step.

**Architecture:** Add an authenticated DELETE wrapper and a workspace-store action that resolves the participant’s pending backend invitation, handles local cleanup, and reconciles `404` responses through `/workspace`. Extend the existing participant bottom sheet with a revoke confirmation mode so no modals are stacked, and centralize visibility in the participant invitation eligibility helper.

**Tech Stack:** Vue 3.5, TypeScript 6, Pinia 3, vue-i18n 11, Vitest, Vite 8, npm.

## Global Constraints

- Call `DELETE /workspace/invitations/:invitationId` with `requiresAuth: true` and an encoded path segment.
- Show revocation only for a linked pending adult when the current role has `inviteMembers` permission.
- Require destructive confirmation and prevent duplicate requests while saving.
- On `204`, remove only the matching invitation and participant link, then persist.
- On `404`, reload `/workspace` and use backend reconciliation; retain local state for other errors.
- Use one `BaseBottomSheet`; do not stack a confirmation modal over the participant editor.
- Add calm English, Ukrainian, and Spanish copy.
- Do not create a Git commit unless the user explicitly requests one.

---

### Task 1: Add the invitation revoke API and store behavior

**Files:**

- Modify: `src/shared/api/workspaceApi.ts`
- Modify: `src/shared/api/__tests__/apiWrappers.test.ts`
- Modify: `src/app/stores/workspace.ts`
- Modify: `src/app/stores/__tests__/workspace.test.ts`

**Interfaces:**

- Produces: `revokeWorkspaceInvitation(invitationId: string): Promise<void>`.
- Produces: `getParticipantPendingInvitation(participantId: string): WorkspaceInvitation | null`.
- Produces: `revokeParticipantInvitation(participantId: string): Promise<boolean>`.

- [x] **Step 1: Write the failing API wrapper assertion**

Import `revokeWorkspaceInvitation` in `apiWrappers.test.ts` and add:

```ts
await revokeWorkspaceInvitation('invite /1');
expect(lastApiCall()).toEqual([
  '/workspace/invitations/invite%20%2F1',
  { method: 'DELETE', requiresAuth: true },
]);
```

- [x] **Step 2: Run the API test and verify the missing export failure**

Run `cmd /c npx vitest run src/shared/api/__tests__/apiWrappers.test.ts`.

Expected: FAIL because `revokeWorkspaceInvitation` is not exported.

- [x] **Step 3: Implement the DELETE wrapper**

Add to `workspaceApi.ts`:

```ts
export async function revokeWorkspaceInvitation(
  invitationId: string
): Promise<void> {
  await apiRequest<void>(
    `/workspace/invitations/${encodeURIComponent(invitationId)}`,
    { method: 'DELETE', requiresAuth: true }
  );
}
```

- [x] **Step 4: Add failing store tests**

Mock `revokeWorkspaceInvitation`, import `ApiClientError`, and add this successful cleanup assertion:

```ts
expect(store.getParticipantPendingInvitation('participant-1')).toEqual(
  pendingInvitation('invite-1', 'alex@example.com')
);
expect(await store.revokeParticipantInvitation('participant-1')).toBe(true);
expect(revokeInvitationMock).toHaveBeenCalledWith('invite-1');
expect(store.workspace.invitations).toEqual([]);
expect(store.participantInvitationLinks['participant-1']).toBeUndefined();
expect(mocks.writeSettingsStorage).toHaveBeenCalled();
```

Add these explicit cases:

```ts
// Email fallback when a legacy link has no invitationId.
delete store.participantInvitationLinks['participant-1'].invitationId;
expect(
  store.getParticipantPendingInvitation('participant-1')?.invitationId
).toBe('invite-1');

// No local pending invitation: no request.
store.workspace.invitations = [];
expect(await store.revokeParticipantInvitation('participant-1')).toBe(false);
expect(revokeInvitationMock).not.toHaveBeenCalled();

// 404: authoritative reload and reconciliation.
revokeInvitationMock.mockRejectedValue(
  new ApiClientError('Missing', { status: 404 })
);
getWorkspaceMock.mockResolvedValue({
  ...store.workspace,
  invitations: [],
});
expect(await store.revokeParticipantInvitation('participant-1')).toBe(false);
expect(getWorkspaceMock).toHaveBeenCalled();
expect(store.participantInvitationLinks['participant-1']).toBeUndefined();
expect(store.errorMessage).toBe('workspace.invitationNoLongerPending');

// Non-404: retain state and show calm error.
revokeInvitationMock.mockRejectedValue(new Error('raw backend detail'));
expect(await store.revokeParticipantInvitation('participant-1')).toBe(false);
expect(store.workspace.invitations).toHaveLength(1);
expect(store.participantInvitationLinks['participant-1']).toBeDefined();
expect(store.errorMessage).toBe('workspace.revokeInvitationFailed');
```

Include a second pending invitation and participant link in the success test and assert both remain after revoking `participant-1`.

- [x] **Step 5: Run store tests and verify the missing actions**

Run `cmd /c npx vitest run src/app/stores/__tests__/workspace.test.ts`.

Expected: FAIL because the pending lookup and revoke action do not exist.

- [x] **Step 6: Implement lookup and revoke actions**

Import `ApiClientError` and `revokeWorkspaceInvitation`. Resolve a pending invitation by linked invitation ID first, then linked normalized email. On success, filter that invitation, delete only the participant link, update timestamps, persist, and return `true`.

For `ApiClientError` status `404`, call `loadWorkspace()`, then set `workspace.invitationNoLongerPending` when refresh succeeds and return `false`. For other errors, set `workspace.revokeInvitationFailed`, retain state, and return `false`. Always clear `isSaving` in `finally`.

- [x] **Step 7: Run the API and store tests**

Run:

```bash
cmd /c npx vitest run src/shared/api/__tests__/apiWrappers.test.ts src/app/stores/__tests__/workspace.test.ts
```

Expected: PASS.

### Task 2: Add revoke eligibility and the same-sheet confirmation flow

**Files:**

- Modify: `src/features/participants/participantInvitationEligibility.ts`
- Modify: `src/features/participants/__tests__/participantInvitationEligibility.test.ts`
- Modify: `src/features/participants/components/HouseholdMembersSettings.vue`
- Modify: `src/features/localization/messages.ts`

**Interfaces:**

- Produces: `canRevokeParticipantInvitation(input & { hasPendingInvitation: boolean }): boolean`.
- Consumes: store pending-invitation lookup and revoke action from Task 1.
- Adds sheet mode `'revoke'` within the existing `BaseBottomSheet`.

- [x] **Step 1: Write failing revoke eligibility tests**

Test that revocation is true only for an adult who is not the current participant, has invite permission, has `pending` access, and has a resolved pending invitation. Test each false condition independently.

- [x] **Step 2: Implement the pure eligibility helper**

Add:

```ts
export function canRevokeParticipantInvitation({
  participant,
  isCurrentParticipant,
  canInviteMembers,
  accessStatus,
  hasPendingInvitation,
}: ParticipantInvitationEligibilityInput & {
  hasPendingInvitation: boolean;
}) {
  return Boolean(
    participant &&
    participant.type === 'adult' &&
    !isCurrentParticipant &&
    canInviteMembers &&
    accessStatus === 'pending' &&
    hasPendingInvitation
  );
}
```

- [x] **Step 3: Add translation keys in all three locales**

Under `settings`, add `revokeInvitation`, `revokeInvitationTitle`, `revokeInvitationMessage`, `keepInvitation`, `revokingInvitation`, and `invitationRevoked`. Under `workspace`, add `invitationNoLongerPending` and `revokeInvitationFailed`.

- [x] **Step 4: Implement the bottom-sheet revoke mode**

Add `'revoke'` to `SheetMode`, a `revokeError` ref, and a computed selected pending invitation. Use these function boundaries:

```ts
function openRevokeStep() {
  if (!selectedPendingInvitation.value) return;
  revokeError.value = '';
  sheetMode.value = 'revoke';
}

function cancelRevoke() {
  if (workspaceStore.isSaving) return;
  revokeError.value = '';
  sheetMode.value = 'edit';
}

async function confirmRevoke() {
  const participant = selectedParticipant.value;
  if (!participant) return cancelRevoke();

  revokeError.value = '';
  const revoked = await workspaceStore.revokeParticipantInvitation(
    participant.id
  );

  if (revoked) {
    setParticipantMessage(t('settings.invitationRevoked'));
    sheetMode.value = 'edit';
    return;
  }

  if (!workspaceStore.getParticipantPendingInvitation(participant.id)) {
    setParticipantMessage(t('workspace.invitationNoLongerPending'));
    sheetMode.value = 'edit';
    return;
  }

  revokeError.value =
    workspaceStore.errorMessage || t('workspace.revokeInvitationFailed');
}
```

When `sheetMode === 'revoke'`, render the confirmation title/message/email, inline `role="alert"` error, destructive confirm button, and **Keep invitation** action. Disable both while `workspaceStore.isSaving`. Make `closeSheet()` return from revoke to edit unless saving.

In the pending access block, add **Revoke invitation** only when the pure eligibility helper passes. After success return to edit and show `settings.invitationRevoked`. After a reconciled `404`, return to edit when no pending invitation remains; otherwise keep the confirmation view open with the store error.

- [x] **Step 5: Run focused participant and workspace tests plus lint**

Run:

```bash
cmd /c npx vitest run src/features/participants/__tests__/participantInvitationEligibility.test.ts src/app/stores/__tests__/workspace.test.ts
cmd /c npx eslint src/shared/api/workspaceApi.ts src/app/stores/workspace.ts src/app/stores/__tests__/workspace.test.ts src/features/participants/participantInvitationEligibility.ts src/features/participants/__tests__/participantInvitationEligibility.test.ts src/features/participants/components/HouseholdMembersSettings.vue src/features/localization/messages.ts
```

Expected: PASS.

### Task 3: Complete regression verification

**Files:**

- Verify all files changed by Tasks 1 and 2 plus the design and plan documents.

- [x] **Step 1: Format changed files**

Run:

```bash
cmd /c npx prettier --write src/shared/api/workspaceApi.ts src/shared/api/__tests__/apiWrappers.test.ts src/app/stores/workspace.ts src/app/stores/__tests__/workspace.test.ts src/features/participants/participantInvitationEligibility.ts src/features/participants/__tests__/participantInvitationEligibility.test.ts src/features/participants/components/HouseholdMembersSettings.vue src/features/localization/messages.ts docs/superpowers/specs/2026-08-13-workspace-invitation-revoke-design.md docs/superpowers/plans/2026-08-13-workspace-invitation-revoke.md
```

- [x] **Step 2: Run the full suite and production build**

Run:

```bash
cmd /c npm test
cmd /c npm run build
```

Expected: all tests PASS and the production build succeeds. Existing Vite chunk and native-config warnings are acceptable.

- [x] **Step 3: Run final formatting and whitespace checks**

Run:

```bash
cmd /c npx prettier --check src/shared/api/workspaceApi.ts src/shared/api/__tests__/apiWrappers.test.ts src/app/stores/workspace.ts src/app/stores/__tests__/workspace.test.ts src/features/participants/participantInvitationEligibility.ts src/features/participants/__tests__/participantInvitationEligibility.test.ts src/features/participants/components/HouseholdMembersSettings.vue src/features/localization/messages.ts docs/superpowers/specs/2026-08-13-workspace-invitation-revoke-design.md docs/superpowers/plans/2026-08-13-workspace-invitation-revoke.md
git diff --check
```

Expected: formatting passes and Git reports no whitespace errors. Line-ending warnings are acceptable when Git exits successfully.
