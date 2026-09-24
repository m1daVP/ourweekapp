# CORS Method Allowlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permit browser preflight requests for every HTTP method currently exposed by the API, including workspace updates using `PUT`.

**Architecture:** Keep the trusted-origin policy unchanged and set the CORS method allowlist at the existing global `@fastify/cors` registration. Lock the behavior down with an application-level `OPTIONS` preflight test using Fastify injection.

**Tech Stack:** Node.js, TypeScript, Fastify 5, `@fastify/cors` 11, Vitest.

## Global Constraints

- Allow exactly `GET, HEAD, POST, PUT, DELETE, OPTIONS`.
- Preserve the existing `CORS_ALLOWED_ORIGINS`/`CORS_ORIGINS` origin selection.
- Do not add dependencies, routes, environment variables, or database changes.
- Retain existing authentication and authorization behavior.

---

### Task 1: Configure and verify the CORS method allowlist

**Files:**
- Modify: `src/app.ts:50-52`
- Modify: `tests/app.test.ts:76-85`

**Interfaces:**
- Consumes: `env.CORS_ORIGINS`, the parsed trusted-origin list.
- Produces: `Access-Control-Allow-Methods: GET, HEAD, POST, PUT, DELETE, OPTIONS` for accepted browser preflight requests.

- [ ] **Step 1: Write the failing preflight test**

Add this test in the existing `describe('buildApp proxy awareness', ...)` suite:

```ts
  it('allows PUT requests from configured CORS origins', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/workspace',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'PUT',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-methods'])
      .toBe('GET, HEAD, POST, PUT, DELETE, OPTIONS');
  });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/app.test.ts`

Expected: FAIL because the response allows the package default `GET,HEAD,POST`, which does not include `PUT`.

- [ ] **Step 3: Set the explicit CORS method allowlist**

Change the existing registration in `src/app.ts` to:

```ts
  await app.register(cors, {
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- tests/app.test.ts`

Expected: PASS; the preflight response is 204 and explicitly includes `PUT`.

- [ ] **Step 5: Run TypeScript and full regression checks**

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

Run: `npm test`

Expected: PASS with no test failures.

- [ ] **Step 6: Commit after explicit approval**

Before committing, request an approved numbered commit list. If approved, stage only `src/app.ts` and `tests/app.test.ts` and commit with:

```bash
git commit -m "fix: allow all API methods in CORS"
```
