interface AuthErrorLike {
  message?: string
  status?: number
}

export function getAuthErrorMessage(error: unknown): string {
  if (
    typeof error === 'object'
    && error !== null
    && (
      (error as AuthErrorLike).status === 429
      || /rate limit/i.test((error as AuthErrorLike).message ?? '')
    )
  ) {
    return 'Too many sign-in emails have been requested. Please wait a few minutes and try again.'
  }

  return error instanceof Error ? error.message : 'Failed to send link'
}
