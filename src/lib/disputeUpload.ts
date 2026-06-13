import { supabase } from './supabase'

/**
 * Upload of dispute-evidence photos.
 *
 * Security model (see issue #151):
 *  - The `dispute-evidence` bucket is **private** — there is no public URL.
 *    Reads happen only through short-lived signed URLs, so an object is never
 *    accessible just by knowing (or guessing) its path.
 *  - Object keys are random UUIDs, not `user.id/Date.now()`. That removes both
 *    the enumerable millisecond timestamp and the user-UUID leak that the old
 *    public-bucket path had.
 *  - Read access is enforced by storage RLS (owner-only) — see
 *    `supabase/dispute-evidence.sql`.
 */

export const DISPUTE_BUCKET = 'dispute-evidence'

/**
 * Signed-URL lifetime. It only has to outlive the synchronous backend AI image
 * fetch performed during `POST /disputes`, so keep it short — the link should
 * not remain replayable afterwards.
 */
export const SIGNED_URL_TTL_SECONDS = 300

// Normalise the user-supplied extension to a small allow-list so the object key
// can never contain unexpected path characters.
const ALLOWED_EXT: Record<string, string> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  heic: 'heic',
  heif: 'heic',
}

export function disputeImageExtension(fileName: string): string {
  const raw = fileName.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_EXT[raw] ?? 'jpg'
}

/**
 * Minimal shape of the Supabase storage bucket API this module depends on.
 * Declaring it lets tests inject a fake without constructing a real client.
 */
export interface DisputeStorage {
  upload(
    path: string,
    file: File,
    opts: { upsert: boolean; contentType: string },
  ): Promise<{ error: { message: string } | null }>
  createSignedUrl(
    path: string,
    expiresIn: number,
  ): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>
}

/**
 * Upload an evidence image to the private bucket and return a short-lived signed
 * URL the backend can fetch during dispute analysis.
 *
 * Throws on upload or signing failure; callers treat a failure as non-fatal and
 * submit the dispute without a photo.
 */
export async function uploadDisputeImage(
  file: File,
  storage: DisputeStorage = supabase.storage.from(DISPUTE_BUCKET) as unknown as DisputeStorage,
): Promise<string> {
  // Unguessable, user-id-free key. Because the bucket is private the key is
  // never exposed in a public URL anyway, but a random key also defeats path
  // enumeration outright.
  const path = `${crypto.randomUUID()}.${disputeImageExtension(file.name)}`

  const { error: uploadErr } = await storage.upload(path, file, {
    upsert: false,
    contentType: file.type,
  })
  if (uploadErr) {
    throw new Error(`Image upload failed: ${uploadErr.message}`)
  }

  const { data, error: signErr } = await storage.createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (signErr || !data?.signedUrl) {
    throw new Error(`Could not create signed link: ${signErr?.message ?? 'unknown error'}`)
  }
  return data.signedUrl
}
