# Premium Assistant MVP Design

## Goal

Make Premium valuable in one sentence: it turns a completed household meeting
into follow-through. The MVP provides AI meeting recaps, three lifetime Free
recap credits per workspace, and a shared Smart Follow-ups inbox with
device-local alerts.

## Scope

- Existing AI recap generation becomes available to a Free household for three
  successful, non-cached recaps over the workspace lifetime.
- Premium households have unlimited recap generation.
- Smart Follow-ups create a durable household inbox for overdue open tasks and
  agreements that require a midpoint check-in.
- Adults can act on each follow-up with **Done**, **Still working on it**, or
  **Discuss at next meeting**, and can snooze an item.
- The mobile client schedules device-local notifications from the server inbox
  using the existing Capacitor local-notification capability.
- The next meeting's review presents every unresolved agreement follow-up from
  an earlier meeting, with explicitly carried items highlighted for discussion.
- Premium purchase messaging explains that one household plan covers the whole
  household. Purchase management remains owner-only.

## Out of Scope

- Remote push delivery, device-token storage, FCM/APNs, or a notification
  provider.
- Email reminders.
- Google Calendar changes; those belong to Milestone 4.
- Changing the existing Free local reminder feature or its notification IDs.
- Changing, deleting, or hiding historical meetings, tasks, or agreements.
- A broad templates, insights, or private-notes implementation.

## Product Rules

### AI recap access

- `aiSummary` remains a Premium catalog feature and remains limited to owners
  and adult members.
- A Free workspace receives exactly three lifetime recap credits. Credits are
  workspace-scoped, not per person or device.
- An AI recap may use a credit only when it produces a new, successful summary.
  Cached summaries and failed provider attempts never consume a credit.
- Premium provides unlimited recaps. If Premium later expires, no new Premium
  recaps are generated once the three Free credits have been exhausted; already
  saved summaries remain readable.
- Subscription status must expose the remaining Free recap-credit count for
  Free workspaces. Premium workspaces must not receive a misleading finite
  credit balance.
- The recap entry point must display the remaining credits before the household
  reaches the limit, then show an outcome-focused upgrade prompt when depleted.

### Smart Follow-ups

- Add a new `smartFollowUps` Premium feature. Do not repurpose
  `agreementReminders`, which continues to represent the existing Free,
  device-local general reminder behavior.
- Follow-ups are durable, workspace-scoped inbox records. They are not source
  records and do not rewrite an agreement's text or a task's content.
- A follow-up may optionally target one active owner/adult workspace member.
  Without an assigned workspace adult, it is visible as a shared inbox item.
  The existing `participants` entity cannot be used for delivery because it is
  not linked to a user account or device.
- An overdue task is eligible while its status is `open` and its due date is in
  the past.
- An agreement becomes eligible for a midpoint check-in after the completed
  source meeting. The preferred due time is the midpoint between source-meeting
  completion and the household's next weekly meeting. If a next meeting cannot
  be determined, the due time is seven days after agreement creation.
- The household next-meeting calculation uses a server-owned weekday, local
  time, and IANA timezone. The setting is shared by the workspace and editable
  by owners/adults. The cadence setting supplies the known next meeting; the
  seven-day fallback applies only when it is not configured.
- An eligible adult sees the actions: **Done**, **Still working on it**, and
  **Discuss at next meeting**, plus a snooze action.
- **Done** resolves the follow-up. It preserves the original agreement/task and
  stops new alerts for that follow-up.
- **Still working on it** and **Discuss at next meeting** carry the item into
  the next meeting's review and suppress immediate repeat alerts.
- At the next meeting, every unresolved agreement follow-up from an earlier
  meeting must appear in the review section, including items still open as
  well as items explicitly carried forward. The client does not silently
  modify the underlying task or agreement.
- A resolved source, deleted source, completed task, or already-resolved
  follow-up is never surfaced or recreated by automation.

### Notifications and expiry

- The API inbox is authoritative. Local notifications are best-effort delivery
  only; a missed or unsupported device notification does not remove the inbox
  item.
- Each adult device schedules alerts for its own assigned items and shared
  items after inbox synchronization. Viewers never receive Smart Follow-up
  actions or alerts.
- Smart Follow-ups are Premium-only. When Premium expires, existing follow-ups
  remain readable. The service must not create new follow-ups or accept actions
  that schedule new automation (`snooze`, `stillWorking`, or
  `discussAtNextMeeting`). **Done** remains available so an adult can clear an
  existing item.
- Smart Follow-up alerts use a distinct local notification channel and IDs, so
  they never overwrite the existing Free reminders.

## Architecture

### Assistant entitlement

The generic feature catalog continues to resolve tier and role availability,
but AI recap authorization moves from route-level `requireFeature` enforcement
to a service-level assistant-entitlement decision. This decision combines:

1. authenticated role eligibility;
2. trusted Premium entitlement;
3. cached-summary reuse;
4. rate limits; and
5. Free-credit reservation and settlement.

This keeps all paths that can return an AI recap subject to one consistent,
testable rule. The API preserves the existing stable `premium_required` error
for an adult Free workspace whose credits are depleted.

### Credit storage and atomicity

Use a durable recap-credit reservation/ledger table and database RPCs rather
than deriving availability from an unprotected count of completed requests.

