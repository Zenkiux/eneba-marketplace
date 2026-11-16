/** Base path for every API call. Vite proxies it in dev; Vercel rewrites it in production. */
export const API_BASE = '/api'

export type ApiErrorDetails = Record<string, unknown>

/** Error thrown for any non-2xx response (or a network failure, status 0). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiErrorDetails | undefined

  constructor(status: number, code: string, message: string, details?: ApiErrorDetails) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  /** Serialised as JSON. */
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

interface ErrorEnvelope {
  error: { code?: unknown; message?: unknown; details?: unknown }
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'object' &&
    (value as { error: unknown }).error !== null
  )
}

function toApiError(status: number, statusText: string, payload: unknown): ApiError {
  if (isErrorEnvelope(payload)) {
    const { code, message, details } = payload.error
    return new ApiError(
      status,
      typeof code === 'string' ? code : 'unknown_error',
      typeof message === 'string' ? message : statusText || 'Request failed',
      typeof details === 'object' && details !== null ? (details as ApiErrorDetails) : undefined,
    )
  }
  return new ApiError(status, 'unknown_error', statusText || `Request failed with status ${status}`)
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text === '') return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/**
 * Typed JSON request against the API. `path` is relative to {@link API_BASE}, e.g. `/healthz`.
 * The response type is not validated at runtime; callers own the contract.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, signal } = options
  const finalHeaders: Record<string, string> = { Accept: 'application/json', ...headers }
  const init: RequestInit = { method, credentials: 'same-origin', headers: finalHeaders, signal }

  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, init)
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError(0, 'network_error', 'Could not reach the server')
  }

  const payload = await readJson(response)
  if (!response.ok) throw toApiError(response.status, response.statusText, payload)
  return payload as T
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}
