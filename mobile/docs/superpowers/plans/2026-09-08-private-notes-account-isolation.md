# Private Notes Account Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate device-local private notes by authenticated user ID while preserving each user's notes across logout, account switching, restart, offline use, and Premium entitlement changes.

**Architecture:** Version the existing app-data envelope from 5 to 6 and replace the unowned private-notes state with a `notesByUserId` collection plus an inaccessible legacy quarantine. A focused storage adapter will preserve other users' namespaces, while the Pinia store binds one authenticated owner at a time and session lifecycle code clears the active view on logout.

**Tech Stack:** Vue 3, Pinia 4, TypeScript 6, Capacitor Preferences-backed app storage, Vitest 4.

## Global Constraints

- Use the immutable backend-issued user ID as the private-note ownership key; do not use email.
- Private notes remain local and are not synchronized to the backend.
- Import and export are outside this change.
- Store initialization must not display private notes before authentication binds an owner.
- Unbound mutations must fail closed without modifying persistent storage.
- Preserve every other user's namespace during a write.
- Assign legacy notes only to `syncMetadata.ownerUserId`; quarantine them when that owner is absent.
- Losing Premium access must not delete or reassign notes.
- Account deletion must continue to remove all local private-note namespaces.
- Do not add dependencies.
- Do not stage or commit files without an explicit user request, per `AGENTS.md`.

---

## File Structure

- Create `src/features/private-notes/services/privateNotesStorageService.ts`: validate the version-6 private-note storage shape and provide owner-scoped reads and writes.
- Create `src/features/private-notes/services/__tests__/privateNotesStorageService.test.ts`: prove owner filtering, namespace preservation, malformed-data handling, and unbound safety at the adapter boundary.
- Modify `src/shared/services/storageService.ts`: increment the app-data version, register the version-5-to-6 migration, migrate or quarantine legacy notes, and keep envelope validation compatible with the new storage value.
- Modify `src/shared/services/__tests__/storageService.test.ts`: verify version-6 migration, quarantine, backup compatibility, and full local cleanup.
- Modify `src/app/stores/privateNotes.ts`: replace eager device-wide loading with explicit `bindOwner` and `clearOwner` lifecycle actions and owner-scoped persistence.
- Create `src/app/stores/__tests__/privateNotes.test.ts`: verify store binding, switching, restart hydration, sorting, and mutation safety.
- Modify `src/shared/services/syncSessionService.ts`: bind private notes after authenticated session preparation and expose a session-end cleanup that clears the private-note view.
- Modify `src/app/stores/auth.ts`: invoke session-end cleanup when credentials are removed.
- Modify auth-store test mocks under `src/app/stores/__tests__`: match the new session cleanup interface.
- Modify `src/shared/services/__tests__/syncService.test.ts`: replace the privacy-regressing expectation with two-account isolation and returning-owner restoration.
- Modify `src/pages/__tests__/AccountPage.test.ts` only if the real `$reset` dependency must be updated for account deletion; keep account deletion as full device cleanup.

---

### Task 1: Version And Migrate Private-Note Storage

**Files:**

- Modify: `src/shared/services/storageService.ts`
- Modify: `src/shared/services/__tests__/storageService.test.ts`

**Interfaces:**

- Produces: `appDataVersion = 6`
- Produces: `migrateAppDataFromVersion5ToVersion6(data: MigrationInput): MigrationInput`
- Produces storage shape:

```ts
interface PrivateNotesStorage {
  notesByUserId: Record<string, { notes: unknown[] }>;
  quarantinedLegacyNotes?: {
    notes: unknown[];
    quarantinedAt: string;
  };
}
```

- [ ] **Step 1: Add failing migration tests for a known owner**

Add a version-5 fixture whose `privateNotes` is `{ notes: [legacyNote] }` and whose `syncMetadata.ownerUserId` is `user-a`. Assert:

```ts
expect(migrateAppDataFromVersion5ToVersion6(fixture)).toMatchObject({
  appDataVersion: 6,
  privateNotes: {
    notesByUserId: {
      'user-a': { notes: [legacyNote] },
    },
  },
});
```

Also assert that meetings, tasks, participants, settings, onboarding, and sync metadata remain equal to the input values.

