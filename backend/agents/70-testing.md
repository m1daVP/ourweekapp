# Testing Rules

## Testing Priorities

Tests should focus on:

- business logic
- auth and authorization
- validation
- database ownership boundaries
- critical API flows
- regression bugs

## Unit Tests

Use unit tests for:

- pure business logic
- utility functions
- service behavior with mocked repositories
- validation helpers

## Integration Tests

Use integration tests for:

- Fastify routes
- request validation
- response shape
- auth behavior
- database queries
- Supabase/PostgreSQL integration where practical

## Required Cases for API Endpoints

For important endpoints, test:

- success case
- invalid input
- unauthenticated request
- authenticated but unauthorized request
- resource not found
- ownership boundary

Example ownership test:

- User A creates a meeting.
- User B tries to read/update/delete it.
- API must reject the request.

## Test Data

- Use isolated test data.
- Do not depend on test execution order.
- Clean up data between tests.
- Do not use production credentials.
- Do not use production database.

## Regression Tests

When fixing a bug:

- add a test that fails before the fix
- implement the fix
- keep the test to prevent recurrence

## What Not to Test Too Much

Avoid excessive tests for:

- simple framework wiring
- trivial getters/setters
- implementation details that make refactoring painful

Test behavior, not internal structure.
