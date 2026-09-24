# Soft-deleted meeting references in task sync

## Goal

Allow tasks, agreements, and task review decisions to retain references to a
soft-deleted meeting in the same workspace. The reference is historical
provenance and must not cause task sync to fail.

## Scope

The task-sync service will validate meeting references against the authenticated
workspace while including soft-deleted meetings. It will continue rejecting an
ID that does not exist in that workspace, including IDs from another workspace.

This applies to task `sourceMeetingId`, agreement `sourceMeetingId`, and both
meeting IDs on a review decision.

## Design

The task module's meeting repository port will accept the existing optional
`includeDeleted` argument exposed by `MeetingsRepository`. The task-sync
reference lookup will pass `true` when resolving a meeting reference. No schema,
response DTO, migration, or authorization change is needed: the existing
workspace filter remains the authorization boundary.

## Error handling

Unknown and cross-workspace meeting IDs will retain the current behavior:

- tasks and agreements receive an `invalid_reference` sync conflict;
- review decisions reject the request with
  `task_review_decision_invalid_reference`.

Soft-deleted meetings will be treated as valid references and will no longer
produce either outcome.

## Verification

Add focused service tests that configure the meeting repository mock to return a
soft-deleted meeting only when `includeDeleted` is true. Verify successful sync
for a task and review decision, and verify that lookup is called with `true`.
Existing invalid-reference coverage continues to protect unknown IDs.
