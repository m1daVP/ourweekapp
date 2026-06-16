# Weekly Us Backend Implementation Spec

Last updated: 2026-06-04

This document describes the recommended backend implementation for the API-backed Weekly Us MVP. It complements `API_ENDPOINTS_AND_BACKEND_LOGIC.md`, which defines endpoint contracts and required server behavior.

## Backend Stack Decision

Recommended stack:

- Runtime: Node.js LTS
- Framework: Fastify with TypeScript
- Database platform: Supabase
- Database: Supabase Postgres
- Database access: Supabase server client or a typed SQL/query layer behind repository modules
- Validation: Zod
- Auth: backend-issued access and refresh tokens
- Password hashing: Argon2id
- AI provider access: backend only
- Billing entitlement validation: RevenueCat webhook/API
- Calendar OAuth: backend-owned Google OAuth client
- Deployment: containerized service behind HTTPS

Decision rationale:

- Fastify keeps the API small, fast, and explicit for the MVP.
- Supabase provides managed Postgres and operational basics without requiring the app to build infrastructure from scratch.
- TypeScript keeps backend DTOs close to the Vue frontend contract.
- Supabase Postgres is a good fit for household data, sync metadata, soft deletes, and future audit fields.
- Zod keeps validation close to DTO definitions and can support OpenAPI generation.
- Backend-owned integrations prevent secrets from entering the mobile app.

Use one backend service for the MVP. Do not split into microservices.

The mobile app should call the Fastify API only. It should not call Supabase tables directly, and Supabase service-role keys must never be shipped in the mobile app.

## Database Schema

Use UUID primary keys, `created_at`, `updated_at`, and soft-delete fields where user data may need recovery or sync conflict handling.

### `users`

Stores login identity.

Columns:

- `id uuid primary key`
- `email text unique not null`
- `email_normalized text unique not null`
- `display_name text`
- `password_hash text not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz`

### `sessions`

Stores refresh sessions.

Columns:

- `id uuid primary key`
- `user_id uuid not null references users(id)`
- `refresh_token_hash text not null`
- `device_label text`
- `created_at timestamptz not null`
- `expires_at timestamptz not null`
- `revoked_at timestamptz`
- `last_used_at timestamptz`

### `workspaces`

Stores a household workspace.

Columns:

- `id uuid primary key`
- `name text not null`
- `owner_id uuid not null references users(id)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz`

### `workspace_members`

Stores workspace membership and simple roles.

Columns:

- `workspace_id uuid not null references workspaces(id)`
- `user_id uuid not null references users(id)`
- `display_name text not null`
- `email text`
- `role text not null check role in ('owner', 'adult_member', 'viewer')`
- `status text not null check status in ('active', 'invited', 'removed')`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- primary key: `(workspace_id, user_id)`

### `workspace_invitations`

Stores pending invitations.

Columns:

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `email text not null`
- `display_name text`
- `role text not null`
- `token_hash text not null`
- `status text not null check status in ('pending', 'accepted', 'expired', 'revoked')`
- `created_at timestamptz not null`
- `expires_at timestamptz not null`

### `participants`

Stores household participants used in meetings. These are not always login users.

Columns:

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `name text not null`
- `initials text not null`
- `avatar_color text not null`
- `type text not null check type in ('adult', 'child', 'other')`
- `is_active boolean not null default true`
- `server_revision integer not null default 1`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz`

### `meetings`

Stores guided meeting state.

Columns:

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `template_id text not null`
- `title text not null`
- `status text not null check status in ('draft', 'in_progress', 'paused', 'incomplete', 'completed')`
- `participant_ids jsonb not null`
- `sections jsonb not null`
- `current_section_index integer not null default 0`
- `ai_summary jsonb`
- `server_revision integer not null default 1`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `completed_at timestamptz`
- `deleted_at timestamptz`

Note: storing `sections` as JSONB is acceptable for the MVP because sections, notes, in-meeting tasks, and in-meeting agreements are edited as one guided flow. If analytics or complex querying becomes important later, split sections/notes into normalized tables.

### `tasks`

Stores cross-meeting tasks.

Columns:

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `title text not null`
- `description text`
- `responsibility_type text not null check responsibility_type in ('participant', 'shared', 'needsDiscussion')`
- `responsible_participant_ids jsonb not null`
- `due_date date`
- `status text not null check status in ('open', 'done', 'skipped')`
- `source_meeting_id uuid references meetings(id)`
- `server_revision integer not null default 1`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz`

### `agreements`

Stores cross-meeting agreements.

