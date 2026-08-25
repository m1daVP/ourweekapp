# Premium Personal Calendar Sync Design

## Goal

Let each adult in a Premium household optionally connect their own Google
Calendar, then choose whether OurWeek writes their weekly meeting reminders
and tasks assigned to them to that calendar. The integration must preserve
each adult's control and prevent one household member from seeing or managing
another adult's personal calendar.

## Scope

- Connect one adult's Google account through OAuth and use its primary
  calendar as the sole destination.
- Let that adult independently enable or disable:
  - weekly meeting reminders; and
  - due dates for tasks explicitly assigned to them.
- Create or update the corresponding Google events when the eligible OurWeek
  source record changes.
- Let the connecting adult disconnect at any time.
- Keep all connection, settings, event mappings, and provider operations
  strictly scoped to the authenticated adult and workspace.
- Show a retryable sync status when Google rejects or cannot complete an
  otherwise valid write.

## Out of Scope

- Choosing among several personal calendars.
- A shared household calendar or any owner-managed personal calendar
  connection.
- Agreement follow-up events, unassigned/shared task events, calendar export,
  a recurring reconciliation worker, and notifications caused by Calendar.
- Importing, reading, showing, or editing events that originated in Google.
- Deleting existing Google events when an adult disconnects.

## Product Rules

### Personal ownership and access

- Any owner or adult member of a Premium household may optionally connect
  their own Google account. Viewers cannot connect Calendar.
- A connection belongs to the authenticated adult, not to the workspace owner.
  No API or client view reveals another adult's Google account, calendar
  settings, OAuth state, or synced-event mappings.
- Premium entitlement is the household-level availability control for this
  first release. There is no additional workspace-owner calendar toggle; this
  avoids giving an owner control over another adult's personal calendar.
- Each connection targets the connected Google's account primary calendar.
  There is no calendar picker and no shared destination in this milestone.

### What syncs

- An adult with weekly-meeting sync enabled gets an event for the household's
  next weekly meeting/reminder according to the existing meeting scheduling
  model.
- An adult with task sync enabled gets an event only for a task that has a due
  date and is explicitly assigned to that adult's account.
- A task assigned to multiple adults produces one event in the primary
  calendar of each assigned adult who has both connected Google Calendar and
  enabled task sync.
- Participant-only, unassigned, and shared tasks remain in OurWeek. They are
  never inferred into a personal calendar by matching a name or email.
- Agreement follow-ups remain in the OurWeek Follow-ups inbox and meeting
  review; they do not reach Calendar in this release.

### Settings, disconnect, and entitlement changes

- The connected adult alone can change their two sync preferences or
  disconnect their account.
- Turning a sync preference off stops future writes for that source type. It
  does not delete events already created in Google.
- Disconnect revokes/removes OurWeek's stored connection and event mappings,
  so no future Google calls are made through that connection. Existing Google
  events stay in place; the product explains this before disconnect completes.
- If the household no longer has Premium, no new Calendar writes occur. The
  adults' settings and connection records remain private, and reconnecting or
  changing settings requires Premium again.

## Architecture

### Ownership model

The existing calendar domain remains the sole server-side owner of Google OAuth
tokens and Google API calls. `calendar_connections` and `calendar_events` are
always queried by both `workspace_id` and the authenticated `user_id`; service
role database access must not weaken that boundary.

Calendar preferences are stored server-side per connection/user, rather than
only in device state, so a person has a consistent choice across their devices.
The API returns only a compact status DTO for the caller: connection state,
their two preference values, and safe retry/error state. It never returns
tokens, calendar IDs, provider event IDs, or another user's data.

Tasks need an explicit account-level adult assignment for this purpose. The
task model should support a nullable/multi-value assigned-user relationship
that is safe to expand during a rolling deploy. Existing participant
responsibility remains compatible, but is not used as a proxy for Calendar
ownership. A later migration/backfill may map known participant-to-user links
only when it can do so without ambiguity.

### Sync strategy

Calendar writes happen at the action point instead of through a new background
worker. After an eligible meeting schedule/reminder or assigned task due date
is created, changed, or deleted, the server evaluates each affected adult's
connection and preference and performs an idempotent provider operation.

The event mapping is keyed by workspace, adult, source type, and source ID.
This ensures repeated saves update the same Google event rather than creating
duplicates. Removal of an eligible source or later loss of eligibility stops
future updates; provider-event deletion is deliberately deferred with the
broader calendar reconciliation work.

The source record is saved even if Google is unavailable. Calendar failures are
recorded as safe, non-sensitive status information and surfaced to the owning
adult with a retry path. Provider errors, tokens, and event contents are never
returned to the client or written to ordinary logs.

