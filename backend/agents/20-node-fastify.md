# Node.js + Fastify Rules

## Fastify Setup

- Create the Fastify instance in one place.
- Register plugins before routes.
- Register routes as Fastify plugins.
- Use Fastify encapsulation intentionally.
- Do not decorate the root Fastify instance with unrelated properties.
- Close external resources during shutdown.

## Route Handlers

Route handlers should only:

- read validated request data
- get authenticated user/context
- call a service
- return a response

Avoid in route handlers:

- complex business logic
- raw database queries
- repeated permission checks
- manual validation that belongs in schemas
- inconsistent error formatting

## Validation

- Every public endpoint should have schemas for `body`, `params`, `querystring`, and important `response` objects.
- Validate input at the HTTP boundary.
- Never trust frontend validation.
- Do not pass raw request bodies directly into database queries.
- Response schemas should prevent leaking internal fields.

## Errors

- Use a centralized Fastify error handler.
- Throw typed application errors for expected failures.
- Do not expose raw database errors to clients.
- Do not expose stack traces in production.
- Return stable error shapes.

Recommended error shape:

```json
{
  "message": "Meeting not found",
  "code": "meeting_not_found",
  "details": {}
}
```

## Logging

- Use Fastify logger/Pino, not `console.log`:
    * Use Fastify logger when logging inside a Fastify app.
    * Use Pino directly when you need a logger outside Fastify, for example in workers, scripts, shared services or queues;
- Use `request.log` inside handlers.
- Do not log passwords, tokens, API keys, full cookies, or sensitive user data.
- Use structured logs.
- Log unexpected errors and important business failures.

## Async Safety

- Always `await` promises unless fire-and-forget behavior is intentional.
- Handle promise rejections.
- Do not block the event loop with CPU-heavy work.
- Use queues/workers for heavy tasks if needed.
- Avoid unbounded concurrency.

## TypeScript

- Use explicit types for request bodies, params, query, and responses.
- Avoid `any` unless there is a clear reason.
- Keep public types stable.
- Do not hide unsafe casts deep in code.
