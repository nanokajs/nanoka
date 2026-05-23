import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { kvBlacklistStore } from '../blacklist-stores/kv.js'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    // biome-ignore lint/suspicious/noExplicitAny: KVNamespace is provided by miniflare at runtime
    BLACKLIST_KV: any
  }
}

async function sha256hex(jti: string): Promise<string> {
  const encoder = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(jti))
  const bytes = new Uint8Array(buf)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i] as number).toString(16).padStart(2, '0')
  }
  return hex
}

describe('kvBlacklistStore', () => {
  beforeEach(async () => {
    const keys = await env.BLACKLIST_KV.list()
    for (const key of keys.keys) {
      await env.BLACKLIST_KV.delete(key.name)
    }
  })

  it('add した jti を has で検出できる', async () => {
    const store = kvBlacklistStore(env.BLACKLIST_KV)
    const jti = crypto.randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + 3600

    await store.add(jti, expiresAt)
    expect(await store.has(jti)).toBe(true)
  })

  it('add していない jti は has で false を返す', async () => {
    const store = kvBlacklistStore(env.BLACKLIST_KV)
    const jti = crypto.randomUUID()
    expect(await store.has(jti)).toBe(false)
  })

  it('TTL は最低 60s にクランプされる（expiresAt が過去でも put は成功する）', async () => {
    const store = kvBlacklistStore(env.BLACKLIST_KV)
    const jti = crypto.randomUUID()
    const pastExpiresAt = Math.floor(Date.now() / 1000) - 100

    await store.add(jti, pastExpiresAt)
    expect(await store.has(jti)).toBe(true)
  })

  it('カスタム prefix で別の jti と衝突しない', async () => {
    const storeA = kvBlacklistStore(env.BLACKLIST_KV, { prefix: 'prefix-a:' })
    const storeB = kvBlacklistStore(env.BLACKLIST_KV, { prefix: 'prefix-b:' })
    const jti = crypto.randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + 3600

    await storeA.add(jti, expiresAt)
    expect(await storeA.has(jti)).toBe(true)
    expect(await storeB.has(jti)).toBe(false)
  })

  it('KV キーは SHA-256 ハッシュ化されており生 jti は格納されない', async () => {
    const store = kvBlacklistStore(env.BLACKLIST_KV)
    const jti = crypto.randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + 3600

    await store.add(jti, expiresAt)

    const hashHex = await sha256hex(jti)
    const valueByHash = await env.BLACKLIST_KV.get(`nanoka-auth:bl:${hashHex}`)
    expect(valueByHash).toBe('1')

    const valueByRawJti = await env.BLACKLIST_KV.get(`nanoka-auth:bl:${jti}`)
    expect(valueByRawJti).toBeNull()
  })

  it('addWithSubject + hasForSubject が sub 一致のみ true を返す', async () => {
    const store = kvBlacklistStore(env.BLACKLIST_KV)
    const jti = crypto.randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + 3600

    // biome-ignore lint/style/noNonNullAssertion: kvBlacklistStore implements addWithSubject/hasForSubject unconditionally
    await store.addWithSubject!(jti, 'user-A', expiresAt)

    // biome-ignore lint/style/noNonNullAssertion: kvBlacklistStore implements addWithSubject/hasForSubject unconditionally
    expect(await store.hasForSubject!(jti, 'user-A')).toBe(true)
    // biome-ignore lint/style/noNonNullAssertion: kvBlacklistStore implements addWithSubject/hasForSubject unconditionally
    expect(await store.hasForSubject!(jti, 'user-B')).toBe(false)
  })

  it('add で書いたエントリを hasForSubject で読むと保守的に true を返す', async () => {
    const store = kvBlacklistStore(env.BLACKLIST_KV)
    const jti = crypto.randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + 3600

    await store.add(jti, expiresAt)

    // biome-ignore lint/style/noNonNullAssertion: kvBlacklistStore implements addWithSubject/hasForSubject unconditionally
    expect(await store.hasForSubject!(jti, 'any-sub')).toBe(true)
  })
})
