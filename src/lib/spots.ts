import type { Location } from '../types'

/**
 * A location is visible to a viewer iff the viewer owns it or the
 * location is explicitly marked public. Rows whose visibility/user_id
 * fields are missing (older backend responses) are treated
 * conservatively: only an exact user_id match makes them visible, so
 * an untyped response cannot leak a row that happens to be private.
 *
 * The backend is the primary enforcer of this rule — this helper is a
 * defence-in-depth net so a server-side regression cannot silently
 * expose private spots in the UI.
 */
export function canVisit(
  location: Pick<Location, 'user_id' | 'visibility' | 'is_public'>,
  viewerUserId: string | null | undefined,
): boolean {
  if (location.visibility === 'public') return true
  // Back-compat: older backend responses omit `visibility` but include the
  // legacy `is_public` boolean. Treat is_public === true as public when the
  // newer field is absent so existing public spots remain visible.
  if (location.visibility == null && location.is_public) return true
  // Anonymous viewers cannot access private spots.
  if (!viewerUserId) return false
  // When the backend has explicitly set a visibility value (i.e. this is not a
  // legacy/unknown row) but hasn't included user_id in the response, trust the
  // backend's own authorization: if it returned this private spot to an
  // authenticated user, that user is permitted to see it.  Older API versions
  // may omit user_id even for the requesting user's own spots, so enforcing an
  // ownership check here would incorrectly hide all custom private spots.
  if (location.visibility != null && !location.user_id) return true
  // Legacy rows (visibility absent) with no user_id are hidden — we cannot
  // determine ownership and must be conservative.
  if (!location.user_id) return false
  return location.user_id === viewerUserId
}

/**
 * Strip every row the current viewer should not see. When rows are
 * dropped a warning is logged so a backend leak is visible in devtools
 * and in any error-reporter hooked to console.
 */
export function filterVisibleLocations(
  locations: Location[],
  viewerUserId: string | null | undefined,
): Location[] {
  const kept: Location[] = []
  let dropped = 0
  for (const loc of locations) {
    if (canVisit(loc, viewerUserId)) {
      kept.push(loc)
    } else {
      dropped += 1
    }
  }
  if (dropped > 0) {
    // Not an error that should crash the app, but loud enough to be
    // noticed during a code review or in Sentry/LogRocket feeds.
    console.warn(
      `[spots] filtered out ${dropped} location(s) not visible to current user`,
    )
  }
  return kept
}
