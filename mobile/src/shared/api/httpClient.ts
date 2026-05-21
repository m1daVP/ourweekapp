import { appConfig } from '@/shared/config/env'

export type ApiRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiRequestOptions {
  method?: ApiRequestMethod
  body?: unknown
  headers?: Record<string, string>
  authToken?: string
  signal?: AbortSignal
}

interface ApiErrorBody {
  message?: string
  code?: string
  details?: unknown
}

interface ApiClientErrorOptions {
  status?: number
  code?: string
  details?: unknown
}

export class ApiClientError extends Error {
  status?: number
  code?: string
  details?: unknown

  constructor(message: string, options: ApiClientErrorOptions = {}) {
    super(message)
    this.name = 'ApiClientError'
    this.status = options.status
    this.code = options.code
    this.details = options.details
  }
}

export function isBackendApiConfigured() {
  return appConfig.isBackendApiEnabled
}

function createUrl(path: string) {
  if (!appConfig.apiBaseUrl) {
    throw new ApiClientError('Backend API is not configured.', {
      code: 'backend_unavailable',
    })
  }

  return `${appConfig.apiBaseUrl}/${path.replace(/^\/+/, '')}`
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get('content-type')

  if (!contentType?.includes('application/json')) {
    return null
  }

  return (await response.json()) as unknown
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  if (!isBackendApiConfigured()) {
    throw new ApiClientError('Backend API is not configured.', {
      code: 'backend_unavailable',
    })
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  }

  const requestOptions: RequestInit = {
    method: options.method ?? 'GET',
    headers,
    signal: options.signal,
  }

  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    requestOptions.body = JSON.stringify(options.body)
  }

  const response = await fetch(createUrl(path), requestOptions)
  const responseBody = await readResponseBody(response)

  if (!response.ok) {
    const errorBody = responseBody as ApiErrorBody | null

    throw new ApiClientError(
      errorBody?.message ??
        'Something went wrong while contacting the backend.',
      {
        status: response.status,
        code: errorBody?.code,
        details: errorBody?.details,
      },
    )
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return responseBody as TResponse
}
