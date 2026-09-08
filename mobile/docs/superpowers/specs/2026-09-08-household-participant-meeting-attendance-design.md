# Household Participant And Meeting Attendance Design

**Date:** 8 September 2026  
**Status:** Approved design, pending implementation plan

## Problem

`HouseholdMembersSettings.vue` calls `meetingsStore.syncActiveMeetingParticipants()` after creating or re-enabling a household participant. That action no longer exists. It was intentionally removed when active-meeting attendance became an explicit persisted selection. The component test currently invents the removed method, hiding the integration defect.

The stale call can throw after the participant mutation has already succeeded, interrupting confirmation, invitation, and sheet-close behavior.

## Decision

Remove both stale calls. Household membership and active-meeting attendance remain separate concerns.

- Creating a household participant does not alter `activeMeeting.participantIds`.
- Re-enabling a participant does not add their ID to an active meeting that did not already include them.
- If a re-enabled participant's ID is already saved in `activeMeeting.participantIds`, existing computed filtering makes them visible again automatically.
- Users change attendance through the existing meeting check-in flow and `setActiveMeetingParticipants(participantIds)` action.
- Do not restore `syncActiveMeetingParticipants` and do not replace it with a broad automatic synchronization action.

## Component Behavior

Participant creation continues to:

1. Validate permissions and participant input.
2. Create the participant through the participants store.
3. Continue the existing invitation decision or success flow.
4. Close or reset the editor as currently intended.

Participant re-enabling continues to update the participant through the participants store and close the relevant UI. Neither path calls the meetings store.

There is no new user-facing error state because removing the invalid integration eliminates the post-mutation exception. Existing participant validation and invitation errors remain unchanged.

## Testing

Replace the fabricated meetings-store mock contract with behavior tests using real Pinia participant and meeting stores where practical.

Tests must prove:

- Creating a participant completes without a runtime exception.
- Creating a participant while a meeting is active leaves its `participantIds` unchanged.
- Re-enabling an inactive participant completes without a runtime exception.
- Re-enabling a participant absent from the meeting leaves attendance unchanged.
- Re-enabling a participant already listed in the meeting makes that participant available through the existing active-meeting participant computation without rewriting attendance.
- The component and tests contain no reference to `syncActiveMeetingParticipants`.
- Existing owner permission and invitation behavior remains intact.

## Scope

This change does not redesign attendance, participant invitations, check-in limits, completed-meeting history, or participant deletion. It introduces no new store action, API call, migration, or localization text.