- A reservation is made only after the service has found no valid cached
  summary and has passed rate limits.
- The reservation is settled after the provider returns a valid summary and
  the summary is saved.
- A provider, validation, or persistence failure releases the reservation.
- A unique link to the summary request and transactional RPC conditions ensure
  concurrent requests cannot settle more than three Free credits.

The data is an audit trail for entitlement enforcement, not a client-facing
payment ledger. Clients receive the derived remaining count only.

### Follow-up storage and worker

Add server-owned assistant settings and follow-up records. The core follow-up
record contains:

- workspace ID;
- source type (`task` or `agreement`) and source ID;
- optional recipient workspace-user ID;
- current state (`open`, `resolved`, `snoozed`, `carry_to_next_meeting`);
- due/snooze time;
- action metadata (actor and timestamp); and
- the scheduled review-after time when carried forward.

Unique constraints and idempotent upserts prevent duplicate active follow-ups
for the same workspace source. All reads and writes filter by `workspace_id`.

The existing PGMQ worker receives typed assistant-evaluation jobs. A recurring
daily sweep job is re-enqueued within the queue's one-day delay limit; its
handler loads workspace-scoped sources, computes eligibility and due dates,
then creates or updates records idempotently. Queue retries must be safe.
Source content is never placed in a job message, so dead-letter records contain
no agreement/task text.

### API and client contract

Add an `assistant` route module that provides:

- household assistant settings read/update;
- paginated inbox read;
- a follow-up action endpoint with an explicit action enum and optional snooze
  time; and
- a meeting-review query for unresolved agreement follow-ups from earlier
  meetings.

All endpoints require authentication and server-side feature/role enforcement.
Missing cross-workspace sources and inbox records return `404` where needed to
avoid revealing private state.

The client adds an inbox store/API wrapper, an inbox page or surface, recap
credit presentation and paywalls, a next-meeting review component, and an
additional local-notification scheduler. It re-schedules on inbox sync,
follow-up action, role/account changes, and entitlement changes.

## Data Flow

### New recap

1. Adult requests a recap for a completed meeting.
2. The service validates workspace ownership, role, meeting completion, input
   size, and rate limits.
3. A valid cached summary returns immediately without reserving a credit.
4. Premium proceeds without a credit reservation; Free reserves one of the
   remaining three credits atomically.
5. The service calls the provider, validates output, saves the summary, and
   settles the reservation.
6. Any failure releases the reservation and returns a safe API error.

### Agreement lifecycle

1. An agreement is created from a completed meeting, optionally with a
   responsible workspace adult.
2. The worker schedules/evaluates its midpoint due time from the workspace
   cadence; without a cadence it uses seven days after creation.
3. The follow-up appears in the shared inbox or the responsible adult's inbox.
4. The current adult device schedules a local alert from the synced inbox item.
5. An adult chooses Done, Still working on it, Discuss at next meeting, or
   snooze.
6. At the next meeting, all unresolved agreement follow-ups from earlier
   meetings appear in the review; carried items are visually identified as
   needing discussion.

## Error Handling and Observability

- Provider failures, malformed output, and failed summary persistence release
  a Free-credit reservation.
- Queue handler retries are idempotent. Unknown job types and permanently
  failing work follow the existing dead-letter process.
- Use existing safe `ApiError` responses. Do not expose raw Supabase,
  provider, queue, or notification errors.
- Structured logs include event name, workspace ID, source/meeting ID, action,
  result, and error code. Do not log agreement text, task descriptions, tokens,
  or notification content.

## Migration and Security Requirements

- Create new, additive Supabase migrations only; do not edit applied
  migrations.
- Add foreign keys, workspace ownership indexes, and RLS decisions explicitly.
  Service-role access still requires explicit service authorization checks.
- Use nullable/new fields and safe defaults for any agreement responsibility
  metadata so rolling deployments remain compatible.
- Do not deploy a worker that consumes assistant jobs before the migrations and
  handler are available.
- No provider secrets, service-role credentials, device tokens, or notification
  tokens are introduced by this milestone.

## Test Requirements

- Migration and RPC tests for the lifetime three-credit limit, reservation
  release, settlement, and concurrent-credit safety.
- AI service and route tests for cache hits, failures, credits, Premium,
  role restriction, workspace isolation, and expired subscriptions.
- Follow-up repository/service/route tests for task and agreement eligibility,
  cadence midpoint and seven-day fallback, actions, expiry, source deletion,
  review inclusion, and workspace isolation.
- Worker-handler tests for idempotent retries and no duplicate inbox rows.
- Client tests for credit copy/paywalls, inbox states, local scheduler isolation
  from Free reminders, Premium expiry, viewer restrictions, and next-meeting
  review presentation.
- Run API typecheck, focused Vitest suites, OpenAPI generation/check, and
  client tests/build before release. Keep the known unrelated full-suite
  environment assertion and parallel-timeout flakiness out of scope.

## Rollout

1. Apply additive database migrations.
2. Deploy the API and worker handlers.
3. Deploy the client.
4. Verify staging with Free owner/adult/viewer and Premium owner/adult/viewer
   workspaces, including depletion after three successful recaps and the
   agreement lifecycle from midpoint alert through meeting review.

The API must deploy before the client. Existing subscription feature aliases
from prior milestones remain intact.
