/**
 * A competition's entry fee is a free-form string an organiser types (e.g.
 * "£20", "25", "Free"). When it denotes no cost, the paid/unpaid tracking is
 * meaningless — there is nothing to collect — so the admin UI hides every
 * paid/unpaid affordance for the event.
 *
 * A fee counts as free when its leading amount is zero ("0", "£0.00", "$0",
 * "£0 per person") or it begins with the word "free". The field is free text
 * whose placeholder suggests a "£20 per person" style, so we read only the
 * leading amount — a "per person" suffix must not hide a zero-cost event. A
 * blank/unset fee is treated as *unspecified* rather than free: organisers who
 * collect cash on the day often leave the field empty, so the paid tracking
 * stays visible for them.
 */
export function isFreeEntry(entryFee: string | null | undefined): boolean {
  if (entryFee == null) return false
  const trimmed = entryFee.trim()
  if (!trimmed) return false
  if (/^free\b/i.test(trimmed)) return true
  // Read the leading amount after any currency symbol, so trailing text like
  // "per person" doesn't stop a £0 fee being recognised as free.
  const amount = trimmed.replace(/^[£$€\s]+/, '').match(/^\d[\d,]*(?:\.\d+)?/)
  if (!amount) return false
  return Number(amount[0].replace(/,/g, '')) === 0
}
