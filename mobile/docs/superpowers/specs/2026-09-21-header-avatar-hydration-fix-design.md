# Header avatar hydration fix design

## Goal

Ensure the top-right avatar in the app shell resolves to the logged-in participant's actual avatar immediately on app open, instead of briefly showing the empty fallback (`WU`) until a later pull-to-refresh or sync completes.

## Problem summary

On Android, the app shell can render before the authenticated participant list has been hydrated from the backend. During that window, `currentUserParticipant` resolves to `null`, so the header falls back to `WU` even though the user has a persisted or synced participant record.

The behavior reproduces as:

1. user opens the app;
2. auth/session verification succeeds;
3. header renders before participant sync finishes;
4. avatar falls back to the placeholder state;
5. after pull-to-refresh, backend data arrives and the real avatar appears.

This is a hydration timing issue, not a rendering-only bug in the avatar component itself.

## Root cause

The header avatar depends on `participantsStore.activeParticipants` in [src/shared/components/AppShell.vue](src/shared/components/AppShell.vue), and that store is not guaranteed to be populated before the first shell render.

Relevant flow:

- auth verification runs in [src/app/stores/auth.ts](src/app/stores/auth.ts)
- the app shell mounts in [src/app/App.vue](src/app/App.vue)
- the backend participant data is hydrated later in [src/shared/services/syncService.ts](src/shared/services/syncService.ts)

Because the fallback branch is a simple `null` check, the UI briefly renders the default empty avatar until the sync completes.

## Scope

This fix includes:

- the startup hydration ordering for the current-user participant lookup;
- the app shell avatar fallback logic;
- the local persisted-state path for the current participant before sync completes;
- any minimal guards needed to avoid flashing placeholder state at first app open.

This fix excludes:

- redesigning the avatar component or avatar catalog;
- changing the sync API contract;
- changing subscription or auth logic;
- adding any new dependencies.

## Desired behavior

When the app opens:

- if the logged-in user already has a persisted or locally available participant record, the header should render that participant's avatar immediately;
- if the participant is not yet available, the empty-state placeholder should be deferred until the app can confirm there is no such participant;
- once sync finishes, the correct participant avatar should remain stable without requiring a manual refresh;
- the user should not see a transient `WU` fallback on normal startup if a valid participant record exists.

## Acceptance criteria

- Opening the app with a signed-in user and an existing participant record does not show the placeholder avatar before the real avatar is available.
- The header avatar resolves from the current participant data already present in local storage or store state before backend sync finishes.
- If no participant record exists, the empty fallback still displays safely and predictably.
- Pull-to-refresh remains functional and no longer acts like the only mechanism that restores the real avatar.
- No new API calls are introduced for this fix.
- The fix works with the existing app shell and local-first sync model.

## Proposed fix approach

### 1) Use the current participant from local state first

`AppShell.vue` should resolve the current user participant from the most immediately available local state before falling back to the placeholder.

This means using:

- `participantsStore.activeParticipants` when already hydrated;
- persisted participant data loaded from local storage when available;
- only then show the empty fallback if no match exists.

### 2) Avoid the empty fallback during startup hydration windows

The current empty-state fallback is a hard `v-else` branch. Replace it with a more defensive computed value that keeps the placeholder only after there is a real “not found” condition, not merely a “not hydrated yet” condition.

The app shell should treat these as distinct states:

- participant known and loaded;
- participant missing from all available local state;
- participant still hydrating and therefore not yet authoritative.

### 3) Keep the sync pipeline as the source of truth

This is not a change to syncing itself. The fix is to make the UI use the local participant state that already exists before the backend hydration completes. The later backend sync continues to populate the authoritative participant list.

## Implementation notes

### App shell changes

Update the computed value in [src/shared/components/AppShell.vue](src/shared/components/AppShell.vue) so it resolves the current participant using the local store and any persisted fallback, rather than assuming the participant list is already populated.

The fix should do the following without broad rewrites:

- compute `currentUserParticipant` with a readable guard;
- avoid placeholder rendering during the hydration gap;
- preserve existing behavior for guest or missing-user states.

### No change to backend data contract

No new backend endpoint, no schema change, no migration, and no provider changes are required.

## Edge cases to cover

- user signed in but participant list still empty because startup sync is in progress;
- user has local cached participant data but backend data not yet loaded;
- participant email mismatch due to case differences or stored-format variations;
- no matching participant record found at all;
- participant sync eventually replaces a local participant with a backend update.

## Verification plan

### Manual QA

1. clear persisted app data or use a known local participant state;
2. launch the app on Android;
3. confirm the header displays the correct participant avatar immediately without flashing `WU`;
4. confirm the avatar remains correct after the sync completes;
5. pull-to-refresh and confirm the avatar still renders correctly.

### Focused test coverage

Add or update minimal tests for the app shell participant resolution:

- current user with valid local participant returns real avatar;
- current user with not-yet-hydrated store still resolves local stored participant; 
- no participant record returns placeholder fallback;
- participant email normalization remains stable.

## Out of scope

- redesigning the app header or avatar UI;
- changing participant sync behavior or remote contracts;
- broad refactors unrelated to avatar hydration timing.

## Definition of done

The fix is complete when the user can open the app and see the correct participant avatar immediately without relying on a pull-to-refresh action, and the app still behaves correctly under the existing local-first sync model.
