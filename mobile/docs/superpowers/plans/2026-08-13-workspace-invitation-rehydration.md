# Workspace Invitation Rehydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve participant invitation emails and pending access status after app restart and workspace refresh by consuming the authoritative `invitations` returned from `/workspace`.

**Architecture:** Extend the workspace domain and API contract with real invitation records, normalize them into version-three workspace storage, and reconcile local participant-to-email links against both active members and pending invitations. Invitation creation stores the returned invitation instead of fabricating an invited workspace member; the existing participant settings UI continues to consume `getParticipantAccessState` unchanged.

**Tech Stack:** Vue 3.5, TypeScript 6, Pinia 3, Vitest, Vite 8, npm.

## Global Constraints

- `GET /workspace` is authoritative for workspace members and invitation lifecycle status.
- The participant-to-email link remains local because backend invitations do not contain participant IDs.
- Compare invitation and member emails after trimming and case folding.
- Only `pending` invitations independently retain a participant link and produce pending access.
- Increment workspace settings storage from version 2 to version 3; older data migrates without deletion.
- Do not add dependencies or change the settings UI structure.
- Do not create a Git commit unless the user explicitly requests one.

---

### Task 1: Model and normalize workspace invitations

**Files:**

- Modify: `src/features/workspace/types.ts:21-47`
- Modify: `src/shared/api/workspaceApi.ts:1-26`
- Modify: `src/app/stores/workspace.ts:25-240`
- Test: `src/app/stores/__tests__/workspace.test.ts:31-66`
- Test fixture: `src/shared/services/__tests__/syncService.test.ts:139-152`

**Interfaces:**

- Consumes: backend invitation fields `invitationId`, `email`, optional `displayName`, non-owner `role`, lifecycle `status`, `createdAt`, and `expiresAt`.
- Produces: `WorkspaceInvitation`, required `Workspace.invitations: WorkspaceInvitation[]`, `WorkspaceInvitationDto = WorkspaceInvitation`, and version-three normalized workspace state.

- [x] **Step 1: Add failing migration and normalization tests**

Extend `src/app/stores/__tests__/workspace.test.ts` with these tests:

```ts
it('migrates workspace storage without invitations to version three', () => {
  const store = useWorkspaceStore();

  expect(store.version).toBe(3);
  expect(store.workspace.invitations).toEqual([]);
});

it('normalizes valid stored invitations and discards malformed records', () => {
  mocks.storedWorkspace = {
    ...storedState(),
    version: 3,
    workspace: {
      ...storedState().workspace,
      invitations: [
        {
          invitationId: ' invite-1 ',
          email: ' Alex@Example.com ',
          displayName: ' Alex ',
          role: 'adult_member',
          status: 'pending',
          createdAt: '2026-08-12T09:00:00.000Z',
          expiresAt: '2026-08-19T09:00:00.000Z',
        },
        { invitationId: '', email: 'broken@example.com' },
      ],
    },
  };

  expect(useWorkspaceStore().workspace.invitations).toEqual([
    {
      invitationId: 'invite-1',
      email: 'alex@example.com',
      displayName: 'Alex',
      role: 'adult_member',
      status: 'pending',
      createdAt: '2026-08-12T09:00:00.000Z',
      expiresAt: '2026-08-19T09:00:00.000Z',
    },
  ]);
});
```

- [x] **Step 2: Run the focused test and confirm the missing-contract failure**

Run:

```bash
cmd /c npx vitest run src/app/stores/__tests__/workspace.test.ts
```

Expected: FAIL because storage is version two and `workspace.invitations` is missing.

- [x] **Step 3: Add the invitation domain/API type**

In `src/features/workspace/types.ts`, define:

```ts
export type WorkspaceInvitationStatus =
  'pending' | 'accepted' | 'revoked' | 'expired';

export interface WorkspaceInvitation {
  invitationId: string;
  email: string;
  displayName?: string;
  role: Exclude<UserRole, 'owner'>;
  status: WorkspaceInvitationStatus;
  createdAt: string;
  expiresAt: string;
}
```

Add `invitations: WorkspaceInvitation[]` to `Workspace`. In `src/shared/api/workspaceApi.ts`, import `WorkspaceInvitation` and replace the duplicate DTO interface with:

```ts
export type WorkspaceInvitationDto = WorkspaceInvitation;
```

- [x] **Step 4: Normalize version-three invitation storage**

In `src/app/stores/workspace.ts`:

