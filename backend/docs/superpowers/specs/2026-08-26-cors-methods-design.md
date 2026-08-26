# CORS Method Allowlist Design

## Goal

Allow browser clients from configured trusted origins to send requests using every HTTP method currently exposed by the API.

## Decision

Configure `@fastify/cors` with this explicit allowlist:

`GET, HEAD, POST, PUT, DELETE, OPTIONS`

This matches the current public routes and permits browser preflight requests for `PUT /v1/workspace`.

## Scope

- Update the CORS plugin registration in `src/app.ts`.
- Add an app-level test that an `OPTIONS` preflight from a configured origin requests `PUT` and receives an `Access-Control-Allow-Methods` response containing `PUT`.

## Out of Scope

- Changing the trusted-origin configuration.
- Adding new API routes or HTTP methods.
- Relaxing CORS to reflect arbitrary requested methods.

## Error Handling and Verification

The server retains its existing CORS origin restrictions. The new test prevents regression to the dependency default, which permits only `GET`, `HEAD`, and `POST`.
