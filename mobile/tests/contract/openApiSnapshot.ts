import type {
  ApiMethod,
  OpenApiFixture,
  OpenApiOperationFixture,
} from './apiContractFixtures';

function operation(
  statuses: number[],
  options: {
    requiresAuth?: boolean;
    requiredRequestFields?: string[];
  } = {}
): OpenApiOperationFixture {
  return {
    responses: statuses.reduce<Record<string, unknown>>((responses, status) => {
      responses[String(status)] = { description: 'Default Response' };
      return responses;
    }, {}),
    ...(options.requiresAuth ? { security: [{ bearerAuth: [] }] } : {}),
    ...(options.requiredRequestFields
      ? {
          requestBody: {
            content: {
              'application/json': {
                schema: { required: options.requiredRequestFields },
              },
            },
          },
        }
      : {}),
  };
}

function pathItem(
  method: ApiMethod,
  operationFixture: OpenApiOperationFixture
) {
  return {
    [method.toLowerCase()]: operationFixture,
  };
}

export const openApiSnapshot: OpenApiFixture = {
  paths: {
    '/v1/account/': pathItem(
      'DELETE',
      operation([204, 401, 404, 422, 500], { requiresAuth: true })
    ),
    '/v1/account/export': pathItem(
      'GET',
      operation([200, 401, 404, 422, 500], { requiresAuth: true })
    ),
    '/v1/ai/meeting-summary': pathItem(
      'POST',
      operation([200, 401, 403, 404, 409, 422, 429, 500, 503], {
        requiresAuth: true,
        requiredRequestFields: ['meetingId'],
      })
    ),
    '/v1/auth/me': pathItem(
      'GET',
      operation([200, 401, 409, 422, 500], { requiresAuth: true })
    ),
    '/v1/auth/google': pathItem(
      'POST',
      operation([200, 401, 409, 422, 429, 500], {
        requiredRequestFields: ['idToken'],
      })
    ),
    '/v1/auth/password-reset/confirm': pathItem(
      'POST',
      operation([204, 401, 409, 422, 429, 500, 503], {
        requiredRequestFields: ['token', 'password'],
      })
    ),
    '/v1/auth/password-reset/request': pathItem(
      'POST',
      operation([200, 401, 409, 422, 429, 500], {
        requiredRequestFields: ['email'],
      })
    ),
    '/v1/auth/refresh': pathItem(
      'POST',
      operation([200, 401, 409, 422, 500], {
        requiredRequestFields: ['refreshToken'],
      })
    ),
    '/v1/auth/register': pathItem(
      'POST',
      operation([201, 401, 409, 422, 500], {
        requiredRequestFields: ['email', 'password', 'displayName'],
      })
    ),
    '/v1/auth/sign-in': pathItem(
      'POST',
      operation([200, 401, 409, 422, 429, 500], {
        requiredRequestFields: ['email', 'password'],
      })
    ),
    '/v1/auth/sign-out': pathItem(
      'POST',
      operation([204, 401, 409, 422, 500], { requiresAuth: true })
    ),
    '/v1/billing/manage': pathItem(
      'GET',
      operation([200, 401, 403, 422, 500, 502], { requiresAuth: true })
    ),
    '/v1/billing/restore': pathItem(
      'POST',
      operation([200, 401, 403, 422, 500, 502], {
        requiresAuth: true,
        requiredRequestFields: ['provider'],
      })
    ),
    '/v1/billing/status': pathItem(
      'GET',
      operation([200, 401, 403, 422, 500, 502], { requiresAuth: true })
    ),
    '/v1/billing/validate': pathItem(
      'POST',
      operation([200, 401, 403, 422, 500, 502], {
        requiresAuth: true,
        requiredRequestFields: ['provider', 'purchaseToken', 'productId'],
      })
    ),
    '/v1/calendar/google/callback': pathItem('GET', operation([422, 500])),
    '/v1/calendar/google/connect': pathItem(
      'POST',
      operation([200, 401, 403, 422, 500], {
        requiresAuth: true,
        requiredRequestFields: ['redirectUrl'],
      })
    ),
    '/v1/calendar/google/disconnect': pathItem(
      'POST',
      operation([200, 401, 403, 422, 500], { requiresAuth: true })
    ),
    '/v1/calendar/google/follow-up-dates': pathItem(
      'POST',
      operation([200, 401, 403, 422, 500], {
        requiresAuth: true,
        requiredRequestFields: ['followUpId', 'title', 'sourceMeetingId'],
      })
    ),
    '/v1/calendar/google/meeting-reminders': pathItem(
      'POST',
      operation([200, 401, 403, 422, 500], {
        requiresAuth: true,
        requiredRequestFields: ['meetingId', 'title'],
      })
    ),
    '/v1/calendar/google/status': pathItem(
      'GET',
      operation([200, 401, 403, 422, 500], { requiresAuth: true })
    ),
    '/v1/calendar/google/task-due-dates': pathItem(
      'POST',
      operation([200, 401, 403, 422, 500], {
        requiresAuth: true,
        requiredRequestFields: ['taskId', 'title'],
      })
    ),
    '/v1/exports/meeting': pathItem(
      'POST',
      operation([200, 401, 403, 404, 422, 500], {
        requiresAuth: true,
        requiredRequestFields: ['meetingId'],
      })
    ),
    '/v1/meetings/': pathItem(
      'GET',
      operation([200, 401, 403, 404, 409, 422, 500], {
        requiresAuth: true,
      })
    ),
    '/v1/meetings/{id}/summary': pathItem(
      'PUT',
      operation([200, 401, 403, 404, 409, 422, 500], {
        requiresAuth: true,
        requiredRequestFields: ['summary'],
      })
    ),
    '/v1/meetings/sync': pathItem(
      'POST',
      operation([200, 401, 403, 404, 409, 422, 500], {
        requiresAuth: true,
        requiredRequestFields: [
          'meetings',
          'activeMeetingId',
          'draftSavedAt',
          'clientUpdatedAt',
        ],
      })
    ),
    '/v1/participants/sync': pathItem(
      'POST',
      operation([200, 401, 403, 422, 500], {
        requiresAuth: true,
        requiredRequestFields: ['participants', 'clientUpdatedAt'],
      })
    ),
    '/v1/subscriptions/manage': pathItem(
      'GET',
      operation([200, 401, 403, 422, 500, 502], { requiresAuth: true })
    ),
    '/v1/subscriptions/restore': pathItem(
      'POST',
      operation([200, 401, 403, 422, 500, 502], {
        requiresAuth: true,
        requiredRequestFields: ['provider'],
      })
    ),
    '/v1/subscriptions/status': pathItem(
      'GET',
      operation([200, 401, 403, 422, 500, 502], { requiresAuth: true })
    ),
    '/v1/subscriptions/validate': pathItem(
      'POST',
      operation([200, 401, 403, 422, 500, 502], {
        requiresAuth: true,
        requiredRequestFields: ['provider', 'purchaseToken', 'productId'],
      })
    ),
    '/v1/tasks/': pathItem(
      'GET',
      operation([200, 401, 403, 409, 422, 500], { requiresAuth: true })
    ),
    '/v1/tasks/sync': pathItem(
      'POST',
      operation([200, 401, 403, 409, 422, 500], {
        requiresAuth: true,
        requiredRequestFields: [
          'tasks',
          'agreements',
          'reviewDecisions',
          'clientUpdatedAt',
        ],
      })
    ),
    '/v1/workspace/': {
      get: operation([200, 401, 403, 404, 409, 422, 500], {
        requiresAuth: true,
      }),
      put: operation([200, 401, 403, 404, 409, 422, 500], {
        requiresAuth: true,
        requiredRequestFields: ['name'],
      }),
    },
    '/v1/workspace/invitations': pathItem(
      'POST',
      operation([201, 401, 403, 404, 409, 422, 500], {
        requiresAuth: true,
        requiredRequestFields: ['email', 'role'],
      })
    ),
    '/v1/workspace/members/{userId}': {
      put: operation([200, 401, 403, 404, 409, 422, 500], {
        requiresAuth: true,
      }),
      delete: operation([204, 401, 403, 404, 409, 422, 500], {
        requiresAuth: true,
      }),
    },
  },
};
