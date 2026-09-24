# New Signup Owner Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a newly registered household owner use the meeting flow immediately, before background workspace hydration completes.

**Architecture:** Pass the backend-authenticated role through the existing sync-session boundary when resetting state for a new signed-in user. The placeholder workspace stores that role for the current member, and the workspace getter uses the placeholder member until the server workspace replaces it. The server remains authoritative after hydration and for every remote mutation.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vitest.

## Global Constraints

- A password or Google signup without an invitation must retain the backend-returned `owner` role before hydration.
- An invited `adult_member` or `viewer` must retain the invitation role before hydration.
- Do not change API contracts, migrations, role permissions, or backend authorization.
- Do not add dependencies.
- Do not stage, commit, or otherwise modify unrelated user work.

---

### Task 1: Preserve the authenticated role in the unsynced workspace placeholder

**Files:**

- Modify: `src/app/stores/auth.ts:220-222,692-715,800-811`
- Modify: `src/shared/services/syncSessionService.ts:12-38`
- Modify: `src/app/stores/workspace.ts:180-198,317-323,347-354`
- Test: `src/shared/services/__tests__/syncService.test.ts:680-723`

**Interfaces:**

- Consumes: the trusted `UserRole` returned as `session.user.role` or `/auth/me`'s `currentUser.role`.
- Produces: `prepareSyncForAuthenticatedUser(userId: string, role?: UserRole): { didResetSyncedData: boolean }`, which initializes the placeholder member with the authenticated role and uses the safe `viewer` default only for non-auth callers.

- [ ] **Step 1: Add the failing role-preservation test**

  In `src/shared/services/__tests__/syncService.test.ts`, extend the session-switch setup so it calls the sync-session helper with `'owner'` and asserts the replacement workspace yields the owner role before core hydration:

  ```ts
  prepareSyncForAuthenticatedUser('new-user', 'owner');

  expect(workspaceStore.currentUserId).toBe('new-user');
  expect(workspaceStore.currentUserRole).toBe('owner');
  ```

  Add the complementary viewer case in the same describe block:

  ```ts
  prepareSyncForAuthenticatedUser('viewer-user', 'viewer');

  expect(useWorkspaceStore().currentUserRole).toBe('viewer');
  ```

- [ ] **Step 2: Run the focused test to verify the owner assertion fails**

  Run:

  ```powershell
  npm test -- src/shared/services/__tests__/syncService.test.ts
  ```

  Expected: the new owner assertion fails because the existing unsynced getter always returns `viewer` for authenticated users.

- [ ] **Step 3: Thread `UserRole` through auth session preparation**

  In `src/app/stores/auth.ts`, import `UserRole`, then change the helper and both callers to keep using the role supplied by the backend response:

  ```ts
  async function prepareSyncForSessionUser(userId: string, role: UserRole) {
    prepareSyncForAuthenticatedUser(userId, role);
  }

  const nextUser = mapSessionUser(session);
  await prepareSyncForSessionUser(nextUser.id, session.user.role);

  const nextUser = mapAuthUser(currentUser, this.user?.email);
  await prepareSyncForSessionUser(nextUser.id, currentUser.role);
  ```

  Keep `AuthUser` unchanged: the role is needed only while creating the in-memory placeholder, not as a second persisted authorization source.

- [ ] **Step 4: Initialize the placeholder with the authenticated role**

  In `src/shared/services/syncSessionService.ts`, accept `role: UserRole` and pass it to `resetForAuthenticatedUser` when switching users:

  ```ts
  export function prepareSyncForAuthenticatedUser(
    userId: string,
    role: UserRole = 'viewer'
  ) {
    workspaceStore.resetForAuthenticatedUser(userId, role);
  }
  ```

  In `src/app/stores/workspace.ts`, accept the role in `createAuthenticatedPlaceholderWorkspace` and `resetForAuthenticatedUser`, and use it for the temporary current member:

  ```ts
  function createAuthenticatedPlaceholderWorkspace(
    userId: string,
    role: UserRole
  ): Workspace {
    const createdAt = nowIso();

    return {
      id: createPrefixedId('workspace'),
      name: translate('settings.defaultWorkspace'),
      ownerId: userId,
      members: [{
        userId,
        displayName: translate('common.weeklyUsUser'),
        role,
        status: 'active',
      }],
      invitations: [],
      createdAt,
      updatedAt: createdAt,
    };
  }

  resetForAuthenticatedUser(userId: string, role: UserRole) {
    this.workspace = createAuthenticatedPlaceholderWorkspace(userId, role);
    this.currentUserId = userId;
    this.isLoading = false;
    this.isSaving = false;
    this.errorMessage = '';
    this.lastSyncedAt = null;
    this.persist();
  }
  ```

- [ ] **Step 5: Make the effective role come from the placeholder member**

  Replace the special unsynced `viewer` branch in `currentUserRole` with:

  ```ts
  currentUserRole(): UserRole {
    return this.currentMember?.role ?? 'viewer';
  }
  ```

  Do not change `applyWorkspace`; it continues to overwrite the placeholder with the backend workspace and its authoritative membership data.

- [ ] **Step 6: Run the focused test to verify both roles pass**

  Run:

  ```powershell
  npm test -- src/shared/services/__tests__/syncService.test.ts
  ```

  Expected: PASS, with the owner retained for a new account and the viewer remaining restricted before hydration.

- [ ] **Step 7: Run project verification**

  Run:

  ```powershell
  npm run build
  npm run check
  ```

  Expected: both commands exit successfully.

## Plan Self-Review

- Spec coverage: Task 1 preserves the direct-signup owner role, preserves invitation roles, leaves server authority after `applyWorkspace`, and changes no API/database surface.
- Placeholder scan: no implementation placeholders remain.
- Type consistency: `UserRole` is the same union used by API DTOs, workspace members, and the sync-session helper.
