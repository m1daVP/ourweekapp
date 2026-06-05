# Weekly Us Backend Implementation Plan

This plan is based on `API_ENDPOINTS_AND_BACKEND_LOGIC.md`, `BACKEND_IMPLEMENTATION_SPEC.md`, and the current Fastify/Supabase TypeScript scaffold.

The repository already has Fastify, Zod provider setup, Supabase plugin wiring, global middleware, `/health`, `/v1`, and placeholder auth, billing, calendar, and AI modules. Most business logic, DTO schemas, database migrations, repositories, auth middleware, sync logic, OpenAPI output, and tests still need implementation.

## 1. Normalize API Structure

- Keep `/v1` as the versioned base path.
- Add shared modules:
  - `src/shared/schemas`
  - `src/shared/errors`
  - `src/shared/auth`
  - `src/shared/repositories`
  - `src/shared/sync`
- Rename or alias current `/billing` routes to match the spec's `/subscriptions` contract.
- Add a standard error DTO:
  - `message`
  - `code`
  - `details`
- Add request ID handling and safe structured logging.

## 2. Environment And Configuration

- Update `src/config/env.ts` so optional integrations can be disabled locally.
- Add missing required variables from the implementation spec:
  - `DATABASE_URL`
  - `REFRESH_TOKEN_SECRET`, if needed
  - `PASSWORD_RESET_TOKEN_SECRET`
  - `TOKEN_ENCRYPTION_KEY`
  - SMTP settings
  - public API URL
- Make AI, RevenueCat, Google OAuth, and SMTP optional unless their endpoints are enabled.
- Keep backend secrets out of Vite variables and mobile builds.

## 3. Database Migrations

- Add Supabase migrations for:
  - `users`
  - `sessions`
  - `workspaces`
  - `workspace_members`
  - `workspace_invitations`
  - `participants`
  - `meetings`
  - `tasks`
  - `agreements`
  - `task_review_decisions`
  - `subscriptions`
  - `calendar_connections`
  - `calendar_events`
  - `ai_summary_requests`
- Add indexes for:
  - normalized email lookup
  - session lookup
  - workspace-scoped resources
  - `updated_at`
  - soft-delete filtering
- Add check constraints for all enum fields listed in the specs.
- Commit migrations and make them runnable in CI/staging before production.

## 4. DTO And Zod Schema Layer

- Define all API DTOs from the docs as Zod schemas:
  - auth user/session
  - workspace/member
  - participant
  - meeting
  - task
  - agreement
  - sync conflict
  - subscription status
  - AI summary
  - calendar status/result
- Centralize validation limits from `BACKEND_IMPLEMENTATION_SPEC.md`.
- Use schemas for route validation, response validation where practical, and OpenAPI generation.
- Avoid returning raw technical validation internals to the mobile app.

## 5. Repository Layer

- Add repository modules wrapping Supabase access:
  - `users.repository.ts`
  - `sessions.repository.ts`
  - `workspaces.repository.ts`
  - `participants.repository.ts`
  - `meetings.repository.ts`
  - `tasks.repository.ts`
  - `subscriptions.repository.ts`
  - `calendar.repository.ts`
  - `ai.repository.ts`
- Scope every workspace-owned query by `workspace_id`.
- Add mapping functions between database `snake_case` fields and API `camelCase` DTOs.
- Keep provider tokens, password hashes, and internal metadata out of API responses.

## 6. Auth Foundation

- Extend `src/modules/auth/token.service.ts`:
  - include `sub`, `sessionId`, `workspaceId`, `role`, `iat`, and `exp` claims
  - generate high-entropy refresh tokens
  - store only refresh token hashes
  - support refresh token rotation
- Add auth middleware:
  - parse `Authorization: Bearer <token>`
  - validate access token
  - load user, session, workspace membership, role, and effective plan
  - decorate Fastify request with authenticated context
- Keep access tokens short-lived and refresh tokens revocable.

## 7. Auth Endpoints

- Implement in `src/modules/auth/auth.routes.ts`:
  - `POST /auth/register`
  - `POST /auth/sign-in`
  - `POST /auth/refresh`
  - `POST /auth/sign-out`
  - `GET /auth/me`
- Then implement P1 recovery routes:
  - `POST /auth/password-reset/request`
  - `POST /auth/password-reset/confirm`
- Add rate limits for sign-in and password reset routes.
- Use Argon2id password hashing from `src/modules/auth/auth.service.ts`.
- Use safe generic auth failure messages that do not reveal whether an email exists.

## 8. Workspace And Member Endpoints

- Create `src/modules/workspace`.
- Register routes under `/v1/workspace`.
- Implement:
  - `GET /workspace`
  - `PUT /workspace`
- Then implement P1 member routes:
  - `POST /workspace/invitations`
  - `PUT /workspace/members/:userId`
  - `DELETE /workspace/members/:userId`
- Add permission helpers:
  - `manageWorkspace`
  - `inviteMembers`
  - last-owner protection
- Soft-remove members where possible and preserve historical meeting/task data.

## 9. Participant Sync

- Create `src/modules/participants`.
- Implement:
  - `POST /participants/sync`
- Validate participant limits, names, initials, colors, type, and active status.
- Scope all participants to the active workspace.
- Use `updatedAt` and `serverRevision`.
- Never delete server participants because the client sends an empty list.
- Return structured conflicts.