- [ ] **Step 2: Add failing tests for unknown ownership and empty data**

Assert that legacy notes without `syncMetadata.ownerUserId` become:

```ts
expect(result.privateNotes).toEqual({
  notesByUserId: {},
  quarantinedLegacyNotes: {
    notes: [legacyNote],
    quarantinedAt: expect.any(String),
  },
});
```

Assert that null, non-object, or empty legacy storage becomes `{ notesByUserId: {} }` without a quarantine entry.

- [ ] **Step 3: Run migration tests and verify the new cases fail**

Run:

```bash
npx vitest run src/shared/services/__tests__/storageService.test.ts
```

Expected: the version-6 migration export and assertions fail because the migration does not exist yet.

- [ ] **Step 4: Implement the version-6 migration**

In `storageService.ts`:

```ts
export const appDataVersion = 6;

const migrations: Record<number, Migration> = {
  1: migrateAppDataFromVersion1ToVersion2,
  2: migrateAppDataFromVersion2ToVersion3,
  3: migrateAppDataFromVersion3ToVersion4,
  4: migrateAppDataFromVersion4ToVersion5,
  5: migrateAppDataFromVersion5ToVersion6,
};
```

Implement the migration with these exact decisions:

```ts
export function migrateAppDataFromVersion5ToVersion6(
  data: MigrationInput
): MigrationInput {
  const legacyState = getRecord(data.privateNotes);
  const legacyNotes = Array.isArray(legacyState.notes) ? legacyState.notes : [];
  const syncMetadata = getRecord(data.syncMetadata);
  const ownerUserId =
    typeof syncMetadata.ownerUserId === 'string' &&
    syncMetadata.ownerUserId.trim()
      ? syncMetadata.ownerUserId.trim()
      : null;

  const privateNotes = ownerUserId
    ? {
        notesByUserId: {
          [ownerUserId]: { notes: legacyNotes },
        },
      }
    : legacyNotes.length
      ? {
          notesByUserId: {},
          quarantinedLegacyNotes: {
            notes: legacyNotes,
            quarantinedAt: nowIso(),
          },
        }
      : { notesByUserId: {} };

  return {
    ...data,
    appDataVersion: 6,
    privateNotes,
  };
}
```

Do not normalize note contents inside the envelope migration; retain the original values for recovery. The owner-scoped reader in Task 2 performs safe note normalization before display.

- [ ] **Step 5: Update existing version assertions and migration-chain fixtures**

Change version-5 expected envelopes to version 6 where the test exercises the complete migration chain. Keep direct version-4-to-5 tests unchanged. Add the version-5-to-6 migration to imports and ensure invalid or future-version recovery tests expect the new current version.

- [ ] **Step 6: Run storage tests**

Run:

```bash
npx vitest run src/shared/services/__tests__/storageService.test.ts
```

Expected: all storage tests pass.

---

### Task 2: Add An Owner-Scoped Storage Adapter

**Files:**

- Create: `src/features/private-notes/services/privateNotesStorageService.ts`
- Create: `src/features/private-notes/services/__tests__/privateNotesStorageService.test.ts`
- Consume: `src/features/private-notes/types.ts`
- Consume: `src/shared/services/storageService.ts`

**Interfaces:**

- Produces: `readPrivateNotesForUser(userId: string): PrivateNote[]`
- Produces: `writePrivateNotesForUser(userId: string, notes: PrivateNote[]): boolean`
- Consumes: `readStorageSlice('privateNotes', null)` and `writeStorageSlice('privateNotes', value)`

- [ ] **Step 1: Write failing adapter tests**

Mock `readStorageSlice` and `writeStorageSlice`. Cover:

```ts
expect(readPrivateNotesForUser('user-a')).toEqual([validUserANote]);
expect(readPrivateNotesForUser('user-b')).toEqual([validUserBNote]);
expect(readPrivateNotesForUser('')).toEqual([]);
```

Include malformed notes in `user-a` and assert they are excluded. Include `quarantinedLegacyNotes` and assert no user can read them.

For writes, begin with namespaces for A and B plus quarantine data, write A's new notes, and assert the exact call preserves B and quarantine:

