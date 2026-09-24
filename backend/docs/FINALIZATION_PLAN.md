# Finalization Plan

This plan lists the work that must be implemented, fixed, or verified before a real public launch.

Launch rule: no MVP feature may be disabled, hidden, or left as a placeholder. If an endpoint, mobile workflow, or documented MVP feature exists, it must work end-to-end in production. Removing a feature from launch scope requires an explicit product decision plus matching backend, mobile, OpenAPI, documentation, and legal/privacy updates.

## Current Readiness Snapshot

- TypeScript, tests, OpenAPI drift check, build, and `npm run ci` pass on the current working tree.
- The OpenAPI document exposes auth, account, workspace, participants, meetings, tasks, subscriptions, AI, calendar, and export routes.
- The repository has uncommitted and untracked launch-related changes. These must be reviewed and committed before release.
- `npm audit --audit-level=moderate` reports one high severity `esbuild` advisory through development tooling.
- Password reset exists as routes and schemas, but the service implementation is not functional yet.
- Supabase migrations create the expected tables and RPCs, but real local/staging migration execution and RLS posture still need launch proof.

## Phase 0: Stabilize The Release Baseline

- [ ] Review all current uncommitted changes and decide what belongs in the release.
- [ ] Commit or deliberately remove every modified/untracked file before final QA.
- [ ] Regenerate and commit `docs/openapi.json` after the final route/schema state is settled.
- [ ] Fix line-ending churn so release diffs stay reviewable.
- [ ] Add CI triggers for pull requests and pushes, not only manual `workflow_dispatch`.
- [ ] Keep `main` releasable. Use a release branch or PR for remaining work.

Definition of done:

- [ ] `git status --short` is clean before tagging or deploying.
- [ ] CI runs automatically on PR and protected branches.
- [ ] OpenAPI output matches implementation.

## Phase 1: Security And Account Recovery

- [ ] Implement real password reset request flow.
- [ ] Store only hashed reset tokens.
- [ ] Add reset token expiry and one-time-use semantics.
- [ ] Send reset email through configured SMTP or the chosen transactional email provider.
- [ ] Keep password reset request responses generic so account existence is not leaked.
- [ ] Implement password reset confirmation.
- [ ] Revoke existing sessions after password reset according to the final security policy.
- [ ] Add tests for successful reset, expired token, reused token, invalid token, rate limit, and session revocation.
- [ ] Add any required password reset database migration.

Definition of done:

- [ ] `POST /v1/auth/password-reset/request` sends a usable reset path without leaking account existence.
- [ ] `POST /v1/auth/password-reset/confirm` changes the password and returns `204`.
- [ ] Reset tokens cannot be reused and are never stored raw.

## Phase 2: Supabase And Database Hardening

- [ ] Decide and document the production Supabase access model.
- [ ] Enable RLS with deny-by-default policies where direct Supabase API access could exist.
- [ ] If direct Supabase table access is not allowed, verify anon/authenticated clients cannot read or mutate tables.
- [ ] Ensure service-role access remains backend-only.
- [ ] Run migrations against an empty local database.
- [ ] Run migrations against staging or production-like existing data.
- [ ] Run `npm run db:migrate:dry-run` against the target project before deployment.
- [ ] Verify all foreign keys, uniqueness constraints, and indexes support the real query paths.
- [ ] Verify the latest workspace member RPC fix is applied in every environment.
- [ ] Add migration rollback or forward-fix notes for risky migrations.

Definition of done:

- [ ] Empty-database migration succeeds.
- [ ] Existing-data migration succeeds in staging.
- [ ] RLS/direct-access posture is tested and documented.
- [ ] No table with private user data is accidentally exposed through Supabase APIs.

## Phase 3: Workspace Invitations And Membership

- [ ] Complete the invitation acceptance flow.
- [ ] Deliver invitations by email.
- [ ] Add an endpoint or approved flow for accepting an invitation token.
- [ ] Store invitation tokens only as hashes.
- [ ] Expire, revoke, and prevent duplicate pending invitations.
- [ ] Verify invited users join the correct workspace with the correct role.
- [ ] Verify owner-only and adult-member invitation permissions match the product rules.
- [ ] Verify last-owner protection for update and removal.

Definition of done:

- [ ] A real user can invite another adult member.
- [ ] The invited member can accept and sign in.
- [ ] Removed members cannot access workspace data.
- [ ] Historical meetings/tasks remain intact after member removal.

## Phase 4: Account Export And Deletion

