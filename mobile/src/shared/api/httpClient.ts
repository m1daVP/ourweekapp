import { appConfig } from '@/shared/config/env';
import { translate } from '@/features/localization/i18n';
import { debugSafely } from '@/shared/services/safeLogService';

const API_VERSION_PREFIX = '/v1';

export type ApiRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: ApiRequestMethod;
  body?: unknown;
  headers?: Record<string, string>;
  authToken?: string;
  requiresAuth?: boolean;
  skipAuthRefresh?: boolean;
  signal?: AbortSignal;
}

interface ApiErrorBody {
  message?: string;
  code?: string;
  details?: unknown;
}

interface ApiClientErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
  requestId?: string;
}

interface ApiAuthHandlers {
  getAccessToken: () => Promise<string | null> | string | null;
  refreshSession?: () => Promise<string | null> | string | null;
  onUnauthorized?: () => Promise<void> | void;
}

let authHandlers: ApiAuthHandlers | null = null;

export class ApiClientError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  requestId?: string;

  constructor(message: string, options: ApiClientErrorOptions = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

export function setApiAuthHandlers(handlers: ApiAuthHandlers | null) {
  authHandlers = handlers;
}

async function getRequestAuthToken(options: ApiRequestOptions) {
  if (options.authToken) {
    return options.authToken;
  }

  if (!options.requiresAuth) {
    return null;
  }

  return (await authHandlers?.getAccessToken()) ?? null;
}

function createVersionedPath(path: string) {
  const normalizedPath = `/${path.replace(/^\/+/, '')}`;

  if (normalizedPath === API_VERSION_PREFIX) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith(`${API_VERSION_PREFIX}/`)) {
    return normalizedPath;
  }

  return `${API_VERSION_PREFIX}${normalizedPath}`;
}

function createUrl(path: string) {
  return `${appConfig.apiBaseUrl}${createVersionedPath(path)}`;
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    return null;
  }

  return (await response.json()) as unknown;
}

async function sendApiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {}
) {
  const requestPath = createVersionedPath(path);
  const requestMethod = options.method ?? 'GET';
  const startedAt = Date.now();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  const requestOptions: RequestInit = {
    method: requestMethod,
    headers,
    signal: options.signal,
  };

  const authToken = await getRequestAuthToken(options);

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestOptions.body = JSON.stringify(options.body);
  }

  debugSafely('API request started.', {
    path: requestPath,
  });

  let response: Response;

  try {
    response = await fetch(createUrl(path), requestOptions);
  } catch (error) {
    debugSafely('API request failed.', {
      durationMs: Date.now() - startedAt,
      errorCategory: error instanceof Error ? error.name : 'UnknownError',
      path: requestPath,
    });
    throw error;
  }

  debugSafely('API request finished.', {
    durationMs: Date.now() - startedAt,
    errorCategory: response.ok ? 'none' : 'http_error',
    path: requestPath,
    status: response.status,
  });

  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    const errorBody = responseBody as ApiErrorBody | null;

    throw new ApiClientError(
      errorBody?.message ?? translate('api.backendContactFailed'),
      {
        status: response.status,
        code: errorBody?.code,
        details: errorBody?.details,
        requestId: response.headers.get('x-request-id') ?? undefined,
      }
    );
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return responseBody as TResponse;
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<TResponse> {
  try {
    return await sendApiRequest<TResponse>(path, options);
  } catch (error) {
    const shouldRefresh =
      options.requiresAuth &&
      !options.skipAuthRefresh &&
      error instanceof ApiClientError &&
      error.status === 401 &&
      authHandlers?.refreshSession;

    if (!shouldRefresh) {
      throw error;
    }

    const refreshedToken = await authHandlers.refreshSession?.();

    if (!refreshedToken) {
      await authHandlers.onUnauthorized?.();
      throw error;
    }

    return sendApiRequest<TResponse>(path, {
      ...options,
      authToken: refreshedToken,
      skipAuthRefresh: true,
    });
  }
}
