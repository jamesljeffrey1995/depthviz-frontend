import { ApiError, AuthError, RateLimitError, ServerError } from './api'

export type ErrorContext = 'forecast' | 'report' | 'profile' | 'map' | 'generic'

export interface UserFacingError {
  message: string
  status: number | null
  requiresAuth: boolean
  retryable: boolean
  telemetryCode: 'auth' | 'rate_limit' | 'server' | 'network' | 'unknown'
}

const CONTEXT_PREFIX: Record<ErrorContext, string> = {
  forecast: 'Could not load forecast',
  report: 'Could not submit report',
  profile: 'Could not update profile',
  map: 'Could not update map data',
  generic: 'Something went wrong',
}

function fallbackMessage(context: ErrorContext): string {
  return `${CONTEXT_PREFIX[context]} — please try again.`
}

export function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError'
}

export function toUserFacingError(error: unknown, context: ErrorContext = 'generic'): UserFacingError {
  if (error instanceof AuthError || (error instanceof ApiError && error.status === 401)) {
    return {
      message: 'Your session has expired. Please sign in again.',
      status: 401,
      requiresAuth: true,
      retryable: false,
      telemetryCode: 'auth',
    }
  }

  if (error instanceof RateLimitError) {
    const wait = error.retryAfterSeconds
    const suffix = wait && wait > 0 ? ` Try again in ${wait}s.` : ' Please wait a moment and try again.'
    return {
      message: `${error.message || 'Too many requests.'}${suffix}`,
      status: 429,
      requiresAuth: false,
      retryable: true,
      telemetryCode: 'rate_limit',
    }
  }

  if (error instanceof ServerError || (error instanceof ApiError && error.status >= 500)) {
    return {
      message: error instanceof Error && error.message ? error.message : fallbackMessage(context),
      status: error instanceof ApiError ? error.status : null,
      requiresAuth: false,
      retryable: true,
      telemetryCode: 'server',
    }
  }

  if (error instanceof ApiError) {
    return {
      message: error.message || fallbackMessage(context),
      status: error.status,
      requiresAuth: false,
      retryable: error.status >= 500 || error.status === 429,
      telemetryCode: 'unknown',
    }
  }

  if (error instanceof Error) {
    // A failed fetch usually appears as TypeError in browsers.
    const isLikelyNetwork = error.name === 'TypeError' || /network|fetch/i.test(error.message)
    return {
      message: isLikelyNetwork ? 'Network issue — check your connection and try again.' : (error.message || fallbackMessage(context)),
      status: null,
      requiresAuth: false,
      retryable: true,
      telemetryCode: isLikelyNetwork ? 'network' : 'unknown',
    }
  }

  return {
    message: fallbackMessage(context),
    status: null,
    requiresAuth: false,
    retryable: true,
    telemetryCode: 'unknown',
  }
}
