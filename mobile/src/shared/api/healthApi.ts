import { appConfig } from '@/shared/config/env';

export const HEALTH_CHECK_TIMEOUT_MS = 5000;

export type ReadinessCheckStatus = 'ok' | 'error' | 'unknown';

export interface HealthStatusDto {
  status: 'ok';
  uptime: number;
}

export interface ReadinessStatusDto {
  status: 'ok' | 'error';
  uptime: number;
  checks: Record<string, ReadinessCheckStatus>;
}

export type HealthCheckState =
  | 'not_configured'
  | 'reachable'
  | 'not_ready'
  | 'unreachable';

export interface HealthCheckResult<TData> {
  state: HealthCheckState;
  httpStatus?: number;
  data?: TData;
}

function createHealthUrl(path: string) {
  if (!appConfig.isBackendApiEnabled || !appConfig.apiBaseUrl) {
    return null;
  }

  return `${appConfig.apiBaseUrl}${path}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toReadinessCheckStatus(value: unknown): ReadinessCheckStatus {
  if (value === 'ok' || value === 'error') {
    return value;
  }

  return 'unknown';
}

function normalizeHealthStatus(value: unknown): HealthStatusDto | undefined {
  if (!isRecord(value) || value.status !== 'ok') {
    return undefined;
  }

  return {
    status: 'ok',
    uptime: typeof value.uptime === 'number' ? value.uptime : 0,
  };
}

function normalizeReadinessStatus(
  value: unknown
): ReadinessStatusDto | undefined {
  if (!isRecord(value) || (value.status !== 'ok' && value.status !== 'error')) {
    return undefined;
  }

  const checks = isRecord(value.checks)
    ? Object.fromEntries(
        Object.entries(value.checks).map(([key, entry]) => [
          key,
          toReadinessCheckStatus(entry),
        ])
      )
    : {};

  return {
    status: value.status,
    uptime: typeof value.uptime === 'number' ? value.uptime : 0,
    checks,
  };
}

async function readJson(response: Response) {
  const contentType = response.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    return null;
  }

  return (await response.json()) as unknown;
}

async function requestHealthEndpoint<TData>(
  path: string,
  normalize: (value: unknown) => TData | undefined,
  options: {
    notReadyStatus?: number;
  } = {}
): Promise<HealthCheckResult<TData>> {
  const url = createHealthUrl(path);

  if (!url) {
    return { state: 'not_configured' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, HEALTH_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const body = await readJson(response);
    const data = normalize(body);

    if (response.status === options.notReadyStatus) {
      return {
        state: 'not_ready',
        httpStatus: response.status,
        data,
      };
    }

    if (!response.ok || !data) {
      return {
        state: 'unreachable',
        httpStatus: response.status,
      };
    }

    return {
      state: 'reachable',
      httpStatus: response.status,
      data,
    };
  } catch {
    return { state: 'unreachable' };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getHealthStatus() {
  return requestHealthEndpoint('/health', normalizeHealthStatus);
}

export function getLivenessStatus() {
  return requestHealthEndpoint('/health/live', normalizeHealthStatus);
}

export function getReadinessStatus() {
  return requestHealthEndpoint('/health/ready', normalizeReadinessStatus, {
    notReadyStatus: 503,
  });
}

export async function getBackendHealthSummary() {
  const [health, liveness, readiness] = await Promise.all([
    getHealthStatus(),
    getLivenessStatus(),
    getReadinessStatus(),
  ]);

  return {
    health,
    liveness,
    readiness,
  };
}
