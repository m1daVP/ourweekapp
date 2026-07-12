export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface EndpointContract {
  method: ApiMethod;
  path: string;
  requiresAuth: boolean;
  successStatuses: number[];
  errorStatuses: number[];
  requiredRequestFields?: string[];
  requestExample?: Record<string, unknown>;
}

export interface OpenApiOperationFixture {
  security?: Array<Record<string, unknown>>;
  requestBody?: {
    content?: {
      'application/json'?: {
        schema?: {
          required?: string[];
        };
      };
    };
  };
  responses: Record<string, unknown>;
}

export interface OpenApiFixture {
  paths: Record<
    string,
    Partial<Record<Lowercase<ApiMethod>, OpenApiOperationFixture>>
  >;
}

export const endpointContracts: EndpointContract[] = [
  {
    method: 'POST',
    path: '/v1/auth/register',
    requiresAuth: false,
    successStatuses: [201],
    errorStatuses: [401, 409, 422, 500],
    requiredRequestFields: ['email', 'password', 'displayName'],
    requestExample: {
      email: 'rita@example.com',
      password: 'correct horse battery staple',
      displayName: 'Rita',
    },
  },
  {
    method: 'POST',
    path: '/v1/auth/sign-in',
    requiresAuth: false,
    successStatuses: [200],
    errorStatuses: [401, 409, 422, 429, 500],
    requiredRequestFields: ['email', 'password'],
    requestExample: {
      email: 'rita@example.com',
      password: 'correct horse battery staple',
    },
  },
  {
    method: 'POST',
    path: '/v1/auth/google',
    requiresAuth: false,
    successStatuses: [200],
    errorStatuses: [401, 409, 422, 429, 500],
    requiredRequestFields: ['idToken'],
    requestExample: { idToken: 'google-id-token' },
  },
  {
    method: 'POST',
    path: '/v1/auth/password-reset/request',
    requiresAuth: false,
    successStatuses: [200],
    errorStatuses: [401, 409, 422, 429, 500],
    requiredRequestFields: ['email'],
    requestExample: { email: 'rita@example.com' },
  },
  {
    method: 'POST',
    path: '/v1/auth/password-reset/confirm',
    requiresAuth: false,
    successStatuses: [204],
    errorStatuses: [401, 409, 422, 429, 500],
    requiredRequestFields: ['token', 'password'],
    requestExample: {
      token: 'ABCD2345',
      password: 'correct horse battery staple',
    },
  },
  {
    method: 'POST',
    path: '/v1/auth/refresh',
    requiresAuth: false,
    successStatuses: [200],
    errorStatuses: [401, 409, 422, 429, 500],
    requiredRequestFields: ['refreshToken'],
    requestExample: { refreshToken: 'refresh-token' },
  },
  {
    method: 'POST',
    path: '/v1/auth/sign-out',
    requiresAuth: true,
    successStatuses: [204],
    errorStatuses: [401, 409, 422, 500],
  },
  {
    method: 'GET',
    path: '/v1/auth/me',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 409, 422, 500],
  },
  {
    method: 'GET',
    path: '/v1/meetings/',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 404, 409, 422, 500],
  },
  {
    method: 'POST',
    path: '/v1/meetings/sync',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 404, 409, 422, 500],
    requiredRequestFields: [
      'meetings',
      'activeMeetingId',
      'draftSavedAt',
      'clientUpdatedAt',
    ],
    requestExample: {
      meetings: [],
      activeMeetingId: null,
      draftSavedAt: null,
      clientUpdatedAt: '2026-06-13T12:00:00.000Z',
    },
  },
  {
    method: 'PUT',
    path: '/v1/meetings/{id}/summary',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 404, 409, 422, 500],
    requiredRequestFields: ['summary'],
    requestExample: {
      summary: {
        id: 'summary-1',
        meetingId: 'meeting-1',
        shortSummary: 'A short summary.',
        mainTopics: [],
        keyTensions: [],
        agreements: [],
        tasks: [],
        suggestedNextMeetingFocus: [],
        createdAt: '2026-06-13T12:00:00.000Z',
      },
    },
  },
  {
    method: 'GET',
    path: '/v1/tasks/',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 409, 422, 500],
  },
  {
    method: 'POST',
    path: '/v1/tasks/sync',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 409, 422, 500],
    requiredRequestFields: [
      'tasks',
      'agreements',
      'reviewDecisions',
      'clientUpdatedAt',
    ],
    requestExample: {
      tasks: [],
      agreements: [],
      reviewDecisions: [],
      clientUpdatedAt: '2026-06-13T12:00:00.000Z',
    },
  },
  {
    method: 'POST',
    path: '/v1/participants/sync',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 422, 500],
    requiredRequestFields: ['participants', 'clientUpdatedAt'],
    requestExample: {
      participants: [],
      clientUpdatedAt: '2026-06-13T12:00:00.000Z',
    },
  },
  {
    method: 'GET',
    path: '/v1/subscriptions/status',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 422, 500, 502],
  },
  {
    method: 'POST',
    path: '/v1/subscriptions/restore',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 422, 500, 502],
    requiredRequestFields: ['provider'],
    requestExample: { provider: 'google_play' },
  },
  {
    method: 'GET',
    path: '/v1/subscriptions/manage',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 422, 500, 502],
  },
  {
    method: 'POST',
    path: '/v1/ai/meeting-summary',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 404, 409, 422, 429, 500, 503],
    requiredRequestFields: ['meetingId'],
    requestExample: { meetingId: 'meeting-1', locale: 'en' },
  },
  {
    method: 'GET',
    path: '/v1/calendar/google/status',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 422, 500],
  },
  {
    method: 'POST',
    path: '/v1/calendar/google/connect',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 422, 500],
    requiredRequestFields: ['redirectUrl'],
    requestExample: { redirectUrl: 'ourweek://calendar/google/callback' },
  },
  {
    method: 'POST',
    path: '/v1/calendar/google/disconnect',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 422, 500],
  },
  {
    method: 'POST',
    path: '/v1/calendar/google/meeting-reminders',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 422, 500],
    requiredRequestFields: ['meetingId', 'title'],
    requestExample: { meetingId: 'meeting-1', title: 'Weekly check-in' },
  },
  {
    method: 'POST',
    path: '/v1/calendar/google/task-due-dates',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 422, 500],
    requiredRequestFields: ['taskId', 'title'],
    requestExample: { taskId: 'task-1', title: 'Buy kindergarten shoes' },
  },
  {
    method: 'POST',
    path: '/v1/calendar/google/follow-up-dates',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 422, 500],
    requiredRequestFields: ['followUpId', 'title', 'sourceMeetingId'],
    requestExample: {
      followUpId: 'follow-up-1',
      title: 'Review agreement',
      sourceMeetingId: 'meeting-1',
    },
  },
  {
    method: 'GET',
    path: '/v1/workspace/',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 404, 409, 422, 500],
  },
  {
    method: 'PUT',
    path: '/v1/workspace/',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 404, 409, 422, 500],
    requiredRequestFields: ['name'],
    requestExample: { name: 'Our home' },
  },
  {
    method: 'POST',
    path: '/v1/workspace/invitations',
    requiresAuth: true,
    successStatuses: [201],
    errorStatuses: [401, 403, 404, 409, 422, 500],
    requiredRequestFields: ['email', 'role'],
    requestExample: { email: 'partner@example.com', role: 'adult_member' },
  },
  {
    method: 'PUT',
    path: '/v1/workspace/members/{userId}',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 403, 404, 409, 422, 500],
  },
  {
    method: 'DELETE',
    path: '/v1/workspace/members/{userId}',
    requiresAuth: true,
    successStatuses: [204],
    errorStatuses: [401, 403, 404, 409, 422, 500],
  },
  {
    method: 'GET',
    path: '/v1/account/export',
    requiresAuth: true,
    successStatuses: [200],
    errorStatuses: [401, 404, 422, 500],
  },
  {
    method: 'DELETE',
    path: '/v1/account/',
    requiresAuth: true,
    successStatuses: [204],
    errorStatuses: [401, 404, 422, 500],
  },
];