```ts
expect(writeStorageSlice).toHaveBeenCalledWith('privateNotes', {
  notesByUserId: {
    'user-a': { notes: updatedUserANotes },
    'user-b': { notes: existingUserBNotes },
  },
  quarantinedLegacyNotes: existingQuarantine,
});
```

Assert that an empty user ID returns `false` and never calls `writeStorageSlice`.

- [ ] **Step 2: Run adapter tests and verify they fail**

Run:

```bash
npx vitest run src/features/private-notes/services/__tests__/privateNotesStorageService.test.ts
```

Expected: FAIL because the adapter module does not exist.

- [ ] **Step 3: Implement storage-shape validation and note normalization**

Move the existing `LegacyPrivateNote` shape and `normalizeNote` behavior from the Pinia store into the new adapter. Validate `notesByUserId` as a record and read only the exact requested key. Use `Object.create(null)` or object spreading without accepting prototype keys; reject user IDs equal to `__proto__`, `prototype`, or `constructor` before lookup or write.

The reader must return a new note array and never return quarantine contents:

```ts
export function readPrivateNotesForUser(userId: string): PrivateNote[] {
  const ownerUserId = normalizeOwnerUserId(userId);
  if (!ownerUserId) return [];

  const stored = normalizePrivateNotesStorage(
    readStorageSlice<unknown>('privateNotes', null)
  );
  const namespace = stored.notesByUserId[ownerUserId];

  return Array.isArray(namespace?.notes)
    ? namespace.notes
        .map(normalizeNote)
        .filter((note): note is PrivateNote => Boolean(note))
    : [];
}
```

- [ ] **Step 4: Implement namespace-preserving writes**

Read and normalize the current storage immediately before each write. Replace only `[ownerUserId]`, retain every other valid namespace and `quarantinedLegacyNotes`, and return `true` after calling `writeStorageSlice`. Clone the input note array so later Pinia mutations cannot alter the persisted object reference in tests or memory-backed environments.

- [ ] **Step 5: Run adapter tests**

Run:

```bash
npx vitest run src/features/private-notes/services/__tests__/privateNotesStorageService.test.ts
```

Expected: all adapter tests pass.

---

### Task 3: Bind The Private-Notes Store To One User

**Files:**

- Modify: `src/app/stores/privateNotes.ts`
- Create: `src/app/stores/__tests__/privateNotes.test.ts`
- Consume: `src/features/private-notes/services/privateNotesStorageService.ts`

**Interfaces:**

- Produces state: `ownerUserId: string | null`, `notes: PrivateNote[]`
- Produces action: `bindOwner(userId: string): boolean`
- Produces action: `clearOwner(): void`
- Changes: `persist(): boolean`
- Existing public actions retain names: `createNote`, `updateNote`, `deleteNote`

- [ ] **Step 1: Write failing lifecycle tests**

Mock the adapter and assert initial state is private:

```ts
const store = usePrivateNotesStore();
expect(store.ownerUserId).toBeNull();
expect(store.notes).toEqual([]);
expect(readPrivateNotesForUser).not.toHaveBeenCalled();
```

Bind A and B sequentially and assert each call replaces the active notes rather than merging them. Call `clearOwner()` and assert owner and notes are cleared without a storage write.

- [ ] **Step 2: Write failing mutation-safety tests**

Without binding an owner, assert:

```ts
expect(store.createNote(validPayload)).toBeNull();
expect(store.updateNote('note-a', validPayload)).toBeNull();
store.deleteNote('note-a');
expect(writePrivateNotesForUser).not.toHaveBeenCalled();
```

After binding A, assert each successful mutation calls `writePrivateNotesForUser('user-a', store.notes)` and that existing sorting behavior remains unchanged.

- [ ] **Step 3: Run store tests and verify they fail**

Run:

```bash
npx vitest run src/app/stores/__tests__/privateNotes.test.ts
```

Expected: lifecycle tests fail because the current store eagerly loads global notes and has no owner actions.

- [ ] **Step 4: Implement owner binding**

Initialize state without reading storage:

```ts
interface PrivateNotesState {
  ownerUserId: string | null;
  notes: PrivateNote[];
}

state: (): PrivateNotesState => ({ ownerUserId: null, notes: [] });
```

