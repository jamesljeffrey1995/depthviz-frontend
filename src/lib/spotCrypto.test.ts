import { describe, it, expect } from 'vitest'
import { encryptCoord, decryptCoord } from './spotCrypto'

const ALGO = 'AES-GCM'

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGO, length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
}

describe('spotCrypto coordinate encryption', () => {
  it('round-trips a coordinate through encrypt/decrypt', async () => {
    const key = await makeKey()
    for (const value of [50.1234, -4.5678, 0, 89.999999, -179.5]) {
      const enc = await encryptCoord(value, key)
      expect(await decryptCoord(enc, key)).toBeCloseTo(value, 6)
    }
  })

  it('uses a fresh IV each time (ciphertext differs for the same input)', async () => {
    const key = await makeKey()
    const a = await encryptCoord(51.5, key)
    const b = await encryptCoord(51.5, key)
    expect(a).not.toEqual(b)
  })

  it('fails to decrypt with the wrong key rather than returning garbage', async () => {
    const key = await makeKey()
    const other = await makeKey()
    const enc = await encryptCoord(51.5, key)
    await expect(decryptCoord(enc, other)).rejects.toBeDefined()
  })

  it('throws when the decrypted value is not a finite number', async () => {
    const key = await makeKey()
    const enc = await encryptCoord(NaN, key)
    await expect(decryptCoord(enc, key)).rejects.toThrow(/finite/)
  })
})
