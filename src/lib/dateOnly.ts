/** Return a validated YYYY-MM-DD from a date-only value or ISO timestamp. */
export function normalizeIsoDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return null
  const candidate = `${match[1]}-${match[2]}-${match[3]}`
  const parsed = new Date(`${candidate}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate
    ? candidate
    : null
}

/** Shift an ISO calendar date without allowing the browser timezone to change the day. */
export function shiftIsoDate(date: string, days: number): string {
  const normalized = normalizeIsoDate(date)
  if (!normalized) return date
  const parsed = new Date(`${normalized}T00:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}
