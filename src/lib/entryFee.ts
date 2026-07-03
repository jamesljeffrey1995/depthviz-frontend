/**
 * A competition's entry fee is a free-form string an organiser types (e.g.
 * "£20", "25", "Free"). When it denotes no cost, the paid/unpaid tracking is
 * meaningless — there is nothing to collect — so the admin UI hides every
 * paid/unpaid affordance for the event.
 *
 * A fee counts as free when it is explicitly zero ("0", "£0.00", "$0") or the
 * word "free". A blank/unset fee is treated as *unspecified* rather than free:
 * organisers who collect cash on the day often leave the field empty, so the
 * paid tracking stays visible for them.
 */
export function isFreeEntry(entryFee: string | null | undefined): boolean {
  if (entryFee == null) return false
  const trimmed = entryFee.trim()
  if (!trimmed) return false
  if (/^free$/i.test(trimmed)) return true
  // Strip currency symbols, thousands separators and whitespace, then check
  // whether what remains is a number equal to zero.
  const numeric = trimmed.replace(/[£$€,\s]/g, '')
  if (numeric === '') return false
  const n = Number(numeric)
  return Number.isFinite(n) && n === 0
}