- [ ] Verify account export includes all approved user/workspace data.
- [ ] Verify export excludes secrets, hashes, provider tokens, internal logs, and private notes.
- [ ] Add real Google token revocation during account deletion when Calendar is connected.
- [ ] Keep local token cleanup even if provider revocation fails.
- [ ] Confirm account deletion revokes sessions.
- [ ] Confirm account deletion handles sole-owner and multi-owner workspaces correctly.
- [ ] Confirm subscription unlink/cancel limitations are documented and match provider behavior.
- [ ] Add staging tests for account delete on realistic workspace data.

Definition of done:

- [ ] `GET /v1/account/export` produces a safe complete export.
- [ ] `DELETE /v1/account` removes or anonymizes account data according to policy.
- [ ] Calendar provider tokens are revoked or the residual limitation is explicitly documented and legally reviewed.

## Phase 5: Billing And Premium Entitlements

- [ ] Validate RevenueCat sandbox configuration end-to-end.
- [ ] Validate Google Play purchase token handling through RevenueCat.
- [ ] Add or explicitly justify the absence of RevenueCat webhook processing.
- [ ] If webhooks are added, verify signature validation and idempotency.
- [ ] Verify expired, grace-period, revoked, refunded, and missing entitlement states.
- [ ] Verify Premium is workspace-scoped.
- [ ] Verify only workspace owners can validate, restore, and manage subscriptions.
- [ ] Verify adult members can use Premium features when the workspace entitlement is valid.
- [ ] Verify stale cached Premium does not remain trusted past the configured window.

Definition of done:

- [ ] Real sandbox purchase validation returns Premium.
- [ ] Expired or invalid entitlement returns Free.
- [ ] AI, Calendar, full history, and export are server-gated by trusted Premium state.

## Phase 6: AI Summary

- [ ] Configure production OpenAI provider secrets only on the backend.
- [ ] Verify AI provider failures return safe errors.
- [ ] Verify malformed AI output is rejected before storing.
- [ ] Verify private notes are never included in AI prompts.
- [ ] Verify raw meeting text, prompts, and AI outputs are not logged in production.
- [ ] Verify per-user and per-workspace AI rate limits in staging.
- [ ] Verify generated summaries are neutral, short, practical, and non-judgmental.
- [ ] Verify the AI disclaimer appears in the mobile UX.

Definition of done:

- [ ] A Premium adult member can generate and store a summary for their own meeting.
- [ ] A Free user receives `403`.
- [ ] Cross-workspace and viewer access are blocked before provider calls.

## Phase 7: Google Calendar

- [ ] Configure Google OAuth credentials for staging and production.
- [ ] Verify redirect URLs and mobile deep links.
- [ ] Verify OAuth state signing and expiry in real browser/mobile flows.
- [ ] Verify token encryption and decryption with production `TOKEN_ENCRYPTION_KEY`.
- [ ] Verify connect, callback, status, disconnect, and reconnect flows.
- [ ] Verify provider token revocation on explicit disconnect.
- [ ] Verify provider token revocation or documented handling on account deletion.
- [ ] Verify meeting reminder sync creates and updates Google events.
- [ ] Verify task due date sync creates and updates Google events.
- [ ] Verify follow-up date sync creates and updates Google events.
- [ ] Verify event IDs are scoped per workspace and connected user.
- [ ] Verify provider failures do not persist false success state.

Definition of done:

- [ ] A Premium adult member can connect Google Calendar and sync all supported event types.
- [ ] Missing dates return `synced: false` with the documented skipped reason.
- [ ] Events from one connected user cannot overwrite another user's event IDs.

## Phase 8: Meeting, Participant, Task, Agreement Sync

- [ ] Run end-to-end sync tests with a real mobile client and real backend.
- [ ] Verify offline local writes survive backend errors.
- [ ] Verify empty client arrays do not delete server data.
- [ ] Verify same-record concurrent edits return conflicts.
- [ ] Verify client tombstone deletes and server tombstone conflicts.
- [ ] Verify server revisions increment predictably.
- [ ] Verify participant limits and invalid participant references.
- [ ] Verify task, agreement, source meeting, and related task references.
- [ ] Verify Free history limit and Premium unlimited history.
- [ ] Verify private notes are not synced, exported, or sent to AI.
- [ ] Add schema/API version handling before real user data accumulates.

Definition of done:

- [ ] Two devices can edit the same workspace without silent data loss.
- [ ] Conflict responses preserve client and server versions.
- [ ] Mobile clients handle `401`, `403`, `409`, `422`, `429`, and backend unavailable states.

## Phase 9: Export

