/**
 * Encode/decode apnea tables as self-contained share links.
 *
 * The table data travels in the URL *fragment* (`/training/shared#v1.…`),
 * so it never reaches the server, server logs, or referrer headers. That
 * lets users share private tables via QR code or link without flipping
 * them public — the link IS the data, so it also keeps working if the
 * original table is later edited or deleted.
 *
 * Payload: base64url(UTF-8 JSON) of a compact shape:
 *   { v: 1, n: name, d: description|null, t: type, f: difficulty, c: [[hold, rest], …] }
 *
 * Decoded payloads come from an untrusted URL, so validation mirrors the
 * backend's ApneaTableCreate rules exactly — anything that passes decode
 * is guaranteed to be accepted by POST /apnea/tables when saved.
 */
import type { ApneaCycle, ApneaDifficulty, ApneaTable, ApneaTableCreate, ApneaTableType } from '../types'

export const SHARE_PATH = '/training/shared'

const PREFIX = 'v1.'
const MAX_NAME = 80
const MAX_DESCRIPTION = 500
const MAX_CYCLES = 24
const MAX_CYCLE_SECONDS = 1200

const TABLE_TYPES: readonly ApneaTableType[] = ['o2', 'co2', 'custom']
const DIFFICULTIES: readonly ApneaDifficulty[] = ['beginner', 'intermediate', 'expert']

interface SharePayload {
  v: 1
  n: string
  d: string | null
  t: ApneaTableType
  f: ApneaDifficulty
  c: [number, number][]
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array | null {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** Build the share URL for a table. Works for private tables — the data is in the fragment. */
export function buildShareUrl(table: Pick<ApneaTable, 'name' | 'description' | 'table_type' | 'difficulty' | 'cycles'>): string {
  const payload: SharePayload = {
    v: 1,
    n: table.name,
    d: table.description,
    t: table.table_type,
    f: table.difficulty,
    c: table.cycles.map(c => [c.hold_seconds, c.rest_seconds]),
  }
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  return `${window.location.origin}${SHARE_PATH}#${PREFIX}${toBase64Url(bytes)}`
}

function isCycleSeconds(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_CYCLE_SECONDS
}

/**
 * Decode a share fragment (the part after `#`, with or without the leading `#`).
 * Returns null for anything malformed — the payload is attacker-controllable,
 * so every field is checked against the same limits the backend enforces.
 */
export function decodeShareFragment(fragment: string): ApneaTableCreate | null {
  const raw = fragment.startsWith('#') ? fragment.slice(1) : fragment
  if (!raw.startsWith(PREFIX)) return null

  const bytes = fromBase64Url(raw.slice(PREFIX.length))
  if (!bytes) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const p = parsed as Record<string, unknown>

  if (p.v !== 1) return null
  if (typeof p.n !== 'string' || p.n.trim().length === 0 || p.n.length > MAX_NAME) return null
  if (p.d !== null && (typeof p.d !== 'string' || p.d.length > MAX_DESCRIPTION)) return null
  if (typeof p.t !== 'string' || !TABLE_TYPES.includes(p.t as ApneaTableType)) return null
  if (typeof p.f !== 'string' || !DIFFICULTIES.includes(p.f as ApneaDifficulty)) return null
  if (!Array.isArray(p.c) || p.c.length === 0 || p.c.length > MAX_CYCLES) return null

  const cycles: ApneaCycle[] = []
  for (const entry of p.c) {
    if (!Array.isArray(entry) || entry.length !== 2) return null
    const [hold, rest] = entry
    if (!isCycleSeconds(hold) || !isCycleSeconds(rest)) return null
    cycles.push({ hold_seconds: hold, rest_seconds: rest })
  }
  // Backend rejects all-zero-hold tables; reject here too so "Save" can't fail.
  if (cycles.every(c => c.hold_seconds === 0)) return null

  return {
    name: p.n.trim(),
    description: (p.d as string | null) || null,
    table_type: p.t as ApneaTableType,
    difficulty: p.f as ApneaDifficulty,
    cycles,
    is_public: false,
  }
}

/** Wrap a decoded share payload in an ApneaTable shape so existing UI components can render it. */
export function sharedTableFromPayload(payload: ApneaTableCreate): ApneaTable {
  return {
    id: -1,
    user_id: null,
    name: payload.name,
    description: payload.description ?? null,
    table_type: payload.table_type,
    difficulty: payload.difficulty,
    cycles: payload.cycles,
    is_public: false,
    is_system: false,
    created_at: '',
    updated_at: '',
  }
}
