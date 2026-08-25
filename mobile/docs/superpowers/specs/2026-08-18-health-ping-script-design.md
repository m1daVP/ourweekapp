# Health Ping Script Design

## Goal

Provide a very lightweight project command that continuously checks the configured
backend health endpoint every 30 seconds.

## Design

Create an ESM Node script in `scripts/` and invoke it through an npm command. The command uses Node's native optional `.env` loader, while an already-set process environment value takes precedence. The script reads `VITE_API_BASE_URL`, removes a trailing slash, and requests `${VITE_API_BASE_URL}/health` using Node's built-in `fetch`.

It runs its first check immediately, then schedules each later check 30 seconds
after the preceding request has settled. Each request times out after 10 seconds. This avoids concurrent requests if the endpoint is slow or unavailable and uses no dependencies or background workers.

## Logging and Errors

Each successful request writes `[hh:mm:ss] Success` to standard output. A network
failure or non-success HTTP response writes `[hh:mm:ss] Fail` to standard error.
Failures do not stop the process; the next check is still scheduled. A missing or
invalid `VITE_API_BASE_URL` is a startup configuration error and ends the process
with a non-zero status rather than issuing requests to an unintended endpoint.

## Verification

Run the npm command with a local test endpoint and confirm an immediate success
line followed by a new line every 30 seconds. Use an unavailable endpoint to
confirm failure lines go to standard error while the process continues running.
