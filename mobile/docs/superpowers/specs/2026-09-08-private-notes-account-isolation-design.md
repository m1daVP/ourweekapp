# Private Notes Account Isolation Design

**Date:** 8 September 2026  
**Status:** Approved design, pending implementation plan

## Problem

Private notes currently use one device-level storage slice and one Pinia state. When a different account signs in on the same device, synchronized household data is reset, but private notes remain active and visible. This exposes one account's private notes to another account.

Private notes must remain local to the device while being isolated by the authenticated account. Import and export are outside this change.

## Goals

- Store private notes under the immutable authenticated user ID.
- Expose only the currently authenticated user's notes.
- Preserve each user's local notes across logout, account changes, restarts, offline use, and Premium entitlement changes.
- Clear the active in-memory notes immediately when the session is removed or changes owner.
- Migrate existing private notes without silently assigning them to an unrelated future login.
- Fail closed when ownership cannot be established or stored data is malformed.

## Non-Goals

- Private-note import or export.
- Cloud synchronization of private notes.
- Encryption of note content at rest.
- Sharing notes between household members.
- Changing Premium entitlement rules.

## Storage Model

The `privateNotes` field in the existing app-data envelope will become a user-keyed collection:

```ts
interface PrivateNotesStorage {
  notesByUserId: Record<
    string,
    {
      notes: unknown[];
    }
  >;
  quarantinedLegacyNotes?: {
    notes: unknown[];
    quarantinedAt: string;
  };
}
```

The storage key remains part of the current application envelope so existing backup, corruption recovery, diagnostics, and account-deletion behavior continue to cover it. Email is not an ownership key because it can change and requires normalization; the backend-issued user ID is stable.

Only storage helpers dedicated to private notes will read or update this structure. Updates must preserve namespaces belonging to other users.

## Store Responsibilities

The private-notes Pinia store will keep:

- `ownerUserId: string | null`, identifying the active namespace.
- `notes: PrivateNote[]`, containing only the active owner's notes.

It will expose explicit lifecycle actions:

- `bindOwner(userId)` clears the current view, loads the requested namespace, then marks it active.
- `clearOwner()` removes the active owner and empties the in-memory view without deleting persisted namespaces.

Create, update, delete, and persistence operations require a bound owner. If no owner is bound, they return safely without writing. Persistence updates only the bound owner's namespace and preserves all other namespaces and quarantined data.

Store initialization does not load any private notes before an authenticated user is bound. This prevents a restored browser or native process from rendering notes based only on device storage.

## Authentication And Session Flow

After the backend verifies an authenticated session, `prepareSyncForAuthenticatedUser(userId)` binds the private-notes store to that user. This happens both when the same account resumes and when the account changes.

When the owner changes, the active notes view is cleared before the new namespace is loaded. The existing synchronized-data reset still handles meetings, tasks, participants, and workspace state.

Session cleanup and logout call `clearOwner()` so private notes disappear from memory immediately. Persisted namespaces remain on the device. Account deletion retains its existing full local-data cleanup and therefore removes every local private-note namespace.

Premium access controls whether the private-notes feature can be opened or edited. It does not delete, migrate, or reassign stored notes.

## Migration

The app-data version will be incremented by one and a focused migration will convert the legacy `{ notes: [...] }` private-notes value.

1. Preserve the legacy note entries during the envelope migration so recovery data is not discarded; normalize them with the existing safe note-shape rules only when an owned namespace is loaded for display.
2. Read `syncMetadata.ownerUserId` from the same pre-migration envelope.
3. When a non-empty recorded owner exists, move the preserved notes to `notesByUserId[ownerUserId]`.
4. When no owner exists, move the preserved notes to `quarantinedLegacyNotes` with a migration timestamp.
5. Never load quarantined notes into the active store and never assign them to a later login.

The existing migration backup process preserves the original app-data envelope before a failed or incompatible migration. Empty or non-array legacy note collections produce an empty keyed structure. The migration must make the same ownership decision for the same input and preserve unrelated app-data fields; the quarantine timestamp records when migration occurred.

There is no recovery UI for quarantined notes in this scope. They remain retained for a future explicit recovery or import feature.

## Failure Handling

- An unbound store never reads, displays, or writes a user's note namespace.
- A malformed namespace produces an empty active view; valid namespaces for other users remain untouched.
- Invalid individual notes are excluded using existing normalization behavior.
- A transition failure leaves the active view empty rather than retaining the previous owner's notes.
- Persistence failure follows the existing storage recovery behavior and must not replace another user's namespace.
- User IDs and note content must not be written to diagnostic logs beyond the storage already required for the feature.

## Testing

Focused tests will verify:

- Account A creates notes, logs out, and the in-memory view becomes empty.
- Account B signs in and cannot see or modify account A's notes.
- Restarting while account B is authenticated loads only B's namespace.
- Account A signs in again and regains A's notes.
- An authenticated cached session can bind its namespace without network access.
- Premium loss and restoration do not delete or expose notes.
- Legacy notes migrate to the recorded sync owner.
- Legacy notes without an owner are quarantined and never shown to the next login.
- Account deletion removes all private-note namespaces through the existing full cleanup.
- Store mutations fail safely while no owner is bound.
- Malformed namespaces and notes fail closed.
- The existing account-switch regression test expects an empty private-notes view after switching owners.

Tests should exercise the real private-notes store interface. Mocks used by auth lifecycle tests must include the same `bindOwner` and `clearOwner` actions so they cannot preserve an invented integration contract.

## Release Notes And Limits

This change provides application-level account isolation on a shared device. Note content remains in ordinary local application storage and is not encrypted by this work. Physical access, device backups, developer tools, and compromised devices remain separate risks.

Manual verification should cover account A to logout to account B to restart to account A on a native build, including an offline resume and a Premium entitlement change.
