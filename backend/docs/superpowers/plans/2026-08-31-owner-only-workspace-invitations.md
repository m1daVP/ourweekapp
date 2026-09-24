# Owner-only Workspace Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure only workspace owners can create or resend invitations and link existing members to participants, with matching backend and frontend enforcement.

**Architecture:** Keep the backend as the authority by tightening the existing shared invitation authorization helper used by all three workspace service methods. Keep the existing owner-only UI permission, and add the same permission check inside the frontend workspace store before it can invoke its create, resend, or link API wrappers.

**Tech Stack:** Node.js, Fastify, TypeScript, Vitest; Vue 3, Pinia, TypeScript, Vitest.

## Global Constraints

- Preserve the public API contract and use the existing `403 forbidden` response for backend authorization failures.
- Do not alter database migrations, invitation data, delivery behavior, or invitation acceptance flows.
- Treat backend authorization as authoritative; frontend guards only prevent unauthorized client actions before a request is sent.
- Reuse the existing owner-only `inviteMembers` permission; do not add a new permission or dependency.
- Do not stage or commit changes without explicit user approval.

---

## File structure

- `src/modules/workspace/workspace.service.ts`: central backend authorization helper for invitation creation, resend, and existing-member linking.
- `tests/workspace.service.test.ts`: backend permission and service regression tests.
- `D:/Projects/myself/weekly-us/src/app/stores/workspace.ts`: client-side authorization gate before invitation API wrappers are called.
- `D:/Projects/myself/weekly-us/src/app/stores/__tests__/workspace.test.ts`: client-store tests for owner and adult-member behavior.

### Task 1: Enforce owner-only invitation actions in the backend

**Files:**
- Modify: `src/modules/workspace/workspace.service.ts:109-121`
- Modify: `tests/workspace.service.test.ts:137-147,267-372`

**Interfaces:**
- Consumes: `AuthContext.role`, whose values include `owner`, `adult_member`, and `viewer`.
- Produces: `requireInviteMembers(auth: AuthContext | undefined): AuthContext`, which returns only an owner context or throws `ApiError(403, 'forbidden', 'You are not allowed to invite workspace members.')`.
- Uses: `WorkspaceService.createInvitation`, `WorkspaceService.resendInvitation`, and `WorkspaceService.linkParticipantToExistingMember`, each of which already calls `requireInviteMembers` before any repository method.

- [ ] **Step 1: Change the failing shared-permission expectation**

Replace the test that currently accepts `adultAuth` with an owner-only test:

```ts
it('allows only owners to invite or link workspace members', () => {
  expect(requireInviteMembers(ownerAuth)).toEqual(ownerAuth);
  expect(() => requireInviteMembers(adultAuth)).toThrow(ApiError);
  expect(() => requireInviteMembers(viewerAuth)).toThrow(ApiError);
});
```

- [ ] **Step 2: Add service-level adult-member regression cases**

Add a parameterized case that verifies all three paths reject before a repository operation:

```ts
it.each([
  ['create', (service: WorkspaceService) =>
    service.createInvitation(adultAuth, {
      participantId: 'participant-1',
      email: 'alex@example.com',
    }), 'createInvitation'],
  ['resend', (service: WorkspaceService) =>
    service.resendInvitation(adultAuth, 'invitation-1'), 'findPendingInvitation'],
  ['link', (service: WorkspaceService) =>
    service.linkParticipantToExistingMember(adultAuth, 'participant-1', {
      email: 'alex@example.com',
    }), 'linkExistingMemberToParticipant'],
] as const)('rejects adult members before %s invitation repository work', async (_action, invoke, repositoryMethod) => {
  const { repository, service } = createRepository();

  await expect(invoke(service)).rejects.toMatchObject({
    statusCode: 403,
    code: 'forbidden',
  });
  expect(repository[repositoryMethod]).not.toHaveBeenCalled();
});
```

Also change the existing successful `createInvitation(adultAuth, ...)` DTO test to use `ownerAuth` so it continues to validate the owner flow.

- [ ] **Step 3: Run the focused test before implementation**

Run: `npm test -- workspace.service.test.ts`

Expected: the new permission expectations and unauthorized service cases fail because `requireInviteMembers` currently permits `adult_member`.

- [ ] **Step 4: Tighten the shared helper**

In `requireInviteMembers`, replace the viewer-only condition with an owner-only condition while preserving the existing safe error response:

```ts
export function requireInviteMembers(auth: AuthContext | undefined) {
  const context = requireAuthenticatedContext(auth);

  if (context.role !== 'owner') {
    throw new ApiError(
      403,
      'forbidden',
      'You are not allowed to invite workspace members.',
    );
  }

  return context;
}
```

- [ ] **Step 5: Verify the backend regression suite**

Run: `npm test -- workspace.service.test.ts`

Expected: PASS. Owner invitation, resend, and link tests still succeed; adult-member attempts return `403` without calling their repository methods.

- [ ] **Step 6: Review the backend change**

Run: `git -c safe.directory='D:/Projects/myself/weekly-us-api' diff -- src/modules/workspace/workspace.service.ts tests/workspace.service.test.ts`

Expected: the diff only changes the invitation permission condition and its focused tests. Do not stage or commit without explicit user approval.

### Task 2: Add matching client-store authorization gates

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/workspace.ts:1-31,491-614`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/__tests__/workspace.test.ts:1-185`

