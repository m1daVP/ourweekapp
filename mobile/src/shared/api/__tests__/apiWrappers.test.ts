import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, type ApiRequestOptions } from '@/shared/api/httpClient';
import {
  confirmPasswordReset,
  getCurrentUser,
  refreshSession,
  register,
  requestPasswordReset,
  signIn,
  signInWithGoogleIdToken,
  signOut,
} from '@/shared/api/authApi';
import {
  listMeetings,
  saveMeetingSummary,
  syncMeetingsApi,
} from '@/shared/api/meetingsApi';
import { listTasks, syncTasksApi } from '@/shared/api/tasksApi';
import {
  getSubscriptionManagementUrl,
  getSubscriptionStatus,
  restoreSubscriptionStatus,
} from '@/shared/api/subscriptionsApi';
import { generateAiMeetingSummary } from '@/shared/api/aiApi';
import {
  disconnectGoogleCalendar,
  getGoogleCalendarConnectionStatus,
  startGoogleCalendarConnection,
  syncGoogleCalendarFollowUpDate,
  syncGoogleCalendarMeetingReminder,
  syncGoogleCalendarTaskDueDate,
} from '@/shared/api/calendarApi';
import {
  createWorkspaceInvitation,
  getWorkspace,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  updateWorkspace,
  updateWorkspaceMember,
} from '@/shared/api/workspaceApi';
import { deleteAccount, exportAccountData } from '@/shared/api/accountApi';

vi.mock('@/shared/api/httpClient', () => ({
  ApiClientError: class ApiClientError extends Error {
    code?: string;

    constructor(message: string, options: { code?: string } = {}) {
      super(message);
      this.name = 'ApiClientError';
      this.code = options.code;
    }
  },
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

function lastApiCall(): [string, ApiRequestOptions | undefined] {
  const call = apiRequestMock.mock.calls.at(-1);

  expect(call).toBeDefined();

  return call as [string, ApiRequestOptions | undefined];
}

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockResolvedValue({} as never);
});

describe('authApi', () => {
  it('calls expected auth endpoints', async () => {
    await signIn({ email: 'rita@example.com', password: 'password123' });
    expect(lastApiCall()).toEqual([
      '/auth/sign-in',
      {
        method: 'POST',
        body: { email: 'rita@example.com', password: 'password123' },
      },
    ]);

    await register({
      email: 'rita@example.com',
      password: 'password123',
      displayName: 'Rita',
    });
    expect(lastApiCall()).toEqual([
      '/auth/register',
      {
        method: 'POST',
        body: {
          email: 'rita@example.com',
          password: 'password123',
          displayName: 'Rita',
        },
      },
    ]);

    const googleSession = {
      user: {
        id: 'user-1',
        workspaceId: 'workspace-1',
        email: 'rita@example.com',
        displayName: 'Rita',
        role: 'owner',
        planType: 'free',
        createdAt: '2026-07-21T12:00:00.000Z',
        updatedAt: '2026-07-21T12:00:00.000Z',
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-07-21T13:00:00.000Z',
    };
    const googleRequestController = new AbortController();
    apiRequestMock.mockResolvedValueOnce(googleSession);

    await signInWithGoogleIdToken(
      { idToken: 'google-id-token' },
      googleRequestController.signal
    );
    expect(lastApiCall()).toEqual([
      '/auth/google',
      {
        method: 'POST',
        body: { idToken: 'google-id-token' },
        signal: googleRequestController.signal,
      },
    ]);

    await refreshSession({ refreshToken: 'refresh-token' });
    expect(lastApiCall()).toEqual([
      '/auth/refresh',
      {
        method: 'POST',
        body: { refreshToken: 'refresh-token' },
        skipAuthRefresh: true,
      },
    ]);

    await getCurrentUser();
    expect(lastApiCall()).toEqual(['/auth/me', { requiresAuth: true }]);

    await signOut('refresh-token');
    expect(lastApiCall()).toEqual([
      '/auth/sign-out',
      {
        method: 'POST',
        body: { refreshToken: 'refresh-token' },
        requiresAuth: true,
        skipAuthRefresh: true,
      },
    ]);

    await requestPasswordReset({ email: 'rita@example.com' });
    expect(lastApiCall()).toEqual([
      '/auth/password-reset/request',
      {
        method: 'POST',
        body: { email: 'rita@example.com' },
      },
    ]);

    await confirmPasswordReset({
      token: 'reset-token',
      password: 'newpass123',
    });
    expect(lastApiCall()).toEqual([
      '/auth/password-reset/confirm',
      {
        method: 'POST',
        body: { token: 'reset-token', password: 'newpass123' },
      },
    ]);
  });

  it('rejects malformed Google session responses', async () => {
    apiRequestMock.mockResolvedValueOnce({
      user: { id: 'user-1' },
      accessToken: 'access-token',
    });

    await expect(
      signInWithGoogleIdToken({ idToken: 'google-id-token' })
    ).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'invalid_auth_response',
    });
  });
});

