/**
 * The share fragment is attacker-controllable input (it arrives in a URL),
 * so the decoder must reject anything that doesn't satisfy the backend's
 * ApneaTableCreate rules — otherwise "Save to my tables" would fail, or
 * worse, a crafted link could smuggle absurd values into the runner UI.
 */
import { describe, expect, test, beforeAll, afterAll, vi } from 'vitest'
import { buildShareUrl, decodeShareFragment, SHARE_PATH } from './shareTable'
import type { ApneaTable } from '../types'

const ORIGIN = 'https://depthviz.example'

beforeAll(() => {
  // buildShareUrl reads window.location.origin; tests run in plain Node.
  // Stub (rather than assign) so the global is restored afterwards and
  // can't leak `typeof window !== 'undefined'` paths into other test files.
  vi.stubGlobal('window', { location: { origin: ORIGIN } })
})

afterAll(() => {
  vi.unstubAllGlobals()
})

function makeTable(overrides: Partial<ApneaTable> = {}): ApneaTable {
  return {
    id: 7,
    user_id: 'u-1',
    name: 'Morning CO2',
    description: 'Five rounds, shrinking rest',
    table_type: 'co2',
    difficulty: 'intermediate',
    cycles: [
      { hold_seconds: 90, rest_seconds: 120 },
      { hold_seconds: 90, rest_seconds: 90 },
      { hold_seconds: 90, rest_seconds: 0 },
    ],
    is_public: false,
    is_system: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function fragmentOf(url: string): string {
  return url.slice(url.indexOf('#'))
}

/** Build a fragment directly from a raw payload object (bypasses buildShareUrl validation-by-construction). */
function encodeRaw(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return '#v1.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('buildShareUrl / decodeShareFragment round-trip', () => {
  test('decodes back to the same table content', () => {
    const table = makeTable()
    const url = buildShareUrl(table)
    expect(url.startsWith(`${ORIGIN}${SHARE_PATH}#v1.`)).toBe(true)

    const decoded = decodeShareFragment(fragmentOf(url))
    expect(decoded).not.toBeNull()
    expect(decoded!.name).toBe(table.name)
    expect(decoded!.description).toBe(table.description)
    expect(decoded!.table_type).toBe(table.table_type)
    expect(decoded!.difficulty).toBe(table.difficulty)
    expect(decoded!.cycles).toEqual(table.cycles)
    // Shared copies always import as private regardless of the source flag.
    expect(decoded!.is_public).toBe(false)
  })

  test('handles unicode names and null description', () => {
    const table = makeTable({ name: 'Tisch für Apnoe — 深呼吸 🐬', description: null })
    const decoded = decodeShareFragment(fragmentOf(buildShareUrl(table)))
    expect(decoded!.name).toBe(table.name)
    expect(decoded!.description).toBeNull()
  })

  test('accepts the fragment with or without the leading #', () => {
    const frag = fragmentOf(buildShareUrl(makeTable()))
    expect(decodeShareFragment(frag)).not.toBeNull()
    expect(decodeShareFragment(frag.slice(1))).not.toBeNull()
  })

  test('fits in a comfortably scannable QR code even at the 24-cycle maximum', () => {
    const cycles = Array.from({ length: 24 }, () => ({ hold_seconds: 1200, rest_seconds: 1200 }))
    const table = makeTable({ name: 'x'.repeat(80), description: 'y'.repeat(500), cycles })
    const url = buildShareUrl(table)
    // QR version 40 at error level M holds ~2300 bytes; stay well under.
    expect(url.length).toBeLessThan(1500)
    expect(decodeShareFragment(fragmentOf(url))!.cycles).toHaveLength(24)
  })
})

describe('decodeShareFragment rejects malformed input', () => {
  test.each([
    ['empty string', ''],
    ['bare hash', '#'],
    ['wrong prefix', '#v2.abcd'],
    ['no prefix', '#abcd'],
    ['invalid base64', '#v1.!!!not-base64!!!'],
    ['valid base64, not JSON', '#v1.' + btoa('not json at all').replace(/=+$/, '')],
    ['JSON but not an object', encodeRaw([1, 2, 3]).replace('#v1.', '#v1.') /* array */],
    ['JSON null', encodeRaw(null)],
  ])('%s', (_label, fragment) => {
    expect(decodeShareFragment(fragment)).toBeNull()
  })

  const valid = {
    v: 1, n: 'ok', d: null, t: 'o2', f: 'beginner',
    c: [[60, 60]],
  }

  test.each([
    ['wrong version', { ...valid, v: 2 }],
    ['missing name', { ...valid, n: undefined }],
    ['empty name', { ...valid, n: '   ' }],
    ['name too long', { ...valid, n: 'x'.repeat(81) }],
    ['description too long', { ...valid, d: 'x'.repeat(501) }],
    ['bad table type', { ...valid, t: 'static' }],
    ['bad difficulty', { ...valid, f: 'elite' }],
    ['empty cycles', { ...valid, c: [] }],
    ['too many cycles', { ...valid, c: Array.from({ length: 25 }, () => [60, 60]) }],
    ['cycle not a pair', { ...valid, c: [[60]] }],
    ['hold above cap', { ...valid, c: [[1201, 60]] }],
    ['negative rest', { ...valid, c: [[60, -1]] }],
    ['non-integer hold', { ...valid, c: [[60.5, 60]] }],
    ['string seconds', { ...valid, c: [['60', 60]] }],
    ['all-zero holds', { ...valid, c: [[0, 60], [0, 30]] }],
  ])('%s', (_label, payload) => {
    expect(decodeShareFragment(encodeRaw(payload))).toBeNull()
  })
})
