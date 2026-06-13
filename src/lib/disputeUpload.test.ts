/**
 * Tests for dispute-evidence upload (issue #151): private bucket + signed URL,
 * random user-id-free object keys.
 */
import { describe, expect, test, vi } from 'vitest'
import {
  disputeImageExtension,
  disputeImageContentType,
  uploadDisputeImage,
  SIGNED_URL_TTL_SECONDS,
  type DisputeStorage,
} from './disputeUpload'

function fakeFile(name: string, type = 'image/jpeg'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type })
}

/** A DisputeStorage that records what it was asked to upload/sign/remove. */
function fakeStorage(overrides: Partial<DisputeStorage> = {}) {
  const calls = {
    uploadPath: '' as string,
    uploadContentType: '' as string,
    signPath: '' as string,
    signTtl: 0,
    removed: [] as string[],
  }
  const storage: DisputeStorage = {
    upload: vi.fn(async (path: string, _file: File, opts: { upsert: boolean; contentType: string }) => {
      calls.uploadPath = path
      calls.uploadContentType = opts.contentType
      return { error: null }
    }),
    createSignedUrl: vi.fn(async (path: string, ttl: number) => {
      calls.signPath = path
      calls.signTtl = ttl
      return { data: { signedUrl: `https://proj.supabase.co/storage/v1/object/sign/${path}?token=t` }, error: null }
    }),
    remove: vi.fn(async (paths: string[]) => {
      calls.removed.push(...paths)
      return { error: null }
    }),
    ...overrides,
  }
  return { storage, calls }
}

describe('disputeImageExtension', () => {
  test('normalises jpeg to jpg', () => {
    expect(disputeImageExtension('photo.JPEG')).toBe('jpg')
  })
  test('keeps known extensions', () => {
    expect(disputeImageExtension('a.png')).toBe('png')
    expect(disputeImageExtension('a.webp')).toBe('webp')
    expect(disputeImageExtension('a.HEIC')).toBe('heic')
  })
  test('falls back to jpg for unknown or missing extensions', () => {
    expect(disputeImageExtension('a.gif')).toBe('jpg')
    expect(disputeImageExtension('noextension')).toBe('jpg')
    expect(disputeImageExtension('weird.name.exe')).toBe('jpg')
  })
})

describe('disputeImageContentType', () => {
  test('uses the browser-reported type when present', () => {
    expect(disputeImageContentType(fakeFile('a.heic', 'image/heic'))).toBe('image/heic')
  })
  test('falls back to a type derived from the extension when File.type is empty', () => {
    expect(disputeImageContentType(fakeFile('a.heic', ''))).toBe('image/heic')
    expect(disputeImageContentType(fakeFile('a.png', ''))).toBe('image/png')
    // unknown extension normalises to jpg → image/jpeg
    expect(disputeImageContentType(fakeFile('a.gif', ''))).toBe('image/jpeg')
  })
})

describe('uploadDisputeImage', () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+$/

  test('uses a random UUID key with no user id or timestamp', async () => {
    const { storage, calls } = fakeStorage()
    await uploadDisputeImage(fakeFile('dive.jpg'), storage)
    expect(calls.uploadPath).toMatch(UUID_RE)
    expect(calls.uploadPath.endsWith('.jpg')).toBe(true)
    // no slash → no user-id folder leaking into the key
    expect(calls.uploadPath).not.toContain('/')
  })

  test('returns the signed URL and never a public URL', async () => {
    const { storage } = fakeStorage()
    const url = await uploadDisputeImage(fakeFile('dive.png'), storage)
    expect(url).toContain('/object/sign/')
    expect(url).not.toContain('/object/public/')
  })

  test('signs with the short TTL and the same key it uploaded', async () => {
    const { storage, calls } = fakeStorage()
    await uploadDisputeImage(fakeFile('dive.jpg'), storage)
    expect(calls.signTtl).toBe(SIGNED_URL_TTL_SECONDS)
    expect(calls.signPath).toBe(calls.uploadPath)
  })

  test('uploads with upsert disabled', async () => {
    const { storage } = fakeStorage()
    const file = fakeFile('dive.jpg')
    await uploadDisputeImage(file, storage)
    expect(storage.upload).toHaveBeenCalledWith(
      expect.any(String),
      file,
      { upsert: false, contentType: 'image/jpeg' },
    )
  })

  test('generates a distinct key for each upload', async () => {
    const a = fakeStorage()
    const b = fakeStorage()
    await uploadDisputeImage(fakeFile('dive.jpg'), a.storage)
    await uploadDisputeImage(fakeFile('dive.jpg'), b.storage)
    expect(a.calls.uploadPath).not.toBe(b.calls.uploadPath)
  })

  test('throws when the upload fails', async () => {
    const { storage } = fakeStorage({
      upload: vi.fn(async () => ({ error: { message: 'bucket missing' } })),
    })
    await expect(uploadDisputeImage(fakeFile('dive.jpg'), storage)).rejects.toThrow(/bucket missing/)
  })

  test('passes a content type derived from the extension when File.type is empty', async () => {
    const { storage, calls } = fakeStorage()
    await uploadDisputeImage(fakeFile('dive.heic', ''), storage)
    expect(calls.uploadContentType).toBe('image/heic')
  })

  test('throws when signing fails (and does not return an unsigned link)', async () => {
    const { storage } = fakeStorage({
      createSignedUrl: vi.fn(async () => ({ data: null, error: { message: 'denied' } })),
    })
    await expect(uploadDisputeImage(fakeFile('dive.jpg'), storage)).rejects.toThrow(/denied/)
  })

  test('cleans up the orphaned object when signing fails', async () => {
    const { storage, calls } = fakeStorage({
      createSignedUrl: vi.fn(async () => ({ data: null, error: { message: 'denied' } })),
    })
    await expect(uploadDisputeImage(fakeFile('dive.jpg'), storage)).rejects.toThrow(/denied/)
    expect(calls.removed).toEqual([calls.uploadPath])
  })

  test('still throws the signing error even if cleanup fails', async () => {
    const { storage } = fakeStorage({
      createSignedUrl: vi.fn(async () => ({ data: null, error: { message: 'denied' } })),
      remove: vi.fn(async () => { throw new Error('remove blew up') }),
    })
    await expect(uploadDisputeImage(fakeFile('dive.jpg'), storage)).rejects.toThrow(/denied/)
  })
})