Columns:

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `title text not null`
- `description text`
- `participant_ids jsonb not null`
- `related_task_ids jsonb`
- `source_meeting_id uuid not null references meetings(id)`
- `server_revision integer not null default 1`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz`

### `task_review_decisions`

Stores decisions to stop carrying an old task/agreement into the next meeting review.

Columns:

- `workspace_id uuid not null references workspaces(id)`
- `meeting_id uuid not null references meetings(id)`
- `source_meeting_id uuid not null references meetings(id)`
- `decided_at timestamptz not null`
- primary key: `(workspace_id, meeting_id, source_meeting_id)`

### `subscriptions`

Stores effective entitlement state.

Columns:

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `provider text not null check provider in ('google_play', 'app_store', 'revenuecat')`
- `provider_customer_id text`
- `provider_entitlement_id text`
- `plan_type text not null check plan_type in ('free', 'premium')`
- `status text not null`
- `expires_at timestamptz`
- `last_checked_at timestamptz not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `calendar_connections`

Stores backend-owned Google Calendar tokens.

Columns:

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `user_id uuid not null references users(id)`
- `provider text not null check provider = 'google'`
- `connected_account_email text`
- `access_token_encrypted text`
- `refresh_token_encrypted text`
- `token_expires_at timestamptz`
- `state text not null check state in ('disconnected', 'connected', 'setup_required')`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `disconnected_at timestamptz`

### `calendar_events`

Tracks provider event IDs for updates.

Columns:

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `provider text not null check provider = 'google'`
- `source_type text not null check source_type in ('meeting_reminder', 'task_due_date', 'follow_up_date')`
- `source_id text not null`
- `provider_event_id text not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `ai_summary_requests`

Optional privacy-conscious metadata for rate limiting and support. Do not store raw meeting text unless explicitly approved.

Columns:

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `user_id uuid not null references users(id)`
- `meeting_id uuid not null references meetings(id)`
- `provider text not null`
- `status text not null`
- `input_hash text`
- `created_at timestamptz not null`
- `completed_at timestamptz`
- `error_code text`

## Migration strategy

- migration tool: Supabase migrations
- migrations must be committed
- migrations must run in CI/staging before production
- rollback policy for destructive changes

## Auth and Session Model

Access token:

- Short-lived JWT or opaque token.
- Recommended lifetime: 15 to 60 minutes.
- Contains only minimal claims: `sub`, `sessionId`, `workspaceId`, `role`, `iat`, `exp`.
- Do not include sensitive household data.

Refresh token:

- Random high-entropy token.
- Store only a hash in `sessions`.
- Recommended lifetime: 30 to 90 days for MVP.
- Rotate on refresh if supported.
- Revoke on sign-out, password reset, account deletion, and suspicious reuse.

Password model:

- Hash passwords with Argon2id.
- Enforce minimum password length and breached-password checks if feasible.
- Rate limit sign-in and password reset.
- Use generic auth failure messages.

Mobile storage:

- The app should store real tokens in native secure storage before production.
- Do not store real tokens in plain localStorage for production API-backed builds.

Authorization:

- Every protected request resolves the active user, active workspace, member role, and effective plan.
- Every query must be scoped by `workspace_id`.
- Owner cannot remove themselves if they are the last owner.

## Workspace Premium Model

Premium should apply to the household workspace, not only one local device.

Recommended model:

- One workspace has one effective plan.
- The owner manages the subscription.
- Adult members can use Premium workspace features when the workspace has a valid entitlement.
- `viewer` can only access limited views if the product enables viewer support.
- Child participants are not billing users and do not log in.

Server-side Premium checks are required for:

- unlimited meeting history;
- AI summaries;
- Google Calendar sync;
- export if Premium-gated;
- future cloud private notes, if ever approved.

Local reminders and private notes are Premium in the current feature model, but they remain local-device features unless backend behavior is explicitly added.

Subscription source of truth:

- Use RevenueCat or Google Play Billing validation.
- Never trust frontend persisted Premium state.
- Cache entitlement status, but refresh regularly and on app start.
- Return free features when entitlement cannot be verified after a reasonable grace policy.

## Sync Conflict DTO

Use a structured conflict DTO instead of returning raw mixed records only.

```ts
type SyncResourceType = 'participant' | 'meeting' | 'task' | 'agreement';
type SyncConflictReason =
  | 'updated_on_client_and_server'
  | 'deleted_on_server_updated_on_client'
  | 'deleted_on_client_updated_on_server'
  | 'invalid_reference';

