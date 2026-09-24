# CI Test Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the Vitest suite in GitHub Actions without a local `.env` file or production credentials.

**Architecture:** Vitest owns baseline, non-secret settings required during module import. The password-reset test retains control over its explicit SMTP scenario and includes the corresponding invitation handoff URL required by environment validation.

**Tech Stack:** Node.js, TypeScript, Vitest, Zod.

## Global Constraints

- Use only harmless test placeholder values; do not add GitHub secrets or production configuration.
- Keep SMTP disabled by default and enable it only inside the password-reset test fixture.
- Do not change API contracts, database schema, or GitHub workflow behavior.

---

### Task 1: Make test environment configuration self-contained

**Files:**
- Modify: `vitest.config.ts:5-7`
- Modify: `tests/password-reset.service.test.ts:26-32`
- Test: `tests/password-reset.service.test.ts`
- Test: `tests/auth.register-rate-limit.routes.test.ts`
- Test: `tests/auth.refresh-rate-limit.routes.test.ts`

**Interfaces:**
- Consumes: `src/config/env.ts` validation requirements for `PUBLIC_API_BASE_URL`, Supabase credentials, token secrets, and SMTP handoff URLs.
- Produces: a valid process environment for every Vitest worker without loading `.env`.

- [ ] **Step 1: Confirm the existing regression cases**

Run:

```powershell
npm test -- tests/password-reset.service.test.ts tests/auth.register-rate-limit.routes.test.ts tests/auth.refresh-rate-limit.routes.test.ts
```

Expected: the password-reset tests fail when SMTP is configured without `INVITATION_HANDOFF_URL`, while the rate-limit tests can depend on a local `.env` for required application settings.

- [ ] **Step 2: Add safe global Vitest values**

Replace the `env` object in `vitest.config.ts` with:

```ts
env: {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  AI_PROVIDER: 'mock',
  PUBLIC_API_BASE_URL: 'http://localhost:3000/v1',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ACCESS_TOKEN_SECRET: 'access-token-secret-at-least-32-bytes',
  REFRESH_TOKEN_SECRET: 'refresh-token-secret-at-least-32-bytes',
  PASSWORD_RESET_TOKEN_SECRET: 'password-reset-secret-at-least-32-bytes',
  TOKEN_ENCRYPTION_KEY: 'token-encryption-key-at-least-32-byte',
},
```

- [ ] **Step 3: Complete the explicit SMTP fixture**

Add this property to `smtpEnv` in `tests/password-reset.service.test.ts`:

```ts
INVITATION_HANDOFF_URL: 'https://app.example.test/invite',
```

- [ ] **Step 4: Verify the affected tests pass**

Run:

```powershell
npm test -- tests/password-reset.service.test.ts tests/auth.register-rate-limit.routes.test.ts tests/auth.refresh-rate-limit.routes.test.ts
```

Expected: all selected tests pass without needing local SMTP or API configuration.

- [ ] **Step 5: Verify the full CI-equivalent test checks**

Run:

```powershell
npm run typecheck
npm test
```

Expected: both commands exit successfully. The database integration suites may remain skipped when database proof credentials are absent.

- [ ] **Step 6: Commit only with explicit user approval**

Do not stage or commit changes unless the user supplies an approved commit list, per repository policy.
