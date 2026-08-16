/** Shift an ISO calendar date without allowing the browser timezone to change the day. */
export function shiftIsoDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}
