# Weekly Us API Endpoints and Backend Logic

Last updated: 2026-06-04

This document describes the backend API required to move Weekly Us from the current local/mock MVP behavior to an API-backed MVP.

Weekly Us is still an Android-first mobile app. The backend must support a calm weekly meeting flow, not a generic family organizer. Keep server behavior focused on accounts, household workspace sync, meetings, tasks, agreements, Premium access, AI summaries, and optional Google Calendar sync.

## Current Frontend Contract

The frontend already has API client stubs under `src/shared/api`:

- `httpClient.ts`
- `authApi.ts`
- `meetingsApi.ts`
- `tasksApi.ts`
- `subscriptionsApi.ts`
- `aiApi.ts`
- `calendarApi.ts`

Backend mode is controlled by:

```txt
VITE_API_BASE_URL=
VITE_API_MODE=backend
```

When backend mode is disabled, the app uses local/mock behavior. In production API-backed builds, `VITE_API_BASE_URL` must be configured and the mobile app must not contain API provider secrets, AI provider keys, Google OAuth secrets, or billing secrets.

## Backend Stack

The API-backed MVP will use:

- Fastify with TypeScript for the backend HTTP API.
- Supabase for PostgreSQL hosting, database operations, and production infrastructure support.
- Zod for request validation, response schema validation where practical, and OpenAPI schema generation.

Supabase should not change the mobile app contract. The mobile app should continue talking to the Fastify API, not directly to Supabase tables or secrets.

## API Conventions

Base path:

```txt
https://api.example.com
```

Recommended versioned base path:

```txt
https://api.example.com/v1
```

Content type:

```txt
application/json
```

Auth header for protected routes:

```txt
Authorization: Bearer <accessToken>
```

All timestamps should be ISO 8601 UTC strings.

All IDs should be stable strings. UUIDs are recommended.

All user-facing errors must be calm and recoverable. Do not return raw provider, database, token, or AI errors to the mobile app.

Standard error response:

```json
{
  "message": "Something went wrong while saving the meeting. Please try again.",
  "code": "meeting_save_failed",
  "details": {}
}
```

Common status codes:

- `200`: successful read or update.
- `201`: created.
- `204`: successful action with no body.
- `400`: invalid request shape.
- `401`: missing or expired session.
- `403`: authenticated but not allowed or missing Premium entitlement.
- `404`: resource not found or not in the user's workspace.
- `409`: sync conflict that cannot be auto-merged.
- `422`: validation error.
- `429`: rate limit exceeded.
- `500`: server error with safe user-facing message.

## Core Data Types

These shapes mirror the current frontend domain types. The backend can store additional internal fields, but API responses should stay compatible.

### User

```ts
type PlanType = 'free' | 'premium';
type UserRole = 'owner' | 'adult_member' | 'viewer';

interface AuthUserDto {
  id: string;
  email?: string;
  displayName?: string;
  role: UserRole;
  planType: PlanType;
  createdAt: string;
  updatedAt: string;
}
```

### Workspace

```ts
type WorkspaceMemberStatus = 'active' | 'invited' | 'removed';

interface WorkspaceMember {
  userId: string;
  displayName: string;
  email?: string;
  role: UserRole;
  status: WorkspaceMemberStatus;
}

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members: WorkspaceMember[];
  createdAt: string;
  updatedAt: string;
}
```

### Participant

Participants are household people shown in meetings. A child participant is not a real login in the MVP.

```ts
type ParticipantType = 'adult' | 'child' | 'other';

interface Participant {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  type: ParticipantType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Meeting

```ts
type MeetingStatus = 'draft' | 'in_progress' | 'paused' | 'incomplete' | 'completed';
type MeetingTaskStatus = 'open' | 'done' | 'skipped';
type TaskResponsibilityType = 'participant' | 'shared' | 'needsDiscussion';

interface MeetingDto {
  id: string;
  templateId: string;
  title: string;
  status: MeetingStatus;
  participantIds: string[];
  sections: MeetingSection[];
  currentSectionIndex: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  aiSummary?: MeetingSummary;
  serverRevision?: number;
  deletedAt?: string;
}
```

### Task and Agreement

```ts
type TaskStatus = 'open' | 'done' | 'skipped';

