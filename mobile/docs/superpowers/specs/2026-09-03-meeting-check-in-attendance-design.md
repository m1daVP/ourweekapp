# Meeting Check-in Attendance Design

## Goal

Keep a meeting's selected attendees stable while allowing the meeting owner to return to check-in and edit them at any time before completion.

## Problem

The first meeting section and the check-in screen both use `currentSectionIndex === 0`. Whether check-in has started is held only by the `hasStartedRitual` Vue ref. A route remount, refresh, or data restoration therefore shows check-in again without a durable record of the meeting phase.

The meeting store also merges every active household participant into an existing meeting when it is resumed or when the participant roster changes. That causes a meeting's selected attendee list to change independently of the check-in UI. In particular, a stale two-person meeting can render briefly and then be expanded to three active household members.

## Chosen Design

Add `checkInCompleted: boolean` to the meeting model and sync contract. It is an explicit, durable meeting-phase value:

- A new meeting starts with all current active household members selected and `checkInCompleted: false`.
- Starting the ritual writes the current selected participant IDs and sets `checkInCompleted: true` in one meeting update.
- The Back action from the first discussion section sets `checkInCompleted: false`, returning to the check-in screen without changing participant IDs.
- A completed check-in is rendered as the first discussion section even after a refresh, route remount, or sync response.
- A meeting's `participantIds` are attendance selected for that meeting. They are initialized only when a meeting is created and are never expanded from the current household roster while resuming, hydrating, or syncing participants.

## Data and API Contract

The frontend `Meeting` type, meeting sync DTO mapper, local storage migration, and snapshot comparison include `checkInCompleted`.

The backend meeting Zod schemas, repository DTOs, database select/insert/update mappings, and sync snapshots include the same field. A new Supabase migration adds `check_in_completed boolean not null default false` to `meetings`. Existing rows receive `false`, which safely exposes the check-in screen and preserves their existing selected participant IDs for review or correction.

The change is additive and compatible with a rolling deployment: frontend hydration treats a missing value from an older server as `false`; backend parsing treats an absent value from an older client as `false` until all clients have upgraded.

## Sync and Conflict Behavior

`checkInCompleted` participates in the existing full-meeting optimistic concurrency and last-write-wins conflict mechanism. It is not a separate resource. The existing participant-reference validation remains unchanged: selected IDs must exist in the workspace.

Hydration may merge remote meetings, but it must not switch the active meeting away from a locally selected valid active meeting merely because an older list response supplies another active meeting ID.

## UX and Error Handling

There is no new screen or API error. The existing check-in screen keeps its current requirement that at least one participant be selected before Start is enabled. Returning to check-in retains the meeting's saved attendee selection, and edits are persisted through the existing meeting-sync flow.

## Tests

Add focused frontend tests for:

- a three-person selection that survives starting, returning to check-in, remounting, and synchronization;
- a roster update or meeting resume that does not mutate an existing meeting's selected attendees;
- durable first-section rendering controlled by `checkInCompleted` rather than a component-local ref;
- local active-meeting selection winning over a stale hydration response.

Add API tests for accepting, returning, and synchronizing `checkInCompleted`, including old payloads that omit it.

## Scope Boundaries

This change does not alter participant management, roles, invitation behavior, attendee limits, meeting templates, or completed-meeting behavior. It does not introduce a separate attendance table because the existing `participant_ids` array is already the stable meeting-attendance record.
