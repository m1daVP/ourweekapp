# Phase 5 Test Verification Design

## Goal

Make the backend release-check suite deterministic and independent of a developer's local AI-provider configuration, while preserving meaningful authorization, atomic-claim, and timeout coverage needed for Phase 5 sign-off.

## Scope

This increment changes only backend test configuration and an obsolete test. It does not change application runtime behavior, provider configuration, database schema, migrations, authorization decisions, rate-limit policy, or deployment configuration.

The existing Phase 5 automated-check commands remain the verification contract. Staging, local-database migration, manual mobile scenarios, provider funding, deployment, and release sign-off remain separate, explicitly authorized activities.

## Findings

The focused AI checks pass (81 tests), and `npm run typecheck` passes. The ordinary full suite is not currently a valid release signal for two independent reasons:

- A local `AI_PROVIDER=openai` configuration without a valid 32-character `AI_SAFETY_IDENTIFIER_SECRET` causes configuration validation to fail when unrelated test files import the app. Unit tests must not depend on a developer's provider credential state.
- Concurrent Vitest workers exhaust local resources during Argon2-heavy auth tests. The affected app, OpenAPI, password-reset, and auth-service tests pass when run serially; increasing timeouts would hide resource contention rather than fixing it.

`tests/repository-helpers.test.ts` additionally calls `AiRepository.countRecentSummaryRequestsForUserInWorkspace`, a method intentionally removed when atomic rate-limit claiming moved into the `claim_ai_summary_generation_v3` database RPC. The test no longer validates a supported repository contract.

## Decisions

### Test environment isolation

Add a Vitest setup module that establishes a non-production, mock AI provider before application modules load. It must not supply API keys, real provider credentials, or a safety-identifier secret. Tests that intentionally exercise OpenAI wiring continue to set their own explicit environment values and mock the provider boundary.

This makes the ordinary `npm test` command independent of `.env` AI settings while retaining production startup validation in `tests/env.test.ts`.

### Resource-safe test execution

Configure Vitest to execute this backend suite with a single worker. This is an intentional reliability constraint for the current Argon2 memory configuration, not a timeout increase or test exclusion. The existing 15-second test and hook limits remain in place, so genuinely blocked tests still fail.

The suite is modest in size and serial execution was demonstrated to complete the previously timed-out files successfully. Revisit parallelism only after a measured CI/local resource evaluation proves a higher worker count reliable.

### Current atomic-claim coverage

Remove the obsolete direct count-query assertion from `tests/repository-helpers.test.ts`. Its behavior is not replaced with another non-atomic count helper: the supported contract is the workspace-locked `claim_ai_summary_generation_v3` RPC, already exercised by the AI claim/rate-limit migration, repository, and service test coverage.

The Phase 5 focused route tests continue to prove that routes delegate business authorization to the service, while service tests retain real viewer and cross-workspace denial coverage.

## File Boundaries

- `vitest.config.ts` will own deterministic, provider-safe test-process defaults and cap workers without changing timeouts.
- `tests/repository-helpers.test.ts` will remove the assertion for the deleted repository method.
- `AI_RELEASE_CHECKLIST.md` will record the observed baseline, repair, and verification result only after all scoped checks pass.

## Error Handling and Safety

The test setup must never expose, print, copy, or mutate a real provider key or secret. It is process-local and must not alter `.env`, deployment secrets, or application production defaults.

No test timeout is increased, disabled, or skipped. A failing serial suite remains a release blocker and must be investigated separately.

## Test Strategy

1. Run the focused AI suite unchanged to protect the API/provider boundary.
2. Run the formerly timed-out test files both in the complete serial suite and individually as needed to verify the resource contention diagnosis.
3. Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run openapi:check` through their documented commands after the test-harness repair.
4. Review the resulting test output for unexpected skips, hook timeouts, and authorization regressions.

## Non-Goals

- Changing tests to accept invalid OpenAI production configuration.
- Increasing test or hook timeouts.
- Removing real authorization, workspace-ownership, rate-limit, or database-RPC coverage.
- Applying migrations, running an isolated local database, staging verification, deployment, or release sign-off.