describe('meetingsApi', () => {
  it('calls expected meeting endpoints', async () => {
    apiRequestMock.mockResolvedValueOnce({
      meetings: [],
      activeMeetingId: null,
      draftSavedAt: null,
      syncedAt: '2026-06-13T12:00:00.000Z',
    } as never);
    await listMeetings();
    expect(lastApiCall()).toEqual(['/meetings/', { requiresAuth: true }]);

    const syncPayload = {
      meetings: [],
      activeMeetingId: null,
      draftSavedAt: null,
      clientUpdatedAt: '2026-06-13T12:00:00.000Z',
    };

    apiRequestMock.mockResolvedValueOnce({
      meetings: [],
      activeMeetingId: null,
      draftSavedAt: null,
      conflicts: [],
      syncedAt: '2026-06-13T12:00:00.000Z',
    } as never);
    await syncMeetingsApi(syncPayload);
    expect(lastApiCall()).toEqual([
      '/meetings/sync',
      {
        method: 'POST',
        body: syncPayload,
        requiresAuth: true,
      },
    ]);

    const summary = {
      id: 'summary-1',
      meetingId: 'meeting-1',
      shortSummary: 'A short summary.',
      mainTopics: [],
      keyTensions: [],
      agreements: [],
      tasks: [],
      suggestedNextMeetingFocus: [],
      createdAt: '2026-06-13T12:00:00.000Z',
    };

    await saveMeetingSummary({ meetingId: 'meeting-1', summary });
    expect(lastApiCall()).toEqual([
      '/meetings/meeting-1/summary',
      {
        method: 'PUT',
        body: { summary },
        requiresAuth: true,
      },
    ]);
  });

  it('normalizes missing meeting response arrays and nullable fields', async () => {
    apiRequestMock.mockResolvedValueOnce({
      meetings: null,
      activeMeetingId: undefined,
      draftSavedAt: undefined,
      syncedAt: undefined,
    } as never);

    const listResponse = await listMeetings();

    expect(listResponse.meetings).toEqual([]);
    expect(listResponse.activeMeetingId).toBeNull();
    expect(listResponse.draftSavedAt).toBeNull();
    expect(listResponse.syncedAt).toEqual(expect.any(String));

    apiRequestMock.mockResolvedValueOnce({
      meetings: null,
      activeMeetingId: undefined,
      draftSavedAt: undefined,
      conflicts: null,
      syncedAt: undefined,
    } as never);

    const syncResponse = await syncMeetingsApi({
      meetings: [],
      activeMeetingId: null,
      draftSavedAt: null,
      clientUpdatedAt: '2026-06-13T12:00:00.000Z',
    });

    expect(syncResponse.meetings).toEqual([]);
    expect(syncResponse.conflicts).toEqual([]);
    expect(syncResponse.activeMeetingId).toBeNull();
    expect(syncResponse.draftSavedAt).toBeNull();
  });
});

describe('tasksApi', () => {
  it('calls expected task endpoints', async () => {
    apiRequestMock.mockResolvedValue({
      tasks: [],
      agreements: [],
      reviewDecisions: [],
      conflicts: [],
      syncedAt: '2026-06-13T12:00:00.000Z',
    } as never);

    await listTasks();
    expect(lastApiCall()).toEqual(['/tasks/', { requiresAuth: true }]);

    const syncPayload = {
      tasks: [],
      agreements: [],
      reviewDecisions: [],
      clientUpdatedAt: '2026-06-13T12:00:00.000Z',
    };

    await syncTasksApi(syncPayload);
    expect(lastApiCall()).toEqual([
      '/tasks/sync',
      {
        method: 'POST',
        body: syncPayload,
        requiresAuth: true,
      },
    ]);
  });

  it('normalizes missing task response arrays', async () => {
    apiRequestMock.mockResolvedValueOnce({
      tasks: null,
      agreements: null,
      reviewDecisions: null,
      conflicts: null,
      syncedAt: undefined,
    } as never);

    const response = await listTasks();

    expect(response.tasks).toEqual([]);
    expect(response.agreements).toEqual([]);
    expect(response.reviewDecisions).toEqual([]);
    expect(response.conflicts).toEqual([]);
    expect(response.syncedAt).toEqual(expect.any(String));
  });
});

