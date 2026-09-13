import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '@/shared/config/env';

const debugSafely = vi.hoisted(() => vi.fn());
const activeLocale = vi.hoisted(() => ({ value: 'en' as 'en' | 'uk' | 'es' }));

const enabledConfig: AppConfig = {
  apiBaseUrl: 'http://api.test',
  appEnvironment: 'local',
  revenueCatAndroidApiKey: null,
  revenueCatIosApiKey: null,
  revenueCatEntitlementId: 'OurWeek Premium',
  revenueCatCurrentOfferingId: 'default',
  revenueCatAndroidMonthlyProductId: 'monthly',
  revenueCatAndroidYearlyProductId: 'yearly',
  isRevenueCatEnabled: false,
};

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function emptyResponse(status = 204) {
  return new Response(null, { status });
}

async function loadHttpClient(config: AppConfig = enabledConfig) {
  vi.resetModules();
  vi.doMock('@/shared/config/env', () => ({ appConfig: config }));
  vi.doMock('@/features/localization/i18n', () => ({
    i18n: { global: { locale: activeLocale } },
    translate: (key: string) => key,
  }));
  vi.doMock('@/shared/services/safeLogService', () => ({
    debugSafely,
  }));

  return import('@/shared/api/httpClient');
}

afterEach(() => {
  activeLocale.value = 'en';
  debugSafely.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('returns an authenticated PDF Blob and preserves content disposition', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="weekly.pdf"',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequestBlob, setApiAuthHandlers } = await loadHttpClient();
    setApiAuthHandlers({ getAccessToken: () => 'access-token' });

    const result = await apiRequestBlob('/exports/meeting/pdf', {
      method: 'POST',
      body: { meetingId: 'meeting-1' },
      requiresAuth: true,
    });

    expect(result.blob.type).toBe('application/pdf');
    expect(result.contentDisposition).toContain('filename="weekly.pdf"');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/v1/exports/meeting/pdf',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      })
    );
  });

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
          'Accept-Language': 'en',
          'Content-Type': 'application/json',
        }),
      })
    );
    expect(debugSafely).toHaveBeenCalledWith('API request started.', {
      path: '/v1/auth/sign-in',
    });
    expect(debugSafely).toHaveBeenCalledWith(
      'API request finished.',
      expect.objectContaining({
        errorCategory: 'none',
        path: '/v1/auth/sign-in',
        status: 200,
      })
    );
    expect(JSON.stringify(debugSafely.mock.calls)).not.toContain(
      'rita@example.com'
    );
  });

  it.each(['en', 'uk', 'es'] as const)(
    'sends %s as Accept-Language',
    async (locale) => {
      activeLocale.value = locale;
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      vi.stubGlobal('fetch', fetchMock);
      const { apiRequest } = await loadHttpClient();

      await apiRequest('/auth/me');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://api.test/v1/auth/me',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Accept-Language': locale }),
        })
      );
    }
  );

  it('preserves an explicit Accept-Language header from the caller', async () => {
    activeLocale.value = 'uk';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest } = await loadHttpClient();

    await apiRequest('/auth/me', { headers: { 'Accept-Language': 'es' } });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/v1/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Accept-Language': 'es' }),
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
      requestId: undefined,
    });
  });

  it('keeps the safe backend request ID on a structured HTTP error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          message: 'Please try again.',
          code: 'ai_summary_generation_failed',
        },
        503,
        { 'x-request-id': 'req_mobile_support_123' }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest } = await loadHttpClient();

    await expect(apiRequest('/ai/meeting-summary')).rejects.toMatchObject({
      status: 503,
      code: 'ai_summary_generation_failed',
      requestId: 'req_mobile_support_123',
    });
  });

  it('handles 204 responses as undefined', async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse());
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest } = await loadHttpClient();

    await expect(apiRequest('/auth/sign-out')).resolves.toBeUndefined();
  });
});