Implement `bindOwner` to trim and validate the user ID, clear the current owner and notes first, then read the requested namespace. If reading throws, retain `{ ownerUserId: null, notes: [] }` and return `false`. On success, set the owner and notes and return `true`.

Implement `clearOwner` as a memory-only action:

```ts
clearOwner() {
  this.ownerUserId = null;
  this.notes = [];
}
```

- [ ] **Step 5: Guard every mutation and persistence path**

`persist()` returns `false` when `ownerUserId` is null. Otherwise it delegates to `writePrivateNotesForUser`. `createNote` and `updateNote` return `null` while unbound. `deleteNote` performs no change while unbound. Preserve existing validation, timestamps, identifiers, and sort order.

- [ ] **Step 6: Run store tests**

Run:

```bash
npx vitest run src/app/stores/__tests__/privateNotes.test.ts
```

Expected: all private-notes store tests pass.

---

### Task 4: Connect Authentication Lifecycle And Prove Account Switching

**Files:**

- Modify: `src/shared/services/syncSessionService.ts`
- Modify: `src/app/stores/auth.ts`
- Modify: `src/shared/services/__tests__/syncService.test.ts`
- Modify: `src/app/stores/__tests__/authSync.test.ts`
- Modify: `src/app/stores/__tests__/authRevenueCatIdentity.test.ts`
- Modify: `src/app/stores/__tests__/authRefreshSingleFlight.test.ts`
- Modify: `src/app/stores/__tests__/authRefreshFailureHandling.test.ts`

**Interfaces:**

- Produces: `clearSyncSessionState(): void`
- Changes: `prepareSyncForAuthenticatedUser(userId: string)` always calls `privateNotesStore.bindOwner(userId)` after resetting transient sync runtime state.
- Consumes: `usePrivateNotesStore().bindOwner(userId)` and `usePrivateNotesStore().clearOwner()`.

- [ ] **Step 1: Replace the privacy-regressing account-switch assertion**

In `syncService.test.ts`, change the existing test that expects `private-note-1` to survive in the active store. Mock or use owner-specific stored results and assert:

```ts
expect(privateNotesStore.ownerUserId).toBe('new-user');
expect(privateNotesStore.notes).toEqual(newUserNotes);
expect(privateNotesStore.notes).not.toContainEqual(
  expect.objectContaining({ id: 'private-note-1' })
);
```

Also update the same-owner test to assert `bindOwner('user-1')` occurs even when synchronized datasets do not reset.

- [ ] **Step 2: Add logout and returning-owner tests**

Add a test covering this exact sequence with real Pinia stores and mocked storage adapter responses:

1. Bind A and create or load note A.
2. Call `clearSyncSessionState()` and assert the active store is empty.
3. Prepare B and assert only note B is active.
4. Clear the session to simulate process restart/logout.
5. Prepare A and assert note A returns.

Add an offline case in which `prepareSyncForAuthenticatedUser('user-a')` uses local storage successfully without calling any backend API. Add a Premium-state change around the sequence and assert the stored adapter is never asked to delete A or B.

- [ ] **Step 3: Run lifecycle tests and verify they fail**

Run:

```bash
npx vitest run src/shared/services/__tests__/syncService.test.ts src/app/stores/__tests__/authSync.test.ts
```

Expected: account-switch or logout assertions fail because private notes are not bound or cleared yet.

- [ ] **Step 4: Implement session binding and cleanup**

In `syncSessionService.ts`, instantiate the private-notes store inside lifecycle functions. At the beginning of `prepareSyncForAuthenticatedUser`, reset transient sync state and bind the authenticated user. Ensure a failed bind leaves the notes store empty. Keep the existing synchronized-data reset decision based on `syncMetadata.ownerUserId`.

Add:

```ts
export function clearSyncSessionState() {
  resetSyncRuntimeState();
  usePrivateNotesStore().clearOwner();
}
```

Do not change `syncRuntimeService.resetSyncRuntimeState`; sync retries must not clear private notes.

- [ ] **Step 5: Use session cleanup from the auth store**

Replace the auth store's session-end wrapper so logout, invalid refresh, expired credentials, and account deletion cleanup call `clearSyncSessionState()`. Keep `prepareSyncForSessionUser` binding after backend session verification and before committing the authenticated user to Pinia.

