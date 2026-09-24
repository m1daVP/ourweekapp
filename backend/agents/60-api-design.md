# API Design Rules

## General API Principles

- Keep API responses predictable and consistent.
- Prefer stable contracts over exposing raw database rows.
- Do not leak internal implementation details.
- Do not make breaking changes without a migration path.
- Design APIs for mobile clients: compact, explicit, and pagination-friendly.

## Status Codes

Use standard status codes:

- `200` successful read/update
- `201` resource created
- `204` successful empty response
- `400` invalid request
- `401` unauthenticated
- `403` authenticated but forbidden
- `404` not found
- `409` conflict
- `422` semantic validation error, if used by project convention
- `500` unexpected server error

## Request Rules

- Validate body, params, and query.
- Do not accept fields that should be server-controlled.
- Do not accept `userId` from body if it should come from session.
- Use clear names.
- Avoid ambiguous booleans when enum/status would be clearer.

## Response Rules

- Return only fields needed by the client.
- Do not return sensitive fields.
- Do not expose raw Supabase/Postgres error objects.
- Use consistent date formats.
- Use consistent pagination format.

Example pagination response:

```json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

## Error Response

Use consistent error shape:

```json
{
  "message": "Invalid request",
  "code": "validation_error",
  "details": {}
}
```

## Versioning

- Avoid versioning unless necessary.
- Prefer backward-compatible additions.
- Do not remove fields immediately.
- Deprecate old fields before removing them.
