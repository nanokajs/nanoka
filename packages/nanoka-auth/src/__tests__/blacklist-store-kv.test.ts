import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { kvBlacklistStore } from '../blacklist-stores/kv.js'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    // biome-ignore lint/suspicious/noExplicitAny: KVNamespace is provided by miniflare at runtime
    BLACKLIST_KV: any
  }
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

  it('デフォルト prefix は nanoka-auth:bl: が使われる', async () => {
    const store = kvBlacklistStore(env.BLACKLIST_KV)
    const jti = crypto.randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + 3600

    await store.add(jti, expiresAt)

    const value = await env.BLACKLIST_KV.get(`nanoka-auth:bl:${jti}`)
    expect(value).toBe('1')
  })
})
