import type { KVNamespace } from '@cloudflare/workers-types'
import type { BlacklistStore } from '../blacklist-store.js'

async function hashKey(jti: string): Promise<string> {
  const encoder = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(jti))
  const bytes = new Uint8Array(buf)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i] as number).toString(16).padStart(2, '0')
  }
  return hex
}

export function kvBlacklistStore(kv: KVNamespace, opts?: { prefix?: string }): BlacklistStore {
  const prefix = opts?.prefix ?? 'nanoka-auth:bl:'

  return {
    async add(jti: string, expiresAt: number): Promise<void> {
      const ttl = Math.min(2592000, Math.max(60, expiresAt - Math.floor(Date.now() / 1000)))
      await kv.put(`${prefix}${await hashKey(jti)}`, '1', { expirationTtl: ttl })
    },

    async has(jti: string): Promise<boolean> {
      return (await kv.get(`${prefix}${await hashKey(jti)}`)) !== null
    },

    async addWithSubject(jti: string, sub: string, expiresAt: number): Promise<void> {
      const ttl = Math.min(2592000, Math.max(60, expiresAt - Math.floor(Date.now() / 1000)))
      await kv.put(`${prefix}${await hashKey(jti)}`, JSON.stringify({ sub }), {
        expirationTtl: ttl,
      })
    },

    async hasForSubject(jti: string, sub: string): Promise<boolean> {
      const value = await kv.get(`${prefix}${await hashKey(jti)}`)
      if (value === null) return false
      if (value === '1') return true
      try {
        const parsed = JSON.parse(value) as unknown
        if (typeof parsed === 'object' && parsed !== null && 'sub' in parsed) {
          return (parsed as { sub: unknown }).sub === sub
        }
      } catch {
        // malformed value: treat as blacklisted (conservative)
      }
      return true
    },
  }
}