## Data Flow

### Connect and configure

1. An eligible adult opens Calendar settings and starts Google OAuth.
2. The backend binds the OAuth state and callback to that adult and workspace.
3. On success, OurWeek stores the private connection and reports it only to
   that adult.
4. The adult chooses weekly-meeting and task-due-date sync independently.
5. The client shows which source types are active and any retryable failure
   affecting that adult's connection.

### Weekly meeting sync

1. A household creates or changes its next weekly meeting/reminder.
2. The calendar service finds only connected adults in that workspace whose
   weekly-meeting preference is on.
3. For each such adult, it creates or updates that adult's mapped event in
   their primary Google Calendar.
4. A failed provider write does not roll back the OurWeek meeting change; the
   affected adult sees an actionable retry status.

### Assigned task sync

1. A task is created or changed with an account-level adult assignee and due
   date.
2. The calendar service evaluates only the explicitly assigned adults.
3. For each adult with an active connection and task preference, it creates or
   updates that adult's mapped primary-calendar event.
4. Removing the due date or the adult assignment makes that event ineligible
   for future writes and leaves the original task intact.

### Disconnect

1. The owning adult chooses Disconnect from their Calendar settings.
2. The client explains that OurWeek will stop future syncs but will not remove
   events that already exist in Google.
3. The backend verifies ownership, removes the connection and its mappings,
   and returns the owner's disconnected status.
4. No other workspace member can initiate, inspect, or retry this operation.

## Error Handling and Security

- Require authenticated workspace membership and trusted Premium access for
  all Calendar actions. Return a safe authorization error without leaking
  whether another adult has connected a calendar.
- OAuth callback state is short-lived, single-use, and bound to the initiating
  user and workspace. Reject callback/account mismatches safely.
- Provider tokens remain server-side and encrypted/handled according to the
  existing calendar connection implementation. They never enter API DTOs,
  analytics, or logs.
- Use idempotent event mapping and provider update semantics to make retries
  safe.
- Treat Google API failures as non-blocking integration failures. Preserve
  OurWeek source changes, record a generic retryable status, and log only
  structured non-sensitive diagnostics.
- Check task assignment and event-mapping ownership in the service, not only
  through client filtering or Supabase RLS.

## API and Client Contract

- Extend the existing Calendar status/settings contract with two per-user
  booleans: `weeklyMeetingSyncEnabled` and `assignedTaskSyncEnabled`, plus a
  safe connection/sync health indicator.
- Provide authenticated endpoints for the current adult to read and update
  only their own settings, begin/complete OAuth, retry their own pending sync,
  and disconnect their own connection.
- Task mutation contracts gain an additive explicit account-level assignee
  field or relationship. Legacy task data remains accepted during the expand
  phase.
- The mobile Calendar settings screen keeps the existing focused controls but
  labels them as personal: “Your Google Calendar”, “Weekly meetings”, and
  “Tasks assigned to you.” It explains that shared/unassigned items stay in
  OurWeek.

## Testing Requirements

- Calendar service/repository tests prove every connection, preference, event
  mapping, retry, and disconnect query is constrained by both workspace and
  authenticated user.
- Route tests cover unauthenticated, viewer, expired-Premium, wrong-workspace,
  and cross-adult attempts without exposing connection existence.
- OAuth tests cover state binding, callback mismatch rejection, and safe status
  DTOs with no credentials or provider IDs.
- Sync tests cover disabled preferences, missing due dates, single and
  multi-adult assignments, unassigned/shared tasks, repeated saves,
  reassignment, and provider failures that preserve the OurWeek write.
- Disconnect tests verify future sync stops, mappings are removed, existing
  Google events are not deleted, and another adult cannot disconnect or retry
  the connection.
- Client tests cover first connect, the two independent personal switches,
  retryable error state, privacy copy, and disconnect confirmation.

## Rollout

1. Add backward-compatible task account-assignment and per-user calendar
   preference schema. Review RLS, indexes, and service-role query scoping.
2. Deploy backend support for safe status/settings, personal OAuth ownership,
   idempotent meeting/task sync, and disconnect.
3. Deploy the mobile settings and explicit task-assignment UI.
4. Test owner, adult, viewer, two-adult, and expired-Premium cases in staging,
   including separate Google accounts in the same workspace.
5. Monitor non-sensitive provider failure rates and duplicate-event signals.

The first release intentionally favors personal control and predictable writes
over calendar breadth. Shared calendars, agreement follow-ups, calendar
selection, event cleanup, and background reconciliation can build on these
strict per-adult ownership boundaries later.