- change `STORAGE_VERSION` to `3`;
- allow partial stored invitation records in `StoredWorkspaceState.workspace`;
- initialize default and authenticated workspaces with `invitations: []`;
- add strict invitation role/status guards and `normalizeInvitation`;
- normalize `workspace.invitations`, defaulting a missing field to `[]`; and
- return invitations on the normalized `Workspace` object.

Use this validation shape:

```ts
function normalizeInvitation(
  invitation: Partial<WorkspaceInvitation>
): WorkspaceInvitation | null {
  const invitationId = invitation.invitationId?.trim();
  const email = invitation.email ? normalizeEmail(invitation.email) : '';
  const createdAt = invitation.createdAt?.trim();
  const expiresAt = invitation.expiresAt?.trim();
  const role = normalizeInvitationRole(invitation.role);
  const status = normalizeInvitationStatus(invitation.status);

  if (!invitationId || !email || !createdAt || !expiresAt || !role || !status) {
    return null;
  }

  return {
    invitationId,
    email,
    displayName: invitation.displayName?.trim() || undefined,
    role,
    status,
    createdAt,
    expiresAt,
  };
}
```

- [x] **Step 5: Update typed workspace fixtures**

Add `invitations: []` to the `getWorkspace` fixture in `src/shared/services/__tests__/syncService.test.ts` and any other build-reported `Workspace` literals. Do not add invitations to untyped unrelated objects.

- [x] **Step 6: Run the focused test and type build**

Run:

```bash
cmd /c npx vitest run src/app/stores/__tests__/workspace.test.ts
cmd /c npm run build
```

Expected: workspace tests PASS and TypeScript accepts every required workspace fixture.

### Task 2: Reconcile participant links against backend invitations

**Files:**

- Modify: `src/app/stores/workspace.ts:274-476`
- Test: `src/app/stores/__tests__/workspace.test.ts:68-152`

**Interfaces:**

- Consumes: `Workspace.invitations`, `participantInvitationLinks`, and normalized member/invitation emails.
- Produces: refresh-safe `applyWorkspace`, `getParticipantAccessState`, and `inviteParticipant(participantId, displayName, email): Promise<WorkspaceMember | WorkspaceInvitation | null>` behavior.

- [x] **Step 1: Add failing refresh and rehydration tests**

Add focused cases that prove:

```ts
it('keeps a participant link matched by a pending backend invitation', () => {
  const store = useWorkspaceStore();
  store.participantInvitationLinks = {
    'participant-1': {
      participantId: 'participant-1',
      email: 'alex@example.com',
      invitationId: 'invite-1',
    },
  };

  store.applyWorkspace({
    ...store.workspace,
    invitations: [pendingInvitation('invite-1', ' Alex@Example.com ')],
  });

  expect(store.getParticipantAccessState('participant-1')).toEqual({
    status: 'pending',
    email: 'alex@example.com',
  });
});

it('rehydrates the persisted pending invitation in a fresh store', () => {
  const firstStore = useWorkspaceStore();
  firstStore.participantInvitationLinks = {
    'participant-1': {
      participantId: 'participant-1',
      email: 'alex@example.com',
      invitationId: 'invite-1',
    },
  };
  firstStore.applyWorkspace({
    ...firstStore.workspace,
    invitations: [pendingInvitation('invite-1', 'alex@example.com')],
  });
  mocks.storedWorkspace = mocks.writeSettingsStorage.mock.lastCall?.[1];
  setActivePinia(createPinia());

  expect(
    useWorkspaceStore().getParticipantAccessState('participant-1')
  ).toEqual({ status: 'pending', email: 'alex@example.com' });
});
```

Also add cases for a matching active member returning `active`, and `expired`, `revoked`, or missing emails removing stale links. Define a test helper returning a complete invitation:

```ts
function pendingInvitation(invitationId: string, email: string) {
  return {
    invitationId,
    email,
    displayName: 'Alex',
    role: 'adult_member' as const,
    status: 'pending' as const,
    createdAt: '2026-08-12T09:00:00.000Z',
    expiresAt: '2026-08-19T09:00:00.000Z',
  };
}
```

- [x] **Step 2: Run the focused test and verify links are still removed**

Run:

```bash
cmd /c npx vitest run src/app/stores/__tests__/workspace.test.ts
```

Expected: FAIL because `applyWorkspace` only recognizes member emails and access state only searches members.

