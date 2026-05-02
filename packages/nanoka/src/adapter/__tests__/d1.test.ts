import type { D1Database } from '@cloudflare/workers-types'
import { sql } from 'drizzle-orm'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { d1Adapter } from '../d1'
import type { Adapter } from '../types'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database
  }
}

describe('d1Adapter', () => {
  it('should create an Adapter instance from D1 binding', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    expect(adapter).toBeDefined()
    expect(adapter.drizzle).toBeDefined()
    expect(adapter.batch).toBeDefined()
  })

  it('should expose drizzle database with select method', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    expect(typeof adapter.drizzle.select).toBe('function')
    expect(typeof adapter.drizzle.insert).toBe('function')
    expect(typeof adapter.drizzle.update).toBe('function')
    expect(typeof adapter.drizzle.delete).toBe('function')
  })

  it('should expose batch method', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    expect(typeof adapter.batch).toBe('function')
  })

  it('should type as Adapter interface', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    expectTypeOf(adapter).toMatchTypeOf<Adapter>()
    expectTypeOf(adapter.drizzle).not.toMatchTypeOf<D1Database>()
  })

  it('batch reaches D1 binding', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const result = await adapter.batch([adapter.drizzle.run(sql`select 1`)])

    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
  })
})
