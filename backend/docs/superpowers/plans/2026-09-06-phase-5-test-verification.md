# Phase 5 Test Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the backend Phase 5 automated checks deterministic, then record their verified result without changing runtime AI behavior.

**Architecture:** Vitest's worker environment provides a process-local mock provider before any application imports. A single worker prevents Argon2-heavy test files from starving one another, while unchanged 15-second timeouts continue detecting actual hangs. The obsolete direct count-query test is removed because atomic RPC claim tests own that behavior.

**Tech Stack:** Node.js 24, TypeScript, Vitest 4, Fastify, Supabase repository mocks.

## Global Constraints

- Do not change runtime behavior, production environment validation, schema, migrations, authorization, rate limits, or provider configuration.
- Do not read, print, copy, or persist real AI credentials.
- Keep test and hook timeouts at `15000`; do not skip or disable tests.
- Do not apply migrations, use staging, contact a provider, deploy, stage, commit, or push.

---

### Task 1: Isolate the test process and serialize its workers

**Files:**
- Modify: `vitest.config.ts:3-8`
- Test: `tests/app.test.ts`, `tests/openapi.test.ts`, `tests/password-reset.service.test.ts`, `tests/auth.service.test.ts`

**Interfaces:**
- Consumes: inherited `process.env`; `src/config/env.ts` loads `dotenv/config` only after test setup.
- Produces: `AI_PROVIDER='mock'` before application imports; all tests run with one worker.

- [ ] **Step 1: Capture the failing baseline**

Run `npm test` with the current local `.env`. Confirm the invalid OpenAI safety-secret cascade. Then run `$env:AI_PROVIDER = 'mock'; npm test` and confirm the parallel hook/test timeouts. Do not modify source files for either run.

- [ ] **Step 2: Set the provider-safe worker environment and worker limit**

Replace `vitest.config.ts` with:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      AI_PROVIDER: 'mock',
    },
    maxWorkers: 1,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
```

Do not set `AI_API_KEY` or `AI_SAFETY_IDENTIFIER_SECRET`. Vitest assigns this environment before test modules run, so `dotenv` preserves the mock provider without exposing or changing a developer secret. Explicit OpenAI test files retain their own `Object.assign(process.env, ...)` setup.

- [ ] **Step 3: Verify formerly timed-out files under normal configuration**

Run:

```powershell
npm test -- tests/app.test.ts tests/openapi.test.ts tests/password-reset.service.test.ts tests/auth.service.test.ts
```

Expected: all four files pass with no safety-secret error and no hook/test timeout.

- [ ] **Step 4: Typecheck the new Vitest configuration**

Run `npm run typecheck`.

Expected: PASS; installed Vitest accepts `setupFiles` and `maxWorkers`.

### Task 2: Remove the unsupported rate-limit count test

**Files:**
- Modify: `tests/repository-helpers.test.ts:3,67-118,249-268`
- Test: `tests/repository-helpers.test.ts`, `tests/ai-summary-rate-limit-claim.migration.test.ts`, `tests/ai.repository.test.ts`, `tests/ai.service.test.ts`

**Interfaces:**
- Consumes: `AiRepository.claimSummaryGeneration()` and the `claim_ai_summary_generation_v3` RPC contract.
- Produces: a helper suite containing only supported repository APIs; atomic claim behavior stays in focused repository/service/migration tests.

- [ ] **Step 1: Verify the obsolete-call failure**

Run `npm test -- tests/repository-helpers.test.ts`.

Expected: FAIL with `countRecentSummaryRequestsForUserInWorkspace is not a function`.

- [ ] **Step 2: Delete only obsolete test scaffolding**

In `tests/repository-helpers.test.ts`, delete:

```ts
import { AiRepository } from '../src/modules/ai/ai.repository.js';
```

Delete the complete `FakeCountQuery` declaration (current lines 67-94), `createCountClient` function (current lines 108-118), and `scopes user AI summary request counts by workspace` test (current lines 249-268). Do not reintroduce a read-then-count method; availability is now claimed atomically by the database RPC.

- [ ] **Step 3: Verify the supported coverage**

Run:

```powershell
npm test -- tests/repository-helpers.test.ts tests/ai-summary-rate-limit-claim.migration.test.ts tests/ai.repository.test.ts tests/ai.service.test.ts
```

Expected: PASS; the obsolete helper is gone and atomic claim/rate-limit service coverage remains green.

### Task 3: Run and record backend release checks

**Files:**
- Modify: `AI_RELEASE_CHECKLIST.md:222-236`
- Test: focused AI suite and the complete backend suite

**Interfaces:**
- Consumes: Tasks 1-2 and the Phase 5 backend commands.
- Produces: evidence for completed backend-only checks, leaving mobile, isolated-database, staging, manual, and final-go/no-go checks unchecked.

- [ ] **Step 1: Run focused AI verification**

Run:

```powershell
npm test -- tests/openai.client.test.ts tests/ai.service.test.ts tests/ai.summary-payload.test.ts tests/ai.routes.test.ts
```

Expected: PASS (81 tests in the current baseline), including service-level viewer and cross-workspace denials.

- [ ] **Step 2: Run the complete backend suite**

Run `npm test`.

Expected: PASS with no invalid-secret cascade, no obsolete method call, and no timeout.

- [ ] **Step 3: Run remaining automated release commands**

Run:

```powershell
npm run typecheck
npm run build
npm run openapi:check
```

Expected: every command passes; generated build output remains ignored.

- [ ] **Step 4: Record only verified backend completion**

After all previous commands pass, mark the first three Phase 5 automated-check bullets as complete. Below the backend command block, add a dated paragraph stating exact passing/skipped counts and successful commands. It must state that mobile checks, isolated local-database integration, staging, manual scenarios, and final sign-off are still outstanding.

- [ ] **Step 5: Inspect without staging or committing**

Run a whitespace diff check and short Git status using the repository-local safe-directory override. Expected: only the intended test configuration, stale test removal, checklist, design, and plan files, plus the pre-existing untracked prompt files.

## Plan Self-Review

- **Spec coverage:** Task 1 isolates environment and prevents resource timeouts; Task 2 removes only unsupported pre-RPC coverage; Task 3 completes every backend-only Phase 5 command and records its evidence.
- **Placeholder scan:** No unresolved placeholders or unspecified implementation steps remain.
- **Type consistency:** `env`, `maxWorkers`, `AiRepository`, and `claim_ai_summary_generation_v3` match the inspected source and Vitest 4 installation.
