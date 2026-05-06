import type { Hasher } from '../hasher.js'

const ITERATIONS = 310_000
const SALT_BYTES = 16
const HASH_BYTES = 32
const HASH_NAME = 'SHA-256'

function utf8(str: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(str) as unknown as Uint8Array<ArrayBuffer>
}

function toBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(str: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = str
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
    const binary = atob(padded)
    const buf = new ArrayBuffer(binary.length)
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

async function derive(
  plain: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', utf8(plain), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: HASH_NAME },
    key,
    HASH_BYTES * 8,
  )
}

function timingSafeEqual(a: Uint8Array<ArrayBuffer>, b: Uint8Array<ArrayBuffer>): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] as number) ^ (b[i] as number)
  }
  return diff === 0
}

export const pbkdf2Hasher: Hasher = {
  async hash(plain: string): Promise<string> {
    const saltBuf = new ArrayBuffer(SALT_BYTES)
    const salt = new Uint8Array(saltBuf) as Uint8Array<ArrayBuffer>
    crypto.getRandomValues(salt)
    const derived = await derive(plain, salt, ITERATIONS)
    return `$pbkdf2$${ITERATIONS}$${toBase64url(saltBuf)}$${toBase64url(derived)}`
  },

  async verify(plain: string, stored: string): Promise<boolean> {
    const parts = stored.split('$')
    if (parts.length !== 5 || parts[0] !== '') return false
    const algoId = parts[1]
    const iterStr = parts[2]
    const saltB64 = parts[3]
    const hashB64 = parts[4]
    if (algoId !== 'pbkdf2') return false
    if (iterStr === undefined || saltB64 === undefined || hashB64 === undefined) return false

    const iterations = Number.parseInt(iterStr, 10)
    if (!Number.isFinite(iterations) || iterations <= 0 || iterations > 1_000_000) return false

    const salt = fromBase64url(saltB64)
    const storedHash = fromBase64url(hashB64)

    if (salt === null || storedHash === null) return false
    if (salt.length === 0 || storedHash.length !== HASH_BYTES) return false

    const derived = await derive(plain, salt, iterations)
    const derivedBytes = new Uint8Array(derived) as Uint8Array<ArrayBuffer>

    return timingSafeEqual(derivedBytes, storedHash)
  },
}
