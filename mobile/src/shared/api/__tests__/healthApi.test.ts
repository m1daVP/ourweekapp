import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '@/shared/config/env';

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function loadHealthApi(config: AppConfig = enabledConfig) {
  vi.resetModules();
  vi.doMock('@/shared/config/env', () => ({ appConfig: config }));

  return import('@/shared/api/healthApi');
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('healthApi', () => {
  it('calls the unversioned health endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: 'ok', uptime: 12 }));
    vi.stubGlobal('fetch', fetchMock);
    const { getHealthStatus } = await loadHealthApi();

    await expect(getHealthStatus()).resolves.toEqual({
      state: 'reachable',
      httpStatus: 200,
      data: { status: 'ok', uptime: 12 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/health',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('clears the timeout after successful requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: 'ok', uptime: 12 }));
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    vi.stubGlobal('fetch', fetchMock);
    const { getHealthStatus } = await loadHealthApi();

    await expect(getHealthStatus()).resolves.toMatchObject({
      state: 'reachable',
    });
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('treats readiness 200 as reachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: 'ok',
          uptime: 12,
          checks: { database: 'ok' },
        })
      )
    );
    const { getReadinessStatus } = await loadHealthApi();

    await expect(getReadinessStatus()).resolves.toEqual({
      state: 'reachable',
      httpStatus: 200,
      data: {
        status: 'ok',
        uptime: 12,
        checks: { database: 'ok' },
      },
    });
  });

  it('treats readiness 503 as reachable but not ready', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            status: 'error',
            uptime: 12,
            checks: { database: 'error' },
          },
          503
        )
      )
    );
    const { getReadinessStatus } = await loadHealthApi();

    await expect(getReadinessStatus()).resolves.toEqual({
      state: 'not_ready',
      httpStatus: 503,
      data: {
        status: 'error',
        uptime: 12,
        checks: { database: 'error' },
      },
    });
  });

  it('returns unreachable for network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { getHealthStatus } = await loadHealthApi();

    await expect(getHealthStatus()).resolves.toEqual({
      state: 'unreachable',
    });
  });

  it('aborts stalled health checks and returns unreachable', async () => {
    vi.useFakeTimers();
    const { getHealthStatus, HEALTH_CHECK_TIMEOUT_MS } = await loadHealthApi();
    const fetchMock = vi.fn((_url: string, options: RequestInit) => {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = getHealthStatus();
    await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS);

    await expect(request).resolves.toEqual({
      state: 'unreachable',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });
});