Update test module mocks to export `clearSyncSessionState`. Assert it is called after unauthorized cleanup and logout, and is not called for transient refresh failures that retain the authenticated session.

- [ ] **Step 6: Run lifecycle and auth tests**

Run:

```bash
npx vitest run src/shared/services/__tests__/syncService.test.ts src/app/stores/__tests__/authSync.test.ts src/app/stores/__tests__/authRevenueCatIdentity.test.ts src/app/stores/__tests__/authRefreshSingleFlight.test.ts src/app/stores/__tests__/authRefreshFailureHandling.test.ts
```

Expected: all selected tests pass.

---

### Task 5: Verify Cleanup, Restart Safety, And Release Checks

**Files:**

- Modify: `src/shared/services/__tests__/storageService.test.ts`
- Verify without modification unless its contract changes: `src/pages/__tests__/AccountPage.test.ts`
- Verify: all files changed in Tasks 1-4

**Interfaces:**

- Consumes the final version-6 envelope, storage adapter, owner-bound store, and auth lifecycle.
- Produces no new runtime API.

- [ ] **Step 1: Add a full-cleanup assertion for namespaced notes**

Seed an app-data envelope with A and B namespaces plus quarantined notes. Call the existing `clearAllLocalAppDataAfterAccountDeletion()` path and assert the app-data storage key and its backups are removed according to current cleanup semantics. Do not add selective retention for a deleted account.

- [ ] **Step 2: Add restart hydration coverage**

Create a fresh Pinia instance after storing A and B. Assert the new private-notes store initially has no owner and no notes. Bind B and assert only B appears. This proves persisted auth alone cannot cause eager note disclosure before session preparation.

- [ ] **Step 3: Run all focused privacy tests**

Run:

```bash
npx vitest run src/features/private-notes/services/__tests__/privateNotesStorageService.test.ts src/app/stores/__tests__/privateNotes.test.ts src/shared/services/__tests__/storageService.test.ts src/shared/services/__tests__/syncService.test.ts src/app/stores/__tests__/authSync.test.ts src/pages/__tests__/AccountPage.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 4: Run formatting and lint checks for touched files**

Run:

```bash
npx prettier --check src/features/private-notes/services/privateNotesStorageService.ts src/features/private-notes/services/__tests__/privateNotesStorageService.test.ts src/shared/services/storageService.ts src/shared/services/__tests__/storageService.test.ts src/app/stores/privateNotes.ts src/app/stores/__tests__/privateNotes.test.ts src/shared/services/syncSessionService.ts src/shared/services/__tests__/syncService.test.ts src/app/stores/auth.ts src/app/stores/__tests__/authSync.test.ts
npx eslint src/features/private-notes/services/privateNotesStorageService.ts src/features/private-notes/services/__tests__/privateNotesStorageService.test.ts src/shared/services/storageService.ts src/shared/services/__tests__/storageService.test.ts src/app/stores/privateNotes.ts src/app/stores/__tests__/privateNotes.test.ts src/shared/services/syncSessionService.ts src/shared/services/__tests__/syncService.test.ts src/app/stores/auth.ts src/app/stores/__tests__/authSync.test.ts
```

Expected: both commands pass. Format only touched files if the check reports local style differences; do not reformat unrelated files.

- [ ] **Step 5: Run the full mobile test suite and production build**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and Vue TypeScript plus Vite production build complete successfully. Existing Vite chunk-size or config-loader warnings may remain if unchanged by this work.

- [ ] **Step 6: Review the final diff for privacy invariants**

Confirm all of the following directly in the diff:

- No store initialization reads global private notes.
- Every note write includes a validated user ID.
- Writes retain other user namespaces and quarantine data.
- Logout and unauthorized cleanup empty active notes.
- Same-user authentication reloads that user's namespace.
- No account switch can retain the previous user's in-memory notes.
- No import/export or cloud synchronization was introduced.
- Unrelated working-tree changes remain untouched.

- [ ] **Step 7: Perform manual device validation before pilot release**

On a non-production test device, verify A → logout → B → app restart → A, including one offline restart and a Premium entitlement loss/restoration. Record the app revision and observed result in the release evidence. This step requires signed-device access and is not replaced by unit tests.