describe('subscriptionsApi', () => {
  it('calls expected subscription endpoints', async () => {
    await getSubscriptionStatus();
    expect(lastApiCall()).toEqual([
      '/subscriptions/status',
      { requiresAuth: true },
    ]);

    await restoreSubscriptionStatus({ provider: 'google_play' });
    expect(lastApiCall()).toEqual([
      '/subscriptions/restore',
      {
        method: 'POST',
        body: { provider: 'google_play' },
        requiresAuth: true,
      },
    ]);

    await getSubscriptionManagementUrl();
    expect(lastApiCall()).toEqual([
      '/subscriptions/manage',
      { requiresAuth: true },
    ]);
  });
});

describe('aiApi', () => {
  it('calls the backend AI summary endpoint', async () => {
    const signal = new AbortController().signal;

    await generateAiMeetingSummary(
      { meetingId: 'meeting-1', locale: 'en' },
      { signal }
    );

    expect(lastApiCall()).toEqual([
      '/ai/meeting-summary',
      {
        method: 'POST',
        body: { meetingId: 'meeting-1', locale: 'en' },
        requiresAuth: true,
        signal,
      },
    ]);
  });
});

describe('calendarApi', () => {
  it('calls expected calendar endpoints', async () => {
    await getGoogleCalendarConnectionStatus();
    expect(lastApiCall()).toEqual([
      '/calendar/google/status',
      { requiresAuth: true },
    ]);

    await startGoogleCalendarConnection({
      redirectUrl: 'ourweek://calendar/google/callback',
    });
    expect(lastApiCall()).toEqual([
      '/calendar/google/connect',
      {
        method: 'POST',
        body: { redirectUrl: 'ourweek://calendar/google/callback' },
        requiresAuth: true,
      },
    ]);

    await disconnectGoogleCalendar();
    expect(lastApiCall()).toEqual([
      '/calendar/google/disconnect',
      { method: 'POST', requiresAuth: true },
    ]);

    await syncGoogleCalendarMeetingReminder({
      meetingId: 'meeting-1',
      title: 'Weekly check-in',
    });
    expect(lastApiCall()).toEqual([
      '/calendar/google/meeting-reminders',
      {
        method: 'POST',
        body: { meetingId: 'meeting-1', title: 'Weekly check-in' },
        requiresAuth: true,
      },
    ]);

    await syncGoogleCalendarTaskDueDate({
      taskId: 'task-1',
      title: 'Buy shoes',
    });
    expect(lastApiCall()).toEqual([
      '/calendar/google/task-due-dates',
      {
        method: 'POST',
        body: { taskId: 'task-1', title: 'Buy shoes' },
        requiresAuth: true,
      },
    ]);

    await syncGoogleCalendarFollowUpDate({
      followUpId: 'follow-up-1',
      title: 'Review unfinished task',
      sourceMeetingId: 'meeting-1',
    });
    expect(lastApiCall()).toEqual([
      '/calendar/google/follow-up-dates',
      {
        method: 'POST',
        body: {
          followUpId: 'follow-up-1',
          title: 'Review unfinished task',
          sourceMeetingId: 'meeting-1',
        },
        requiresAuth: true,
      },
    ]);
  });
});

describe('workspaceApi', () => {
  it('calls expected workspace endpoints', async () => {
    await getWorkspace();
    expect(lastApiCall()).toEqual(['/workspace', { requiresAuth: true }]);

    await updateWorkspace({ name: 'Our home' });
    expect(lastApiCall()).toEqual([
      '/workspace',
      {
        method: 'PUT',
        body: { name: 'Our home' },
        requiresAuth: true,
      },
    ]);

    await createWorkspaceInvitation({
      email: 'partner@example.com',
      role: 'adult_member',
    });
    expect(lastApiCall()).toEqual([
      '/workspace/invitations',
      {
        method: 'POST',
        body: { email: 'partner@example.com', role: 'adult_member' },
        requiresAuth: true,
      },
    ]);

    await updateWorkspaceMember('user-1', { role: 'adult_member' });
    expect(lastApiCall()).toEqual([
      '/workspace/members/user-1',
      {
        method: 'PUT',
        body: { role: 'adult_member' },
        requiresAuth: true,
      },
    ]);

    await removeWorkspaceMember('user-1');
    expect(lastApiCall()).toEqual([
      '/workspace/members/user-1',
      { method: 'DELETE', requiresAuth: true },
    ]);

    await revokeWorkspaceInvitation('invite /1');
    expect(lastApiCall()).toEqual([
      '/workspace/invitations/invite%20%2F1',
      { method: 'DELETE', requiresAuth: true },
    ]);
  });
});

describe('accountApi', () => {
  it('calls expected account endpoints', async () => {
    await exportAccountData();
    expect(lastApiCall()).toEqual(['/account/export', { requiresAuth: true }]);

    await deleteAccount();
    expect(lastApiCall()).toEqual([
      '/account/',
      { method: 'DELETE', requiresAuth: true },
    ]);
  });
});
