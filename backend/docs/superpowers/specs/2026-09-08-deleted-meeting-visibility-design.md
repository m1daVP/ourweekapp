# Deleted Meeting Visibility Design

## Goal

Deleting an unfinished meeting must hide it immediately on the current device, remain hidden while offline, and prevent it from reappearing after synchronization on any meeting template or history view.

## Current Behavior

The client represents a deletion with a `deletedAt` tombstone. The tombstone remains in local state until sync can send it to the API, where the backend soft-deletes the workspace-scoped meeting. Normal backend meeting lists already exclude soft-deleted records.

Most UI paths exclude tombstoned meetings. The meeting-template page, however, derives its active draft from any unfinished meeting and omits the `deletedAt` check. As a result, a deleted draft can be offered as a meeting to continue before sync removes the local tombstone.

## Design

Continue preserving local tombstones for offline-first synchronization. Every UI path that identifies an unfinished or resumable meeting must exclude records with `deletedAt`.

For this regression, update the template page's active-draft selector to require both an unfinished status and no `deletedAt` value. Keep the store's deletion behavior, sync payload, server soft-delete behavior, and API contract unchanged.

## Data Flow

1. A user deletes an unfinished meeting.
2. The client assigns `deletedAt`, clears an active reference when applicable, clears the draft-save marker if no unfinished meetings remain, and persists the tombstone locally.
3. UI selectors ignore the tombstone, including template and history surfaces.
4. On reconnect, sync sends the tombstone; the backend soft-deletes the meeting and returns only visible meetings.
5. The client removes the local tombstone after merging the acknowledged response. The deleted meeting remains absent.

## Error Handling

No new error behavior is required. If sync is unavailable, the tombstone remains persisted locally and hidden. Existing conflict behavior continues to protect against a concurrent update from another device.

## Testing

- Add a template-page regression test that verifies a deleted unfinished meeting does not produce an active-draft suggestion.
- Add or extend store/sync coverage to confirm the deletion clears active-draft state and remains absent after server synchronization.
- Run the targeted frontend test suites and frontend typecheck; the backend does not require a behavior change for this defect.

## Scope Boundaries

- Do not hard-delete local meeting records before server synchronization.
- Do not alter database migrations, backend deletion semantics, or API DTOs.
- Keep existing deletion of meeting-derived tasks and agreements unchanged.
