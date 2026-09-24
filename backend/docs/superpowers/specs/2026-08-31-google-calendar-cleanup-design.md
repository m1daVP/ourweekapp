# Google Calendar Cleanup Design

## Goal

Remove only Google Calendar events created by OurWeek when a user disables a sync option or disconnects Google Calendar.

## Scope

Calendar-event records already map each OurWeek source to its Google event ID, workspace, and user. The cleanup flow uses those mappings and never searches, lists, or deletes unrelated user calendar events.

The existing mobile Calendar Sync controls retain their API contract. The backend performs cleanup as part of the existing settings-update and disconnect operations.

## Deletion Rules

| User action | Google events removed |
| --- | --- |
| Disable weekly meeting sync | `weekly_meeting` event only |
| Disable assigned task due-date sync | `task_due_date` events only |
| Disconnect Google Calendar | Every mapped OurWeek event: `weekly_meeting`, `task_due_date`, `meeting_reminder`, and `follow_up_date` |

The cleanup always scopes mappings by the authenticated user’s `workspace_id` and `user_id`.

## Remote-First, Retry-Safe Flow

Before changing preferences or revoking tokens, the calendar service loads the relevant event mappings and calls Google Calendar’s `events.delete` for every mapped provider event ID.

Google’s not-found response is treated as a successful cleanup because the desired remote state has already been reached. Any other provider failure stops the operation:

- settings are not changed, so the toggle remains enabled;
- Google credentials and event mappings remain available;
- a retry can safely repeat every deletion, including events already removed before a later deletion failed.

Only after every relevant remote deletion has succeeded does the backend delete the corresponding mapping rows. A successful disconnect then revokes the Google token and clears the local connection record.

## Repository and Provider Boundaries

The calendar repository gains a narrow read method that lists mappings for one workspace, one user, and an explicit set of `CalendarSourceType` values. It returns only the mapping data required for deletion.

The Google Calendar provider gains `deleteEvent({ tokens, providerEventId })`. It deletes only the explicit event ID in the user’s `primary` calendar and treats Google’s 404 response as success. Provider errors are converted by the existing service behavior into a safe API error; no Google error data or tokens are returned to the client.

## Existing Events and User Messaging

The behavior affects all already-mapped OurWeek events as well as future ones. Events without an OurWeek mapping are never touched.

The mobile disconnect confirmation copy must state that disconnecting removes all OurWeek-created Google Calendar events. The setting descriptions must state that turning an option off removes the events created by that option. Add explicit English, Ukrainian, and Spanish translations for this wording.

## Testing

Add focused tests for:

- repository filtering by workspace, user, and source types;
- provider deletion request shape and 404-as-success behavior;
- weekly and task-toggle cleanup deleting only their matching source types before preferences change;
- disconnect deleting all mapped source types before token revocation and local cleanup;
- a provider failure preserving both the enabled setting/connection and all mapping rows so retry is possible;
- no attempt to delete unmapped or unrelated-user events;
- complete English, Ukrainian, and Spanish cleanup messaging.

## Non-Goals

- Deleting user-created or third-party Google Calendar events
- Deleting an individual event while its sync option remains enabled
- A database migration or a public API contract change
- Best-effort disconnects that silently leave OurWeek events in Google Calendar
