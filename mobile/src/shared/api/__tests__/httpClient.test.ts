import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '@/shared/config/env';

const enabledConfig: AppConfig = {
  apiBaseUrl: 'http://api.test',
  apiMode: 'backend',
  appEnvironment: 'local',
  isBackendApiEnabled: true,
  isGoogleCalendarSyncEnabled: true,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function emptyResponse(status = 204) {
  return new Response(null, { status });
}

async function loadHttpClient(config: AppConfig = enabledConfig) {
  vi.resetModules();
  vi.doMock('@/shared/config/env', () => ({ appConfig: config }));
  vi.doMock('@/features/localization/i18n', () => ({
    translate: (key: string) => key,
  }));

  return import('@/shared/api/httpClient');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('prefixes paths with /v1 and sends JSON requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest } = await loadHttpClient();

    await apiRequest('/auth/sign-in', {
      method: 'POST',
      body: { email: 'rita@example.com' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/v1/auth/sign-in',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'rita@example.com' }),
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('does not duplicate the /v1 prefix', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest } = await loadHttpClient();

    await apiRequest('/v1/auth/me');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/v1/auth/me',
      expect.any(Object)
    );
  });

  it('attaches bearer tokens for authenticated requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest, setApiAuthHandlers } = await loadHttpClient();

    setApiAuthHandlers({
      getAccessToken: () => 'access-token',
    });

    await apiRequest('/auth/me', { requiresAuth: true });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      })
    );
  });

  it('refreshes once on 401 and retries with the refreshed token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ message: 'Expired', code: 'expired', details: {} }, 401)
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest, setApiAuthHandlers } = await loadHttpClient();
    const refreshSession = vi.fn().mockResolvedValue('new-token');

    setApiAuthHandlers({
      getAccessToken: () => 'old-token',
      refreshSession,
    });

    await expect(
      apiRequest('/auth/me', { requiresAuth: true })
    ).resolves.toEqual({ ok: true });

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer old-token',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer new-token',
        }),
      })
    );
  });

  it('calls unauthorized cleanup when 401 refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ message: 'Unauthorized', code: 'unauthorized' }, 401)
      );
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest, setApiAuthHandlers } = await loadHttpClient();
    const onUnauthorized = vi.fn();

    setApiAuthHandlers({
      getAccessToken: () => 'old-token',
      refreshSession: () => null,
      onUnauthorized,
    });

    await expect(
      apiRequest('/auth/me', { requiresAuth: true })
    ).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([403, 409, 422, 500])(
    'does not refresh for %s responses',
    async (status) => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse(
          {
            message: 'Request failed',
            code: `status_${status}`,
            details: { status },
          },
          status
        )
      );
      vi.stubGlobal('fetch', fetchMock);
      const { apiRequest, setApiAuthHandlers } = await loadHttpClient();
      const refreshSession = vi.fn().mockResolvedValue('new-token');

      setApiAuthHandlers({
        getAccessToken: () => 'old-token',
        refreshSession,
      });

      await expect(
        apiRequest('/auth/me', { requiresAuth: true })
      ).rejects.toMatchObject({
        status,
        code: `status_${status}`,
        details: { status },
      });
      expect(refreshSession).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it('maps structured backend errors into ApiClientError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          message: 'Validation failed',
          code: 'validation_failed',
          details: { email: ['Required'] },
        },
        422
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest, ApiClientError } = await loadHttpClient();

    const request = apiRequest('/auth/sign-in');

    await expect(request).rejects.toBeInstanceOf(ApiClientError);
    await expect(request).rejects.toMatchObject({
      status: 422,
      code: 'validation_failed',
      details: { email: ['Required'] },
    });
  });

  it('handles 204 responses as undefined', async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse());
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest } = await loadHttpClient();

    await expect(apiRequest('/auth/sign-out')).resolves.toBeUndefined();
  });

  it('reports backend_unavailable when backend mode is not configured', async () => {
    const { apiRequest } = await loadHttpClient({
      ...enabledConfig,
      apiBaseUrl: null,
      isBackendApiEnabled: false,
    });

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({
      code: 'backend_unavailable',
    });
  });
});