**Interfaces:**
- Consumes: `roleCan(role: UserRole, permission: WorkspacePermission): boolean` from `@/features/workspace/permissions` and the store getter `currentUserRole`.
- Produces: owner-only behavior from `inviteParticipant(participantId, email)`, which returns `null` for a non-owner, and `resendParticipantInvitation(participantId)`, which returns `false` for a non-owner.
- Uses: `createWorkspaceInvitation`, `linkWorkspaceParticipantToMember`, and `resendWorkspaceInvitation` only after `roleCan(this.currentUserRole, 'inviteMembers')` returns true.

- [ ] **Step 1: Add failing adult-member store tests**

Add a helper that makes the current user an adult member in the stored workspace and marks the workspace as server-synced before testing permissions:

```ts
function useAdultMember(store: ReturnType<typeof useWorkspaceStore>) {
  store.currentUserId = 'adult-1';
  store.applyWorkspace({
    ...store.workspace,
    members: [
      ...store.workspace.members,
      {
        userId: 'adult-1',
        displayName: 'Alex',
        email: 'alex@example.com',
        role: 'adult_member',
        status: 'active',
      },
    ],
    invitations: [invitation()],
  });
}
```

Then assert that a non-owner cannot invoke each API path:

```ts
it('does not let an adult member create, link, or resend invitations', async () => {
  const store = useWorkspaceStore();
  useAdultMember(store);

  await expect(
    store.inviteParticipant('participant-1', 'new@example.com')
  ).resolves.toBeNull();
  await expect(
    store.inviteParticipant('participant-1', 'rita@example.com')
  ).resolves.toBeNull();
  await expect(store.resendParticipantInvitation('participant-1')).resolves.toBe(false);

  expect(createInvitationMock).not.toHaveBeenCalled();
  expect(linkParticipantMock).not.toHaveBeenCalled();
  expect(resendInvitationMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused client-store test before implementation**

Run: `npm test -- src/app/stores/__tests__/workspace.test.ts`

Expected: FAIL because the store currently invokes API wrappers for an adult member when called directly.

- [ ] **Step 3: Gate the store actions before branching or API calls**

Import `roleCan`:

```ts
import { roleCan } from '@/features/workspace/permissions';
```

At the top of `inviteParticipant`, before checking the participant ID, email, or existing members, return `null` when the current user does not have `inviteMembers`:

```ts
if (!roleCan(this.currentUserRole, 'inviteMembers')) {
  return null;
}
```

At the top of `resendParticipantInvitation`, before looking up a pending invitation, return `false` when the current user lacks the permission:

```ts
if (!roleCan(this.currentUserRole, 'inviteMembers')) {
  return false;
}
```

This one `inviteParticipant` gate covers both new-invitation and existing-member-link flows because they branch later in that same action.

- [ ] **Step 4: Verify focused client behavior**

Run: `npm test -- src/app/stores/__tests__/workspace.test.ts src/features/participants/__tests__/participantInvitationEligibility.test.ts`

Expected: PASS. Owner flows still call the same wrappers; adult members cannot call create, link, or resend wrappers; existing owner-only invitation-control eligibility remains valid.

- [ ] **Step 5: Run client quality checks**

Run: `npm run build`

Run: `npm run check`

Expected: both commands exit successfully with TypeScript, formatting, and lint checks passing.

- [ ] **Step 6: Review the client change**

Run: `git -c safe.directory='D:/Projects/myself/weekly-us' diff -- src/app/stores/workspace.ts src/app/stores/__tests__/workspace.test.ts`

Expected: the diff only adds store authorization gates and their regression test. Do not stage or commit without explicit user approval.

### Task 3: Validate the combined authorization boundary

**Files:**
- Modify: none
- Test: `tests/workspace.service.test.ts`
- Test: `D:/Projects/myself/weekly-us/src/app/stores/__tests__/workspace.test.ts`

**Interfaces:**
- Consumes: the owner-only backend `requireInviteMembers` guard and frontend `roleCan(..., 'inviteMembers')` preflight checks.
- Produces: verified defense in depth: the client suppresses action requests and the API rejects any client bypass.

- [ ] **Step 1: Run the targeted backend and frontend tests**

Run in `D:/Projects/myself/weekly-us-api`: `npm test -- workspace.service.test.ts`

Run in `D:/Projects/myself/weekly-us`: `npm test -- src/app/stores/__tests__/workspace.test.ts src/features/participants/__tests__/participantInvitationEligibility.test.ts`

Expected: all selected tests pass.

- [ ] **Step 2: Run backend type and full test checks**

Run in `D:/Projects/myself/weekly-us-api`: `npm run typecheck`

Run in `D:/Projects/myself/weekly-us-api`: `npm test`

Expected: both commands exit successfully. No database migration command is needed because schema has not changed.

- [ ] **Step 3: Perform manual verification**

Sign in as an adult member and open the household member settings. Confirm invitation, resend, and linking controls are absent. If a previously rendered or direct client call attempts an invitation operation, confirm it sends no API request. Call the corresponding API endpoint with an adult-member access token and confirm it returns the established `403 forbidden` response.

- [ ] **Step 4: Review the complete change set**

Run in each repository: `git -c safe.directory='<repository-path>' diff --check`

Expected: no whitespace errors. Do not stage or commit without explicit user approval.

## Self-review

- Spec coverage: Task 1 implements authoritative backend enforcement for create, resend, and linking; Task 2 implements frontend preflight checks for the same paths while retaining the existing UI permission; Task 3 verifies both layers. No schema, data, delivery, or acceptance behavior is in scope.
- Placeholder scan: no unresolved work markers or unspecified implementation steps remain.
- Type consistency: the plan uses existing `AuthContext`, `WorkspaceService`, `roleCan`, `UserRole`, and `WorkspacePermission` interfaces; the return values match the existing store action signatures.