- [x] **Step 3: Reconcile links against members and pending invitations**

In `applyWorkspace`, replace the member-only email set with:

```ts
const accessibleEmails = new Set([
  ...this.workspace.members
    .filter((member) => member.status !== 'removed' && Boolean(member.email))
    .map((member) => normalizeEmail(member.email ?? '')),
  ...this.workspace.invitations
    .filter((invitation) => invitation.status === 'pending')
    .map((invitation) => invitation.email),
]);
```

Filter participant links against `accessibleEmails` and keep the existing current-user and persistence logic.

- [x] **Step 4: Derive pending access from invitations**

After the existing member lookup in `getParticipantAccessState`, search for a pending invitation by normalized email. Return `{ status: 'pending', email: link.email }` when found; otherwise return `{ status: 'none' }`.

- [x] **Step 5: Store POST results as invitations, not members**

In `inviteParticipant`, normalize the returned `WorkspaceInvitationDto`, upsert it into `workspace.invitations` by `invitationId`, update workspace timestamps/sync state, then store the participant link and persist. Remove creation of the synthetic `WorkspaceMember` with `status: 'invited'`.

Give the action an explicit `Promise<WorkspaceMember | WorkspaceInvitation | null>` return type. The existing-member branch returns its `WorkspaceMember`; the POST branch returns the normalized `WorkspaceInvitation`. In `HouseholdMembersSettings.vue`, rename the local `member` result to `accessRecord` and retain the exact message rule `accessRecord.status === 'active' ? appAccessLinked : invitationSent`.

- [x] **Step 6: Update the invitation success test**

Assert that successful POST behavior now produces:

```ts
expect(store.workspace.invitations).toContainEqual({
  invitationId: 'invite-1',
  email: 'alex@example.com',
  displayName: 'Alex',
  role: 'adult_member',
  status: 'pending',
  createdAt: '2026-08-12T09:00:00.000Z',
  expiresAt: '2026-08-19T09:00:00.000Z',
});
expect(
  store.workspace.members.some((member) => member.userId === 'invite-1')
).toBe(false);
```

- [x] **Step 7: Run focused tests and implementation checks**

Run:

```bash
cmd /c npx vitest run src/app/stores/__tests__/workspace.test.ts src/features/participants/__tests__/participantInvitationEligibility.test.ts
cmd /c npx eslint src/features/workspace/types.ts src/shared/api/workspaceApi.ts src/app/stores/workspace.ts src/app/stores/__tests__/workspace.test.ts src/features/participants/components/HouseholdMembersSettings.vue src/shared/services/__tests__/syncService.test.ts
```

Expected: tests and ESLint PASS.

### Task 3: Complete regression verification

**Files:**

- Verify only; modify a file only if a failing check exposes a defect caused by Tasks 1 or 2.

**Interfaces:**

- Consumes: the completed workspace invitation contract and reconciliation behavior.
- Produces: evidence that app restart, refresh, participant UI, and unrelated app flows still compile and pass.

- [x] **Step 1: Format changed files**

Run:

```bash
cmd /c npx prettier --write src/features/workspace/types.ts src/shared/api/workspaceApi.ts src/app/stores/workspace.ts src/app/stores/__tests__/workspace.test.ts src/features/participants/components/HouseholdMembersSettings.vue src/shared/services/__tests__/syncService.test.ts docs/superpowers/specs/2026-08-13-workspace-invitation-rehydration-design.md docs/superpowers/plans/2026-08-13-workspace-invitation-rehydration.md
```

- [x] **Step 2: Run the full automated suite and production build**

Run:

```bash
cmd /c npm test
cmd /c npm run build
```

Expected: all tests PASS and the production build succeeds. Existing Vite chunk-size and native-config warnings are acceptable.

- [x] **Step 3: Run final focused style and whitespace checks**

Run:

```bash
cmd /c npx prettier --check src/features/workspace/types.ts src/shared/api/workspaceApi.ts src/app/stores/workspace.ts src/app/stores/__tests__/workspace.test.ts src/features/participants/components/HouseholdMembersSettings.vue src/shared/services/__tests__/syncService.test.ts docs/superpowers/specs/2026-08-13-workspace-invitation-rehydration-design.md docs/superpowers/plans/2026-08-13-workspace-invitation-rehydration.md
git diff --check
```

Expected: formatting passes and Git reports no whitespace errors. Line-ending warnings are acceptable when the command exits successfully.