## 10. Meeting Sync

- Create `src/modules/meetings`.
- Implement:
  - `GET /meetings`
  - `POST /meetings/sync`
  - `PUT /meetings/:id/summary`
- Validate:
  - template IDs
  - participant IDs
  - section shape
  - timestamps
  - note/task/agreement limits inside sections
- Add free-plan history limiting:
  - latest 3 completed meetings plus active, incomplete, and draft meetings.
- Add deterministic conflict handling and `serverRevision` increments.
- Preserve user text and return conflicts instead of silently overwriting same-record concurrent edits.

## 11. Tasks, Agreements, And Review Decisions

- Create `src/modules/tasks`.
- Implement:
  - `GET /tasks`
  - `POST /tasks/sync`
- Validate:
  - responsible participant IDs
  - source meeting ownership
  - related task IDs
- Preserve review decisions so dismissed follow-ups are not repeatedly shown.
- Add conflict handling for tasks and agreements separately.
- Treat `open`, `done`, and `skipped` as neutral states.

## 12. Subscriptions And Entitlements

- Replace or adapt current `src/modules/billing` into `/subscriptions`.
- Implement:
  - `GET /subscriptions/status`
  - `POST /subscriptions/validate`
- Then implement P1 subscription routes:
  - `POST /subscriptions/restore`
  - `GET /subscriptions/manage`
- Integrate RevenueCat as the preferred source of truth.
- Store workspace-level entitlement.
- Add reusable `requirePremium` middleware.
- Return free features when no trusted entitlement exists.

## 13. Premium Enforcement

- Enforce server-side premium checks for:
  - full meeting history
  - AI summaries
  - Google Calendar sync
  - export if enabled
- Do not rely on frontend feature locks.
- Make the effective plan workspace-based so adult members can use Premium features when the household workspace has a valid entitlement.

## 14. AI Summary

- Complete `src/modules/ai`.
- Implement:
  - `POST /ai/meeting-summary`
- Requirements:
  - auth required
  - Premium required
  - meeting ownership required
  - private notes excluded
  - no raw meeting text in logs
  - AI output validated against `MeetingSummary`
  - summary stored on the meeting or in approved summary storage
  - disclaimer returned
  - rate limit per user/workspace
- Keep AI output neutral, short, practical, and non-judgmental.

## 15. Account Operations Before Production

- Add `src/modules/account`.
- Implement:
  - `DELETE /account`
  - `GET /account/export`
- These are required by the implementation spec before public production.
- Ensure export excludes:
  - secrets
  - hashes
  - provider tokens
  - private notes
  - internal logs
- On deletion, revoke sessions, handle workspace ownership safely, and revoke Google Calendar tokens where applicable.

## 16. Google Calendar P2

- Complete `src/modules/calendar`.
- Implement only when OAuth and secure token storage are ready:
  - `GET /calendar/google/status`
  - `POST /calendar/google/connect`
  - OAuth callback route if needed
  - `POST /calendar/google/disconnect`
  - `POST /calendar/google/meeting-reminders`
  - `POST /calendar/google/task-due-dates`
  - `POST /calendar/google/follow-up-dates`
- Encrypt Google tokens with `TOKEN_ENCRYPTION_KEY`.
- Store provider event IDs for updates.
- Return `setup_required` when OAuth is not configured or consent is incomplete.

## 17. Optional Export Endpoint

- Add only if backend export is needed beyond account export:
  - `POST /exports/meeting`
- Start with Markdown/text.
- Premium-gate if product keeps export Premium.
- Exclude private notes by default.
- Avoid PDF generation until explicitly approved.

## 18. OpenAPI

- Add OpenAPI generation from Fastify and Zod schemas.
- Generate:
  - `openapi.json`
  - optionally `openapi.yaml`
- Add Swagger UI or Redoc only outside production.
- Make CI fail on contract drift.
- Ensure every implemented route appears in OpenAPI with explicit auth and error behavior.

## 19. Testing

- Add Vitest contract and integration tests for:
  - auth/session lifecycle
  - workspace access
  - participant sync
  - meeting sync
  - task/agreement sync
  - subscription status
  - premium gating
  - AI failure modes
  - account export/deletion
- Explicitly test:
  - `401`
  - `403`
  - `409`
  - `422`
  - `429`
  - backend unavailable behavior where practical
- Add OpenAPI generation checks in CI.

## 20. Deployment Readiness

- Add Docker production checks.
- Add migration command and documentation.
- Add a health check that exposes no secrets.
- Add `.env.example` parity with required config.
- Confirm CORS allows only known mobile and local frontend origins.
- Add production logging redaction.
- Configure database backups before real users.

## Recommended Build Order

P0:

1. Auth
2. Workspace
3. Participant sync
4. Meeting sync
5. Tasks and agreements sync
6. Subscriptions
7. Premium checks
8. AI summary
9. OpenAPI and tests

P1:

1. Password reset
2. Invitations and member management
3. Subscription restore/manage
4. Account delete/export

P2:

1. Google Calendar
2. Meeting export

## First Concrete Implementation Step

Start with database migrations plus shared DTO, error, and auth context foundations. Every endpoint depends on those contracts, and they set the behavior for validation, access control, workspace scoping, sync conflicts, and OpenAPI generation.
