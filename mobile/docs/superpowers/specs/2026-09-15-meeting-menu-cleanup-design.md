# Meeting Menu Cleanup Design

## Goal

Simplify the active meeting overflow menu by removing the Pause/Resume and End Session actions. The menu will contain only Save draft and exit and Delete meeting, with no divider between them.

## Frontend Changes

- Remove the Pause/Resume item from `MeetingPage.vue`.
- Remove the End Session item and its divider from `MeetingPage.vue`.
- Remove menu-only pause/resume handlers and exposed state from `useMeetingSession.ts`.
- Remove the incomplete-session confirmation dialog, state, handlers, and related translations.
- Remove the unused `endMeetingIncomplete` and `resumeActiveMeeting` store actions.
- Keep `pauseMeeting` because closing the meeting page still uses it to save the meeting as paused before returning Home.
- Keep `resumeMeeting(meetingId)` because reopening an unfinished meeting still uses it.
- Keep the reusable `ActionMenuPopup` divider capability because this change applies only to the meeting menu.

## Compatibility

Keep `paused` and `incomplete` in frontend and backend meeting status schemas. Existing local or synced records may still contain those statuses, and both remain resumable. No database migration or backend runtime change is required.

## Resulting Behavior

- Save draft and exit saves the active meeting as a draft and leaves the meeting screen.
- Delete meeting requires confirmation, soft-deletes the active unfinished meeting and its associated local task/agreement records, and returns Home.
- Closing the meeting page through its existing Close control continues to save it as paused and return Home.
- The final review Finish action remains unchanged and continues to complete the meeting normally.

## Verification

- Update focused component/composable/store tests that reference removed actions.
- Run the frontend TypeScript check.
- Run relevant frontend tests, followed by the full frontend test suite when practical.
- No backend tests are required because the backend contract and behavior remain unchanged.
