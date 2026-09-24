# Health Ping Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dependency-free npm command that checks the configured API health endpoint every 30 seconds.

**Architecture:** A standalone ESM Node script validates the API base URL once at startup, issues an immediate health request, and self-schedules only after each request settles. The npm command uses Node's native optional `.env` loader, with an existing process environment value taking precedence; no application bundle code changes.

**Tech Stack:** Node.js 24 built-in `fetch`, ESM, npm.

## Global Constraints

- Do not add dependencies.
- Read `VITE_API_BASE_URL` only from the process environment; do not print its value.
- Request the base URL plus `/health` immediately and every 30 seconds thereafter.
- Print successful checks to stdout as `[hh:mm:ss] Success`.
- Print failed checks to stderr as `[hh:mm:ss] Fail`, then continue checking.
- Schedule the next request only after the current request settles, so requests never overlap.

---

### Task 1: Add the Health Ping Command

**Files:**

- Create: `scripts/ping-health.mjs`
- Modify: `package.json`
- Test: manual terminal verification using a local HTTP server

**Interfaces:**

- Consumes: `process.env.VITE_API_BASE_URL` as an absolute HTTP(S) URL.
- Produces: `npm run health:ping`, a foreground process that writes one status line per completed request.

- [ ] **Step 1: Define the command in `package.json`**

Add this script entry alongside the existing npm scripts:

```json
"health:ping": "node --env-file-if-exists=.env scripts/ping-health.mjs"
```

- [ ] **Step 2: Implement endpoint validation and timestamp formatting**

Create `scripts/ping-health.mjs` with a 30-second interval constant, a URL built
from the required environment variable, and a formatter that produces local time
in zero-padded `hh:mm:ss` form. If the variable is missing or invalid, write a
configuration error to stderr and exit with code 1 before making any request.

- [ ] **Step 3: Implement sequential health checks**

Use built-in `fetch`. A response with `response.ok === true` logs Success to
stdout; network errors, 10-second request timeouts, and non-success HTTP statuses log Fail to stderr. In a `finally` block, use `setTimeout(ping, 30_000)` so only one request exists at a time and failures cannot stop the process.

- [ ] **Step 4: Verify successful and failed request behavior**

Run the command against a reachable local `/health` endpoint.

Expected: an immediate stdout line matching `^\[\d{2}:\d{2}:\d{2}\] Success$`,
then another success about 30 seconds later.

Run it with an unreachable URL.

Expected: a stderr line matching `^\[\d{2}:\d{2}:\d{2}\] Fail$`, then another
failure after about 30 seconds, demonstrating that the process continues.

- [ ] **Step 5: Run repository quality checks**

Run `npm run check` and `npm run build`.

Expected: both commands exit with code 0.
