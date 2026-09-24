# CI test environment design

## Goal

Make the Vitest suite runnable in GitHub Actions without an ignored local `.env` file or production credentials.

## Design

`vitest.config.ts` will define harmless, structurally valid values for application settings that are required when modules load: the public API URL, Supabase URL and service key, and token secrets. The existing mock AI provider remains enabled. These are test-only placeholders and do not enable external integrations.

The password-reset service test will add `INVITATION_HANDOFF_URL` to its SMTP fixture. Its SMTP scenario is deliberately complete, so it must also satisfy the configuration rule that requires a handoff URL whenever SMTP is configured.

## Scope and safety

No production environment, GitHub secret, workflow, API contract, or database schema changes are needed. SMTP remains disabled by default for tests; the password-reset test explicitly enables it only while testing mail behavior.

## Verification

Run the affected password-reset and rate-limit tests, then run `npm run typecheck` and `npm test` to verify CI-equivalent test configuration.