interface SyncConflictDto<T> {
  resourceType: SyncResourceType;
  resourceId: string;
  reason: SyncConflictReason;
  clientVersion?: T;
  serverVersion?: T;
  baseServerRevision?: number;
  serverRevision?: number;
  detectedAt: string;
}
```

Endpoint responses should use typed conflicts:

```ts
interface SyncMeetingsResponseDto {
  meetings: MeetingDto[];
  activeMeetingId: string | null;
  draftSavedAt: string | null;
  conflicts: SyncConflictDto<MeetingDto>[];
  syncedAt: string;
}

interface SyncTasksResponseDto {
  tasks: TaskDto[];
  agreements: AgreementDto[];
  reviewDecisions: TaskReviewDecision[];
  conflicts: Array<SyncConflictDto<TaskDto> | SyncConflictDto<AgreementDto>>;
  syncedAt: string;
}
```

Conflict rules:

- Preserve user text.
- Prefer field-level merges only for clearly independent fields.
- Return conflicts for same-record concurrent edits.
- Do not delete server records just because a client sends a missing item.
- Increment `serverRevision` on every accepted server update.

## Validation Limits

Use server validation even if the frontend already validates.

All request body, query string, route parameter, and response DTO validation should be defined with Zod schemas. Reuse those schemas for OpenAPI generation where practical.

Recommended MVP limits:

- Email: max 254 characters.
- Display name: 1 to 80 characters.
- Workspace name: 1 to 80 characters.
- Participant name: 1 to 60 characters.
- Participant initials: 1 to 4 characters.
- Task title: 1 to 140 characters.
- Task description: max 1,000 characters.
- Agreement title: 1 to 140 characters.
- Agreement description: max 1,000 characters.
- Meeting title: 1 to 120 characters.
- Meeting note text: max 2,000 characters.
- Meeting sections per meeting: max 20.
- Notes per meeting section: max 50.
- Tasks per meeting section: max 50.
- Agreements per meeting section: max 50.
- Participants per workspace: max 20 for MVP.
- Meetings per sync request: max 100.
- Tasks per sync request: max 300.
- Agreements per sync request: max 300.
- Request body size: max 1 MB for normal API requests.
- AI summary input: reject or summarize down if meeting content exceeds provider-safe limits.

Validation rules:

- Trim user text.
- Reject empty text after trimming.
- Reject invalid enum values.
- Validate participant IDs belong to the workspace.
- Validate source meeting IDs belong to the workspace.
- Validate dates are valid ISO dates or timestamps.
- Avoid returning raw technical validation internals.

## OpenAPI Generation Requirement

The Fastify backend must generate an OpenAPI 3.1 document from the implemented route and Zod DTO definitions.

Required output:

- `openapi.json`
- `openapi.yaml` if useful for backend tooling
- Swagger UI or Redoc available in non-production environments

Requirements:

- Every endpoint in `API_ENDPOINTS_AND_BACKEND_LOGIC.md` must be represented.
- Request and response schemas must be explicit.
- Error response schema must be shared.
- Auth requirements must be shown per endpoint.
- Feature-gated endpoints should document `403` behavior.
- Zod schemas should be the source of truth for request and response schemas.
- Generated docs should be part of CI.
- Contract drift between backend DTOs and OpenAPI output should fail CI.

Recommended frontend workflow:

- Generate TypeScript API types from OpenAPI after backend stabilizes.
- Compare generated types with existing frontend DTOs before replacing them.
- Do not introduce generated client churn until the backend contract is stable.

## Account Deletion and Data Export

Production API-backed builds need account deletion and data export paths before public release.

### Account Deletion

Required endpoint:

```txt
DELETE /account
```

Required behavior:

- Authenticate the user.
- Confirm destructive intent in the frontend before calling.
- Revoke all user sessions.
- Remove or anonymize the user's profile.
- If the user is the only workspace owner, soft-delete the workspace and its synced data.
- If other active adult members remain, require ownership transfer or block deletion until transfer is complete.
- Disconnect Google Calendar and revoke tokens.
- Cancel or unlink subscription entitlement according to provider limitations.
- Keep records needed for legal, billing, fraud, or abuse obligations only as long as required.

### Data Export

Required endpoint:

```txt
GET /account/export
```

Response options:

- JSON export for complete account/workspace data.
- Markdown/text export for readable meeting history if product-approved.

Required behavior:

- Include user profile, workspace, participants, meetings, tasks, agreements, and subscription metadata.
- Exclude private notes unless the product later syncs them and the user explicitly requests them.
- Exclude secrets, token hashes, provider tokens, password hashes, and internal logs.
- Make export available only to authorized users.

## Logging Policy

Logging must be privacy-conscious because meetings may contain sensitive household information.

Do log:

- request ID;
- endpoint;
- status code;
- authenticated user ID;
- workspace ID;
- duration;
- safe error code;
- provider operation status without raw provider payloads;
- sync counts and conflict counts.

Do not log:

- passwords;
- access or refresh tokens;
- password reset tokens;
- Google OAuth tokens;
- purchase tokens;
- raw meeting notes;
- private notes;
- AI prompt text;
- AI output text unless explicitly approved for debugging in a protected non-production environment;
- exported document content.

Operational requirements:

- Use structured JSON logs.
- Add a request ID to every response.
- Keep production log retention limited.
- Redact known sensitive fields automatically.
- Separate debug logs from production logs.
- Ensure support diagnostics do not expose family content.

## Deployment and Environment Variables

Recommended deployment:

- Containerized Fastify Node.js service.
- Supabase managed Postgres database.
- HTTPS behind a managed load balancer or platform gateway.
- Separate environments: local, staging, production.
- Run migrations during deploy with a controlled migration step.

Required environment variables:

```txt
NODE_ENV=production
APP_ENV=production
PORT=3000
PUBLIC_API_BASE_URL=https://api.weeklyus.example/v1
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
ACCESS_TOKEN_SECRET=...
REFRESH_TOKEN_SECRET=...
PASSWORD_RESET_TOKEN_SECRET=...
TOKEN_ENCRYPTION_KEY=...
CORS_ALLOWED_ORIGINS=capacitor://localhost,http://localhost:5173
AI_PROVIDER=
AI_API_KEY=
AI_MODEL=
REVENUECAT_API_KEY=
GOOGLE_PLAY_PACKAGE_NAME=com.weeklyus.app
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URL=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=
LOG_LEVEL=info
SENTRY_DSN=
```

Rules:

- Never expose backend secrets through Vite variables.
- Never commit real `.env` files.
- Rotate secrets when a leak is suspected.
- Keep staging and production secrets separate.
- Limit CORS to known origins and mobile callback requirements.
- Configure database backups before real users.

Frontend production variables:

```txt
VITE_API_BASE_URL=https://api.weeklyus.example/v1
VITE_API_MODE=backend
VITE_APP_ENV=production
```

## Test Checklist

### Auth

- Register creates user, workspace, owner membership, and session.
- Duplicate email is rejected safely.
- Sign-in works with valid credentials.
- Sign-in failure does not reveal whether an account exists.
- Refresh returns a valid new session.
- Revoked refresh token cannot be reused.
- Sign-out revokes the current session.
- Password reset request is rate limited and generic.

### Authorization

- Users cannot access another workspace's data.
- Adult member permissions match MVP rules.
- Viewer cannot mutate data if viewer support is enabled.
- Last owner cannot be removed.
- Deleted users cannot authenticate.

### Sync

- Meetings sync creates, updates, and returns server revisions.
- Tasks sync creates and updates tasks and agreements.
- Empty sync payload does not delete server data.
- Soft-deleted records are handled consistently.
- Same-record concurrent edits return `SyncConflictDto`.
- Failed sync does not lose local data.
- Invalid participant or meeting references return safe validation errors.

### Premium

- Free users receive only free feature keys.
- Premium entitlement unlocks Premium feature keys.
- Expired entitlement returns free plan or documented grace state.
- AI summary endpoint returns `403` for free users.
- Calendar sync returns `403` for free users.
- Full history limits are enforced server-side.

### AI

- AI provider key is never exposed to the mobile app.
- AI summary validates meeting ownership.
- AI output matches required `MeetingSummary` shape.
- Private notes are not included.
- Rate limits return `429`.
- Provider failure returns a safe user-facing error.

### Calendar

- Status returns disconnected before OAuth.
- Connect flow does not expose Google tokens to the app.
- Disconnect revokes and removes stored tokens.
- Missing dates return `synced: false` with `missing-calendar-date`.
- Event updates reuse provider event IDs.

### Account Operations

- Account export excludes secrets and private notes.
- Account deletion revokes sessions.
- Account deletion handles last-owner workspace deletion safely.
- Google Calendar tokens are revoked on account deletion.

### OpenAPI

- OpenAPI output is generated in CI.
- Every implemented route appears in OpenAPI.
- Error schema is shared.
- Auth requirements are documented.
- Type generation does not drift from backend DTOs.

### Deployment

- Migration runs successfully on empty database.
- Migration runs safely on existing staging data.
- Health check returns service status without sensitive details.
- Production logs redact sensitive fields.
- Backend unavailable state is handled gracefully by the mobile app.
