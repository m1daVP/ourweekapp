# Meeting Finish Without Draft Confirmation Design

## Goal

Allow a user to finish a meeting they just completed without being interrupted by a confirmation about temporary note, task, or agreement composer drafts.

## Current Problem

The meeting item composer saves unfinished form input locally so text can survive an accidental sheet close. The final meeting action currently treats those temporary records as a blocking condition. It opens an "unfinished drafts" confirmation, and its review action moves the user back to an earlier meeting section with a composer sheet open.

That behavior exposes an internal recovery mechanism as part of the normal meeting-completion flow. Users do not intentionally create or manage these records as meeting drafts, so the warning and backward navigation are confusing.

## Behavior

Temporary composer drafts remain available while an active meeting is in progress. They continue to protect typed note, task, or agreement input when a composer sheet closes before submission.

When the user selects **Finish meeting**:

1. The app removes all unsubmitted composer drafts scoped to the current user, workspace, and meeting.
2. The app immediately runs the existing meeting completion flow.
3. No draft-resolution dialog is displayed, and the user is not moved back to an earlier section.

Submitted notes, tasks, and agreements are meeting data rather than composer drafts and remain unchanged.

If local draft cleanup fails, the meeting is not completed. The app shows the existing safe save-failure message so it does not report a successful finish while stale recovery data remains associated with the meeting.

## Architecture

Keep composer auto-save and storage scoping unchanged. Move draft cleanup into the `finishMeeting` path before the meeting store is marked complete. Reuse the existing scoped draft lookup and discard functions so cleanup cannot affect another meeting, workspace, or user.

Remove the draft-resolution state and handlers from the meeting session composable and remove its confirmation dialog and review-only UI state from `MeetingPage.vue`. No API or database change is required because composer drafts are local device state.

## Testing

Focused tests will verify that:

- finishing with no composer drafts follows the existing successful completion path;
- finishing with one or more unsubmitted composer drafts silently removes them and completes the meeting;
- no draft-resolution dialog is rendered during completion;
- a cleanup failure prevents completion and exposes the existing safe error message;
- drafts belonging to another meeting, workspace, or user are not removed.

After focused tests, run `npm run build` and `npm run check`.

## Constraints

- Preserve composer auto-save during an active meeting.
- Do not change submitted meeting items.
- Do not add dependencies or backend behavior.
- Preserve unrelated working-tree changes.
- Do not create a Git commit unless explicitly requested.