- [ ] Verify meeting export is Premium-gated.
- [ ] Verify export validates meeting ownership.
- [ ] Verify private notes are excluded by default.
- [ ] Verify Markdown and text output render correctly on mobile.
- [ ] Verify export content contains no internal IDs or fields unless they are product-approved.

Definition of done:

- [ ] A Premium adult member can export an owned meeting.
- [ ] A Free user receives `403`.
- [ ] Exported content is safe to share and contains no private notes.

## Phase 10: Production Configuration

- [ ] Generate strong production secrets for all required token and encryption keys.
- [ ] Store secrets in the deployment secret store, never in the image or repository.
- [ ] Use separate local, staging, and production Supabase projects.
- [ ] Configure exact `CORS_ALLOWED_ORIGINS`.
- [ ] Verify production startup fails without required CORS origins.
- [ ] Verify no backend secrets are exposed through mobile or Vite variables.
- [ ] Verify `PUBLIC_API_BASE_URL` matches the public service origin.
- [ ] Verify Node runtime satisfies `>=24 <25`.
- [ ] Verify Docker image builds from a clean checkout.
- [ ] Verify `/health`, `/health/live`, and `/health/ready` in staging.

Definition of done:

- [ ] Staging and production environments use separate secrets and databases.
- [ ] Health checks work behind the real deployment platform.
- [ ] The backend runs from the production Docker image, not local dev tooling.

## Phase 11: Observability And Operations

- [ ] Configure structured production logs.
- [ ] Verify sensitive log redaction for auth, billing, calendar, AI, and webhook data.
- [ ] Add Sentry or the selected error reporting tool if launch operations require it.
- [ ] Add log retention policy.
- [ ] Add alerting for health check failures, elevated 5xx, provider failures, and migration failures.
- [ ] Add runbooks for failed migrations, provider outage, bad deployment, and account deletion support.
- [ ] Confirm automated Supabase/PostgreSQL backups are enabled.
- [ ] Perform and document one restore test in non-production.
- [ ] Define RPO and RTO.

Definition of done:

- [ ] Operators can detect and diagnose production failures without exposing family content.
- [ ] Backup restore has been tested before real user data exists.

## Phase 12: Mobile End-To-End Readiness

- [ ] Verify the mobile app uses `VITE_API_MODE=backend`.
- [ ] Verify `VITE_API_BASE_URL` points to the production API base.
- [ ] Verify mobile builds contain no Supabase service-role key, OpenAI key, Google OAuth secret, RevenueCat API key, SMTP secret, or backend token secret.
- [ ] Store access and refresh tokens in native secure storage.
- [ ] Verify token refresh, sign-out, revoked session handling, and app restart behavior.
- [ ] Verify account recovery UX.
- [ ] Verify invitation acceptance UX.
- [ ] Verify Premium purchase, restore, manage, and downgrade UX.
- [ ] Verify AI summary UX and disclaimer.
- [ ] Verify Calendar connect/disconnect/sync UX.
- [ ] Verify account export and deletion UX.
- [ ] Verify backend unavailable and slow network UX.
- [ ] Verify private notes user-facing notice.

Definition of done:

- [ ] A real tester can complete all MVP workflows on a production-like build without local/mock mode.
- [ ] No frontend feature claims behavior that the backend does not support.

## Phase 13: Legal, Store, And Policy Readiness

- [ ] Update Privacy Policy to match final data collection, sync, AI, calendar, billing, export, deletion, and retention behavior.
- [ ] Update Terms of Service.
- [ ] Update Google Play Data Safety answers.
- [ ] Document AI summary limitations and user-facing disclaimer.
- [ ] Document private notes as local-only unless the privacy model changes.
- [ ] Document account deletion and data export behavior.
- [ ] Confirm billing disclosures match RevenueCat/Google Play behavior.

Definition of done:

- [ ] Public policy documents match actual production behavior.
- [ ] Store listing claims match implemented backend and mobile behavior.

## Final Launch Gate

All items below must pass before real users are allowed onto the system:

- [ ] Working tree is clean and release commit is tagged.
- [ ] `npm run ci` passes from a clean checkout.
- [ ] `npm run build` passes from a clean checkout.
- [ ] `npm audit --audit-level=moderate` has no unresolved high or critical issues.
- [ ] Docker image builds and runs.
- [ ] Supabase migrations pass on staging.
- [ ] RLS/direct-access posture is verified.
- [ ] Backups are enabled and restore has been tested.
- [ ] All external providers pass staging end-to-end tests.
- [ ] Mobile backend-mode build passes all MVP workflows.
- [ ] Production secrets are configured and rotated from any test values.
- [ ] Legal/store/privacy documents are updated.
- [ ] Monitoring and operational runbooks are ready.

