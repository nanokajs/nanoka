import type { D1Database } from '@cloudflare/workers-types'
import { sql } from 'drizzle-orm'
import { describe, it, expect, beforeEach } from 'vitest'
import { HTTPException } from 'hono/http-exception'
import { d1Adapter } from '../../adapter/d1'
import { t } from '../../field'
import { defineModel } from '../define'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database
  }
}

describe('CRUD operations: vitest-pool-workers D1 integration', () => {
  const User = defineModel('users', {
    id: t.uuid().primary(),
    name: t.string(),
    email: t.string().email(),
  })

  beforeEach(async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    // Drop and recreate table
    await adapter.drizzle.run(sql`DROP TABLE IF EXISTS users`)
    await adapter.drizzle.run(
      sql`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL
        )
      `,
    )
  })

  describe('Happy path: CRUD operations', () => {
    it('1. create and findOne by PK (scalar id)', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      const created = await User.create(adapter, {
        id: 'uuid-1',
        name: 'Alice',
        email: 'alice@example.com',
      })

      expect(created.id).toBe('uuid-1')
      expect(created.name).toBe('Alice')
      expect(created.email).toBe('alice@example.com')

      const found = await User.findOne(adapter, 'uuid-1')
      expect(found).not.toBeNull()
      expect(found?.name).toBe('Alice')
    })

    it('2. findOne with where object (email)', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await User.create(adapter, {
        id: 'uuid-2',
        name: 'Bob',
        email: 'bob@example.com',
      })

      const found = await User.findOne(adapter, { email: 'bob@example.com' })
      expect(found).not.toBeNull()
      expect(found?.name).toBe('Bob')
    })

    it('3. findMany with limit', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await User.create(adapter, { id: 'uuid-3a', name: 'Charlie', email: 'charlie@example.com' })
      await User.create(adapter, { id: 'uuid-3b', name: 'Diana', email: 'diana@example.com' })
      await User.create(adapter, { id: 'uuid-3c', name: 'Eve', email: 'eve@example.com' })

      const rows = await User.findMany(adapter, { limit: 20 })
      expect(rows.length).toBe(3)
    })

    it('4. findMany with offset and orderBy (asc)', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await User.create(adapter, { id: 'uuid-4a', name: 'A', email: 'a@example.com' })
      await User.create(adapter, { id: 'uuid-4b', name: 'B', email: 'b@example.com' })
      await User.create(adapter, { id: 'uuid-4c', name: 'C', email: 'c@example.com' })

      const rows = await User.findMany(adapter, {
        limit: 2,
        offset: 1,
        orderBy: 'id',
      })

      expect(rows.length).toBe(2)
      expect(rows[0]!.id).toBe('uuid-4b')
      expect(rows[1]!.id).toBe('uuid-4c')
    })

    it('5. findMany with orderBy as object with desc direction', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await User.create(adapter, { id: 'uuid-5a', name: 'X', email: 'x@example.com' })
      await User.create(adapter, { id: 'uuid-5b', name: 'Y', email: 'y@example.com' })

      const rows = await User.findMany(adapter, {
        limit: 2,
        orderBy: { column: 'name', direction: 'desc' },
      })

      expect(rows.length).toBe(2)
      expect(rows[0]!.name).toBe('Y')
      expect(rows[1]!.name).toBe('X')
    })

    it('6. findMany with multiple orderBy columns', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await User.create(adapter, { id: 'uuid-6a', name: 'A', email: 'a@example.com' })
      await User.create(adapter, { id: 'uuid-6b', name: 'B', email: 'b@example.com' })

      const rows = await User.findMany(adapter, {
        limit: 2,
        orderBy: ['name', { column: 'id', direction: 'asc' }],
      })

      expect(rows.length).toBe(2)
      expect(rows[0]!.name).toBe('A')
      expect(rows[1]!.name).toBe('B')
    })

    it('7. update with PK and return updated row', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await User.create(adapter, {
        id: 'uuid-7',
        name: 'Original',
        email: 'original@example.com',
      })

      const updated = await User.update(adapter, 'uuid-7', { name: 'Updated' })

      expect(updated).not.toBeNull()
      expect(updated?.name).toBe('Updated')
      expect(updated?.email).toBe('original@example.com')
    })

    it('8. update with where object (email)', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await User.create(adapter, {
        id: 'uuid-8',
        name: 'Original',
        email: 'update-test@example.com',
      })

      const updated = await User.update(
        adapter,
        { email: 'update-test@example.com' },
        { name: 'ViaEmail' },
      )

      expect(updated).not.toBeNull()
      expect(updated?.name).toBe('ViaEmail')
    })

    it('9. delete with PK and return count', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await User.create(adapter, {
        id: 'uuid-9',
        name: 'ToDelete',
        email: 'delete@example.com',
      })

      const result = await User.delete(adapter, 'uuid-9')

      expect(result.deleted).toBe(1)

      const found = await User.findOne(adapter, 'uuid-9')
      expect(found).toBeNull()
    })
  })

  describe('Negative cases: validation and error handling', () => {
    it('10. reject negative limit', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await expect(User.findMany(adapter, { limit: -1 } as any)).rejects.toThrow(HTTPException)
    })

    it('11. reject NaN limit', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await expect(User.findMany(adapter, { limit: NaN } as any)).rejects.toThrow(HTTPException)
    })

    it('12. reject limit > MAX_LIMIT (100)', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await expect(User.findMany(adapter, { limit: 1000 })).rejects.toThrow(HTTPException)
    })

    it('13. reject delete with empty where clause', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await expect(User.delete(adapter, {} as any)).rejects.toThrow(HTTPException)
    })

    it('14. reject orderBy with invalid column name (identifier injection guard)', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await User.create(adapter, { id: 'uuid-14', name: 'Test', email: 'test@example.com' })

      await expect(
        User.findMany(adapter, { limit: 20, orderBy: 'evil; drop' as any } as any),
      ).rejects.toThrow(HTTPException)
    })

    it('15. reject where with Object.prototype-inherited keys (prototype pollution guard)', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      // Simulate untrusted input that has a prototype-chain key as own property
      const malicious = JSON.parse('{"toString": "x"}')
      await expect(User.findOne(adapter, malicious as any)).rejects.toThrow(HTTPException)
    })

    it('16. reject orderBy with Object.prototype-inherited name (prototype pollution guard)', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await User.create(adapter, { id: 'uuid-16', name: 'Test', email: 'test@example.com' })

      await expect(
        User.findMany(adapter, { limit: 20, orderBy: 'toString' as any } as any),
      ).rejects.toThrow(HTTPException)
    })
  })
})
