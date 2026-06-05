# Authentication and Authorization Rules

## Core Rule

Authentication and authorization are separate.

- Authentication: who is the user?
- Authorization: is this user allowed to do this action?

Do not treat authenticated users as automatically authorized.

## Authentication

- Put auth parsing in a Fastify plugin or reusable preHandler.
- Do not duplicate token parsing in every route.
- Attach authenticated user context to the request.
- Do not trust `userId` from request body when it should come from the authenticated session.
- Return `401` when the user is not authenticated.

## Authorization

- Check permissions in services/use-cases, not only in routes.
- Always check ownership for user-owned data.
- Always check membership and role for workspace-owned data.
- Return `403` when the user is authenticated but not allowed.
- Return `404` instead of `403` when revealing resource existence would be unsafe.

## Ownership Rules

For every query involving private data, filter by the correct ownership key:

- `workspace_id`
- `user_id`
- `created_by`
- `owner_id`

Never fetch a record by `id` alone if it belongs to a user or workspace.

Bad:

```ts
getMeetingById(meetingId)
```

Better:

```ts
getMeetingByIdForUser(meetingId, userId)
```

or:

```ts
getMeetingByIdForWorkspace(meetingId, workspaceId)
```

## Admin Actions

- Admin permissions must be explicit.
- Do not infer admin access from email address unless this is documented and intentional.
- Log sensitive admin actions.
- Be careful with impersonation or support tools.

## Supabase-Specific Warning

If backend uses Supabase service role key, it may bypass RLS.

Therefore:

- backend services must enforce authorization explicitly
- service role key must never be exposed to clients
- RLS should still be reviewed for direct client access paths