interface TaskDto {
  id: string;
  title: string;
  description?: string;
  responsibilityType: TaskResponsibilityType;
  responsibleParticipantIds: string[];
  dueDate?: string;
  status: TaskStatus;
  sourceMeetingId?: string;
  createdAt: string;
  updatedAt: string;
  serverRevision?: number;
  deletedAt?: string;
}

interface AgreementDto {
  id: string;
  title: string;
  description?: string;
  participantIds: string[];
  relatedTaskIds?: string[];
  sourceMeetingId: string;
  createdAt: string;
  updatedAt: string;
  serverRevision?: number;
  deletedAt?: string;
}
```

### Meeting Summary

```ts
interface MeetingSummary {
  id: string;
  meetingId: string;
  shortSummary: string;
  mainTopics: string[];
  keyTensions: string[];
  agreements: string[];
  tasks: MeetingSummaryTask[];
  suggestedNextMeetingFocus: string[];
  createdAt: string;
}
```

## Authentication Endpoints

### `POST /auth/register`

Creates a user, creates the first household workspace, assigns the user as `owner`, and returns a session.

Request:

```json
{
  "email": "rita@example.com",
  "password": "strong-password",
  "displayName": "Rita"
}
```

Response:

```json
{
  "user": {
    "id": "user_123",
    "email": "rita@example.com",
    "displayName": "Rita",
    "role": "owner",
    "planType": "free",
    "createdAt": "2026-06-04T12:00:00.000Z",
    "updatedAt": "2026-06-04T12:00:00.000Z"
  },
  "accessToken": "access-token",
  "refreshToken": "refresh-token",
  "expiresAt": "2026-06-04T13:00:00.000Z"
}
```

Required logic:

- Validate email and password.
- Normalize email.
- Prevent duplicate accounts.
- Hash passwords using a production-safe password hashing algorithm.
- Create default workspace and owner membership.
- Return `planType: "free"` until a trusted entitlement says otherwise.
- Do not send password hashes or internal security fields.

### `POST /auth/sign-in`

Authenticates a user and returns a session.

Request:

```json
{
  "email": "rita@example.com",
  "password": "strong-password"
}
```

Response: same as `POST /auth/register`.

Required logic:

- Rate limit attempts.
- Use safe failure messages that do not reveal whether an email exists.
- Include the user's current workspace role and current plan.

### `POST /auth/refresh`

Refreshes an expired or nearly expired access token.

Request:

```json
{
  "refreshToken": "refresh-token"
}
```

Response: same session shape as `POST /auth/register`.

Required logic:

- Validate refresh token, expiry, revocation, and device/session record.
- Rotate refresh tokens if the backend session model supports it.
- Return `401` when refresh fails so the mobile app can sign out cleanly.

### `POST /auth/sign-out`

Revokes the current session.

Request: empty body.

Response: `204 No Content`.

Required logic:

- Revoke the current refresh token or session record.
- Do not delete synced household data.

### `GET /auth/me`

Returns the current user or `null`.

Response:

```json
{
  "id": "user_123",
  "email": "rita@example.com",
  "displayName": "Rita",
  "role": "owner",
  "planType": "free",
  "createdAt": "2026-06-04T12:00:00.000Z",
  "updatedAt": "2026-06-04T12:00:00.000Z"
}
```

Required logic:

- Return only the authenticated user's safe profile.
- Include the role for the active workspace.
- Include the effective plan after entitlement validation.

### `POST /auth/password-reset/request`

Starts a password reset flow.

Request:

```json
{
  "email": "rita@example.com"
}
```

Response:

```json
{
  "message": "If an account exists, reset instructions have been sent."
}
```

Required logic:

- Always return a safe generic response.
- Rate limit requests.
- Send reset email through a backend email provider.

### `POST /auth/password-reset/confirm`

Completes password reset.

Request:

```json
{
  "token": "reset-token",
  "password": "new-strong-password"
}
```

Response: `204 No Content`.

Required logic:

- Validate token and expiry.
- Update the password hash.
- Revoke existing sessions if required by security policy.

## Workspace and Member Endpoints

### `GET /workspace`

Returns the authenticated user's active household workspace.

Response:

```json
{
  "id": "workspace_123",
  "name": "Our home",
  "ownerId": "user_123",
  "members": [],
  "createdAt": "2026-06-04T12:00:00.000Z",
  "updatedAt": "2026-06-04T12:00:00.000Z"
}
```

Required logic:

- Return only a workspace the user belongs to.
- Keep roles simple: `owner`, `adult_member`, `viewer`.
- Do not introduce enterprise RBAC.

### `PUT /workspace`

Updates workspace basics.

Request:

```json
{
  "name": "Our home"
}
```

Response: `Workspace`.

Required logic:

- Allow only users with `manageWorkspace`.
- Validate name length.
- Update `updatedAt`.

### `POST /workspace/invitations`

Invites an adult member or partner.

Request:

```json
{
  "email": "partner@example.com",
  "displayName": "Alex",
  "role": "adult_member"
}
```

Response:

```json
{
  "userId": "invited_user_or_pending_id",
  "displayName": "Alex",
  "email": "partner@example.com",
  "role": "adult_member",
  "status": "invited"
}
```

Required logic:

- Allow only `owner` or users with `inviteMembers`.
- Do not invite child participants as login users in the MVP.
- Send invitation email or create a pending invite record.
- Prevent duplicate active invitations.

### `PUT /workspace/members/:userId`

Updates a member role or status.

Request:

```json
{
  "role": "adult_member",
  "status": "active"
}
```

Response: `WorkspaceMember`.

Required logic:

- Owner cannot remove themselves unless ownership transfer exists.
- Prevent removing the last owner.
- Keep role checks simple.

### `DELETE /workspace/members/:userId`

Removes a member from the workspace.

Response: `204 No Content`.

Required logic:

- Soft-remove member where possible.
- Do not delete meetings, tasks, or agreements they participated in.

## Participant Sync Endpoint

### `POST /participants/sync`

Syncs household participants used in meetings. Participants are not the same as workspace login users.

Request:

```json
{
  "participants": [
    {
      "id": "participant_123",
      "name": "Rita",
      "initials": "R",
      "avatarColor": "#7A8C6B",
      "type": "adult",
      "isActive": true,
      "createdAt": "2026-06-04T12:00:00.000Z",
      "updatedAt": "2026-06-04T12:10:00.000Z"
    }
  ],
  "clientUpdatedAt": "2026-06-04T12:10:00.000Z",
  "lastSyncedAt": "2026-06-04T12:00:00.000Z"
}
```

Response:

```json
{
  "participants": [],
  "conflicts": [],
  "syncedAt": "2026-06-04T12:11:00.000Z"
}
```

Required logic:

- Scope all participants to the active workspace.
- Validate names, initials, colors, type, and active status.
- Preserve inactive participants for historical meetings.
- Use deterministic conflict handling based on `updatedAt` and server revision if added.
- Never delete server data because one client sends an empty list.

## Meeting Endpoints

### `GET /meetings`

Returns synced meetings for the active workspace.

Response:

```json
{
  "meetings": [],
  "activeMeetingId": null,
  "draftSavedAt": null,
  "syncedAt": "2026-06-04T12:00:00.000Z"
}
```

Required logic:

- Scope meetings to the user's active workspace.
- Free plan should return only allowed history where the product requires it, currently the latest 3 completed meetings plus any active draft.
- Premium can return full history.
- Include incomplete and active meetings needed to continue the weekly ritual.
- Do not include private notes.

### `POST /meetings/sync`

Pushes local meeting changes and returns the server's merged state.

Request:

```json
{
  "meetings": [],
  "activeMeetingId": "meeting_123",
  "draftSavedAt": "2026-06-04T12:10:00.000Z",
  "lastSyncedAt": "2026-06-04T12:00:00.000Z",
  "clientUpdatedAt": "2026-06-04T12:10:00.000Z"
}
```

Response:

```json
{
  "meetings": [],
  "activeMeetingId": "meeting_123",
  "draftSavedAt": "2026-06-04T12:10:00.000Z",
  "conflicts": [],
  "syncedAt": "2026-06-04T12:11:00.000Z"
}
```

Required logic:

- Upsert meetings by ID within the active workspace.
- Persist sections, notes, meeting-created tasks, and section agreements.
- Maintain `serverRevision` per meeting.
- Respect soft deletes via `deletedAt` if deletion is added.
- Validate participant IDs against workspace participants.
- Validate template IDs against supported template IDs.
- Never silently discard local user content.
- Return conflicts instead of overwriting when both server and client changed the same meeting since `lastSyncedAt`.
- Keep AI summaries attached to the meeting only when generated or explicitly saved.

### `PUT /meetings/:id/summary`

Saves an AI summary or generated summary for a meeting.

Request:

```json
{
  "summary": {
    "id": "meeting-summary_123",
    "meetingId": "meeting_123",
    "shortSummary": "You reviewed the week and agreed on two next steps.",
    "mainTopics": ["Tasks", "Plans"],
    "keyTensions": [],
    "agreements": [],
    "tasks": [],
    "suggestedNextMeetingFocus": [],
    "createdAt": "2026-06-04T12:20:00.000Z"
  }
}
```

Response: `MeetingDto`.

Required logic:

- Require the meeting to belong to the active workspace.
- Require Premium if the summary came from AI generation.
- Store the summary separately or embedded, but return it in the `MeetingDto`.
- Do not store private notes in meeting summaries.

## Task and Agreement Endpoints

### `GET /tasks`

Returns tasks, agreements, and review decisions for the active workspace.

Response:

```json
{
  "tasks": [],
  "agreements": [],
  "reviewDecisions": [],
  "conflicts": [],
  "syncedAt": "2026-06-04T12:00:00.000Z"
}
```

Required logic:

- Scope all records to the active workspace.
- Return open tasks first if backend ordering is applied.
- Avoid harsh server-provided labels like `overdue`.
- Free and Premium users can create tasks and agreements.
- Do not include private notes.

### `POST /tasks/sync`

Pushes local task, agreement, and review decision changes and returns merged state.

Request:

```json
{
  "tasks": [],
  "agreements": [],
  "reviewDecisions": [
    {
      "meetingId": "meeting_456",
      "sourceMeetingId": "meeting_123",
      "decidedAt": "2026-06-04T12:15:00.000Z"
    }
  ],
  "lastSyncedAt": "2026-06-04T12:00:00.000Z",
  "clientUpdatedAt": "2026-06-04T12:15:00.000Z"
}
```

Response:

```json
{
  "tasks": [],
  "agreements": [],
  "reviewDecisions": [],
  "conflicts": [],
  "syncedAt": "2026-06-04T12:16:00.000Z"
}
```

Required logic:

- Upsert tasks and agreements by ID.
- Validate `sourceMeetingId` belongs to the workspace when present.
- Validate responsible participant IDs.
- Maintain `serverRevision` per task and agreement.
- Treat `done`, `open`, and `skipped` as neutral states.
- Preserve review decisions so unfinished follow-ups are not repeatedly presented after users decide they are no longer relevant.
- Return conflicts for concurrent edits.

## Subscription and Entitlement Endpoints

The frontend must not be the source of truth for paid access. Premium must come from a trusted entitlement provider or backend validation.

### `GET /subscriptions/status`

Returns the user's effective plan and enabled features.

Response:

```json
{
  "planType": "free",
  "provider": "google_play",
  "enabledFeatures": [
    "basicMeetings",
    "defaultTemplate",
    "tasksAndAgreements",
    "manualResponsibility",
    "limitedHistory"
  ],
  "expiresAt": null,
  "checkedAt": "2026-06-04T12:00:00.000Z"
}
```

Required logic:

- Validate entitlement server-side.
- Return free features when no valid entitlement exists.
- Cache provider checks carefully, but do not keep stale Premium forever.
- Include only feature keys the frontend understands.

Free feature keys:

- `basicMeetings`
- `defaultTemplate`
- `tasksAndAgreements`
- `manualResponsibility`
- `limitedHistory`

Premium feature keys:

- `localReminders`
- `unlimitedHistory`
- `aiSummary`
- `agreementReminders`
- `additionalTemplates`
- `privateNotes`
- `googleCalendarSync`
- `export`
- `advancedStatistics`

### `POST /subscriptions/validate`

Validates a mobile store purchase.

Request:

```json
{
  "provider": "google_play",
  "purchaseToken": "store-purchase-token",
  "productId": "weekly_us_premium_monthly"
}
```

Response: `SubscriptionStatusDto`.

Required logic:

- Validate purchase with Google Play Billing or a trusted provider such as RevenueCat.
- Bind valid entitlements to the authenticated workspace according to the chosen billing model.
- Reject fake or replayed purchase tokens.
- Store provider transaction IDs and entitlement expiry.
- Do not collect card details manually.

### `POST /subscriptions/restore`

Restores purchases for the authenticated user.

Request:

```json
{
  "provider": "google_play"
}
```

Response: `SubscriptionStatusDto`.

Required logic:

- Re-check provider entitlements.
- Return free plan when no entitlement is found.
- Use calm copy on the frontend for no purchase found.

### `GET /subscriptions/manage`

Returns a provider-specific manage subscription URL or deep link.

Response:

```json
{
  "url": "https://play.google.com/store/account/subscriptions"
}
```

Required logic:

- Return only safe provider URLs.
- Do not expose internal provider credentials.

## AI Summary Endpoint

### `POST /ai/meeting-summary`

Generates a Premium-gated meeting summary through the backend. The mobile app must never call an AI provider directly.

Request:

```json
{
  "meetingId": "meeting_123",
  "locale": "en"
}
```

Response:

```json
{
  "summary": {
    "id": "meeting-summary_123",
    "meetingId": "meeting_123",
    "shortSummary": "You reviewed the week and agreed on two next steps.",
    "mainTopics": [],
    "keyTensions": [],
    "agreements": [],
    "tasks": [],
    "suggestedNextMeetingFocus": [],
    "createdAt": "2026-06-04T12:20:00.000Z"
  },
  "disclaimer": "AI summaries may be inaccurate. Review before relying on them.",
  "generatedAt": "2026-06-04T12:20:00.000Z"
}
```

Required logic:

- Require authentication.
- Require Premium entitlement server-side.
- Verify the meeting belongs to the active workspace.
- Do not include private notes.
- Keep output neutral, short, practical, and non-judgmental.
- Do not diagnose users, provide therapy, assign blame, or make psychological claims.
- Enforce response shape before returning to the app.
- Apply rate limits per user/workspace.
- Store AI provider keys only on the backend.
- Avoid logging sensitive family text unnecessarily.
- Return the disclaimer exactly or equivalently in the selected locale.

## Google Calendar Endpoints

Google Calendar sync is Premium and should be included only if backend-supported OAuth and secure token storage are ready. The mobile app must not store Google access or refresh tokens.

### `GET /calendar/google/status`

Returns Google Calendar connection status.

Response:

```json
{
  "provider": "google",
  "state": "disconnected",
  "connected": false,
  "connectedAccountEmail": null,
  "lastCheckedAt": "2026-06-04T12:00:00.000Z",
  "message": "Google Calendar is not connected."
}
```

Required logic:

- Require Premium.
- Check backend token presence and validity.
- Return `setup_required` when OAuth is configured incorrectly or consent is incomplete.

### `POST /calendar/google/connect`

Starts or completes a backend-supported OAuth connection.

Request:

```json
{
  "redirectUrl": "weeklyus://calendar/google/callback"
}
```

Response options:

```json
{
  "provider": "google",
  "state": "setup_required",
  "connected": false,
  "lastCheckedAt": "2026-06-04T12:00:00.000Z",
  "message": "Open Google to finish connecting Calendar.",
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth..."
}
```

or `CalendarConnectionStatus` after callback completion.

Required logic:

- Require Premium.
- Use backend OAuth client secrets only.
- Store Google tokens securely on the backend.
- Request only the minimum calendar scopes needed.
- Support Android deep link callback or a backend callback flow.

### `POST /calendar/google/disconnect`

Disconnects Google Calendar.

Response: `CalendarConnectionStatus`.

Required logic:

- Revoke provider tokens where possible.
- Delete stored Google tokens.
- Keep existing Weekly Us meetings and tasks.

### `POST /calendar/google/meeting-reminders`

Creates or updates a calendar reminder for a weekly meeting.

Request:

```json
{
  "meetingId": "meeting_123",
  "title": "Weekly check-in",
  "startsAt": "2026-06-07T18:00:00.000Z"
}
```

Response:

```json
{
  "provider": "google",
  "synced": true,
  "attemptedAt": "2026-06-04T12:00:00.000Z",
  "skippedReason": "not-connected",
  "message": "Calendar reminder updated."
}
```

Required logic:

- Require Premium and connected Google Calendar.
- Validate meeting ownership.
- If `startsAt` is missing, return `synced: false` with `skippedReason: "missing-calendar-date"`.
- Store provider event ID for future updates.

### `POST /calendar/google/task-due-dates`

Creates or updates a calendar entry for a task due date.

Request:

```json
{
  "taskId": "task_123",
  "title": "Buy kindergarten shoes",
  "dueDate": "2026-06-07"
}
```

Response: `CalendarSyncResult`.

Required logic:

- Require Premium and connected Google Calendar.
- Validate task ownership.
- If `dueDate` is missing, return `synced: false` with `skippedReason: "missing-calendar-date"`.
- Use neutral calendar titles.

### `POST /calendar/google/follow-up-dates`

Creates or updates a calendar entry for an agreement or follow-up date.

Request:

```json
{
  "followUpId": "agreement_123",
  "title": "Review unfinished agreement",
  "followUpDate": "2026-06-14",
  "sourceMeetingId": "meeting_123"
}
```

Response: `CalendarSyncResult`.

Required logic:

- Require Premium and connected Google Calendar.
- Validate source meeting or agreement ownership.
- If `followUpDate` is missing, return `synced: false` with `skippedReason: "missing-calendar-date"`.

## Export Endpoints

The current app can create simple exports locally. A backend is optional unless export history, server-generated files, or account-level downloads are required.

If backend export is added, use simple text or Markdown first.

### `POST /exports/meeting`

Creates an export for a meeting.

Request:

```json
{
  "meetingId": "meeting_123",
  "format": "markdown",
  "includeAiSummary": true,
  "includePrivateNotes": false
}
```

Response:

```json
{
  "filename": "weekly-us-meeting-2026-06-04.md",
  "contentType": "text/markdown",
  "content": "# Weekly Us meeting..."
}
```

Required logic:

- Require Premium if export remains a Premium feature.
- Validate meeting ownership.
- Exclude private notes by default.
- Include private notes only if a future approved design explicitly permits it.
- Do not add heavy PDF generation until approved.

## Private Notes

Private notes are currently local-only.

No backend endpoint should be implemented for private notes unless the product explicitly changes the privacy model.

Required current behavior:

- Do not sync private notes.
- Do not include private notes in AI summary requests.
- Do not include private notes in exports by default.
- Do not claim encryption unless implemented.
- Keep this user-facing notice where relevant: "Private notes are stored on this device in the current MVP."

If backend private notes are requested later, create a separate security review before adding endpoints.

## Reminders and Notifications

Local reminders currently use Capacitor Local Notifications and should remain local unless the product adds server push notifications.

No backend endpoint is required for local reminders.

Required current behavior:

- Ask notification permission at the right moment.
- Handle denied permission gracefully.
- Keep reminders gentle.
- Do not use wording like `overdue`.

If server push reminders are added later, they need a separate device-token API, opt-in model, and privacy review.

## Sync Rules

The backend should support offline-first mobile usage.

Required sync behavior:

- Local writes must remain usable while offline.
- Server sync must not delete local data just because a client sends an empty array.
- Every synced resource should have `updatedAt`; server-managed `serverRevision` is recommended.
- Soft delete with `deletedAt` is safer than hard delete.
- Conflict handling must be deterministic.
- Failed sync must return a user-safe error and must not cause local data loss.
- Schema versioning or API versioning must exist before real users create data.

Recommended conflict logic:

- If only the client changed since `lastSyncedAt`, accept the client update.
- If only the server changed since `lastSyncedAt`, return the server update.
- If both changed different records, merge by record.
- If both changed the same record, keep both versions safe and return the client-visible conflict in `conflicts`.
- Prefer preserving text content over aggressive automatic overwrite.

## Access Rules

Server-side access checks are required for:

- workspace membership;
- role permissions;
- Premium entitlement;
- AI summary generation;
- Google Calendar sync;
- export if Premium-gated;
- full meeting history if Premium-gated.

Do not rely only on frontend feature locks. The frontend can hide or lock features, but the backend must enforce access.

Free users can:

- create basic weekly meetings;
- use the default meeting template;
- create tasks and agreements;
- assign responsibility;
- view limited meeting history, currently the latest 3 completed meetings.

Premium users can access:

- unlimited meeting history;
- AI summaries;
- reminders;
- extra templates;
- private notes, local-only in current MVP;
- Google Calendar sync;
- export.

## Security and Privacy Requirements

Required backend safeguards:

- Never expose secrets to the mobile app.
- Store password hashes, not passwords.
- Store Google tokens only on the backend.
- Validate store purchase tokens server-side.
- Keep AI provider keys on the backend.
- Do not log raw meeting notes, private notes, AI prompts, tokens, receipts, or OAuth tokens.
- Scope every resource by workspace and authenticated user.
- Return safe user-facing errors.
- Provide account deletion and data deletion behavior before production release.
- Update Privacy Policy, Terms, and Google Play Data Safety answers to match final behavior.

## Implementation Order

Recommended backend build order:

1. Add API versioning, auth/session model, and standard error responses.
2. Implement register, sign-in, refresh, sign-out, and current user.
3. Implement workspace and participant sync.
4. Implement meetings sync.
5. Implement tasks, agreements, and review decision sync.
6. Add subscription status and trusted purchase validation.
7. Add server-side Premium enforcement for full history and locked features.
8. Add backend AI summary generation.
9. Decide whether Google Calendar sync is in the MVP. If yes, implement backend OAuth safely.
10. Add export endpoint only if local export is not enough.
11. Add contract tests for every endpoint and mobile failure-mode tests for `401`, `403`, `409`, `422`, `429`, and backend unavailable.

## Minimum Endpoint Checklist

P0 API-backed MVP:

- `POST /auth/register`
- `POST /auth/sign-in`
- `POST /auth/refresh`
- `POST /auth/sign-out`
- `GET /auth/me`
- `GET /workspace`
- `PUT /workspace`
- `POST /participants/sync`
- `GET /meetings`
- `POST /meetings/sync`
- `PUT /meetings/:id/summary`
- `GET /tasks`
- `POST /tasks/sync`
- `GET /subscriptions/status`
- `POST /subscriptions/validate`
- `POST /ai/meeting-summary`

P1 if user-facing account recovery and multi-member workspace are included:

- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`
- `POST /workspace/invitations`
- `PUT /workspace/members/:userId`
- `DELETE /workspace/members/:userId`
- `POST /subscriptions/restore`
- `GET /subscriptions/manage`

P2 optional integrations:

- `GET /calendar/google/status`
- `POST /calendar/google/connect`
- `POST /calendar/google/disconnect`
- `POST /calendar/google/meeting-reminders`
- `POST /calendar/google/task-due-dates`
- `POST /calendar/google/follow-up-dates`
- `POST /exports/meeting`
