import type { KVNamespace } from '@cloudflare/workers-types'
import type { BlacklistStore } from '../blacklist-store.js'

export function kvBlacklistStore(kv: KVNamespace, opts?: { prefix?: string }): BlacklistStore {
  const prefix = opts?.prefix ?? 'nanoka-auth:bl:'

  return {
    async add(jti: string, expiresAt: number): Promise<void> {
      const ttl = Math.min(2592000, Math.max(60, expiresAt - Math.floor(Date.now() / 1000)))
      await kv.put(`${prefix}${jti}`, '1', { expirationTtl: ttl })
    },

    async has(jti: string): Promise<boolean> {
      return (await kv.get(`${prefix}${jti}`)) !== null
    },
  }
}
