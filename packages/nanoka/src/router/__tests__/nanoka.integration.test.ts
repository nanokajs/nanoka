import type { D1Database } from '@cloudflare/workers-types'
import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { d1Adapter } from '../../adapter'
import { t } from '../../field'
import { nanoka } from '../nanoka'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database
  }
}

describe('nanoka() integration with D1', () => {
  beforeEach(async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    // Drop and recreate table for each test
    await adapter.drizzle.run(sql`DROP TABLE IF EXISTS users`)
    await adapter.drizzle.run(
      sql`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          passwordHash TEXT NOT NULL
        )
      `,
    )
  })

  describe('spec example workflow', () => {
    it('initializes with adapter, registers model, handles GET/POST/PATCH', async () => {
      const { env } = await import('cloudflare:test')
      const app = nanoka(d1Adapter(env.DB))

      // Model registration
      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
        email: t.string().email(),
        passwordHash: t.string(),
      })

      // GET endpoint
      app.get('/users', async (c) => {
        const users = await User.findMany({ limit: 20, offset: 0, orderBy: 'id' })
        return c.json(users)
      })

      // POST endpoint with validator
      app.post('/users', User.validator('json', { omit: ['passwordHash'] }), async (c) => {
        const body = c.req.valid('json')
        const user = await User.create({ ...body, passwordHash: 'default-hash' })
        return c.json(user, 201)
      })

      // PATCH endpoint with partial validator
      app.patch(
        '/users/:id',
        User.validator('param', { pick: ['id'] }),
        User.validator('json', { partial: true, pick: ['name', 'email'] }),
        async (c) => {
          const { id } = c.req.valid('param')
          const body = c.req.valid('json')
          const user = await User.update(id, body)
          return c.json(user)
        },
      )

      // Test POST
      const userId = '550e8400-e29b-41d4-a716-446655440000'
      const postRequest = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          name: 'John Doe',
          email: 'john@example.com',
        }),
      })

      const postResponse = await app.fetch(postRequest)
      expect(postResponse.status).toBe(201)
      const created = (await postResponse.json()) as Record<string, unknown>
      expect(created.id).toBe(userId)
      expect(created.name).toBe('John Doe')
      expect(created.email).toBe('john@example.com')

      // Test GET
      const getRequest = new Request('http://localhost/users')
      const getResponse = await app.fetch(getRequest)
      expect(getResponse.status).toBe(200)
      const users = (await getResponse.json()) as unknown[]
      expect(users).toHaveLength(1)

      // Test PATCH
      const patchRequest = new Request(`http://localhost/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Doe',
        }),
      })

      const patchResponse = await app.fetch(patchRequest)
      expect(patchResponse.status).toBe(200)
      const updated = (await patchResponse.json()) as Record<string, unknown>
      expect(updated.name).toBe('Jane Doe')
      expect(updated.email).toBe('john@example.com')
    })
  })

  describe('app.db escape hatch', () => {
    it('exposes raw Drizzle for advanced queries', async () => {
      const { env } = await import('cloudflare:test')
      const app = nanoka(d1Adapter(env.DB))

      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
        email: t.string().email(),
        passwordHash: t.string(),
      })

      // Create a user via CRUD
      const userId = '550e8400-e29b-41d4-a716-446655440001'
      await User.create({
        id: userId,
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hashed',
      })

      // Access raw Drizzle via app.db escape hatch
      const rawResult = await app.db
        .select()
        .from(User.table as any)
        .where(eq((User.table as any).id, userId))
        .limit(1)

      expect(rawResult).toHaveLength(1)
      expect((rawResult[0] as any).name).toBe('Test User')
    })
  })

  describe('app.batch escape hatch', () => {
    it('exposes D1 batch API for multiple operations', async () => {
      const { env } = await import('cloudflare:test')
      const app = nanoka(d1Adapter(env.DB))

      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
        email: t.string().email(),
        passwordHash: t.string(),
      })

      // Batch multiple inserts
      const query1 = app.db.insert(User.table).values({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'User 1',
        email: 'user1@example.com',
        passwordHash: 'hashed1',
      })

      const query2 = app.db.insert(User.table).values({
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'User 2',
        email: 'user2@example.com',
        passwordHash: 'hashed2',
      })

      const results = await app.batch([query1, query2] as any)

      expect(results).toHaveLength(2)
      expect(results[0]).toBeDefined()
      expect(results[1]).toBeDefined()
    })
  })

  describe('model CRUD through app.model', () => {
    it('findMany requires limit parameter (type safety)', async () => {
      const { env } = await import('cloudflare:test')
      const app = nanoka(d1Adapter(env.DB))

      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
        email: t.string().email(),
        passwordHash: t.string(),
      })

      // This should work (limit provided)
      const users = await User.findMany({ limit: 10 })
      expect(Array.isArray(users)).toBe(true)
    })

    it('create and findOne work end-to-end', async () => {
      const { env } = await import('cloudflare:test')
      const app = nanoka(d1Adapter(env.DB))

      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
        email: t.string().email(),
        passwordHash: t.string(),
      })

      const userId = '550e8400-e29b-41d4-a716-446655440004'
      const created = await User.create({
        id: userId,
        name: 'Created User',
        email: 'created@example.com',
        passwordHash: 'hashed',
      })

      expect(created.id).toBe(userId)
      expect(created.name).toBe('Created User')

      const fetched = await User.findOne(userId)
      expect(fetched).not.toBeNull()
      expect(fetched?.name).toBe('Created User')
    })

    it('update and delete work end-to-end', async () => {
      const { env } = await import('cloudflare:test')
      const app = nanoka(d1Adapter(env.DB))

      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
        email: t.string().email(),
        passwordHash: t.string(),
      })

      const userId = '550e8400-e29b-41d4-a716-446655440005'
      await User.create({
        id: userId,
        name: 'Original Name',
        email: 'original@example.com',
        passwordHash: 'hashed',
      })

      const updated = await User.update(userId, { name: 'Updated Name' })
      expect(updated?.name).toBe('Updated Name')

      const deleted = await User.delete(userId)
      expect(deleted.deleted).toBe(1)

      const shouldBeNull = await User.findOne(userId)
      expect(shouldBeNull).toBeNull()
    })
  })

  describe('validator field type safety', () => {
    it('omit excludes fields from validated input at runtime', async () => {
      const { env } = await import('cloudflare:test')
      const app = nanoka(d1Adapter(env.DB))

      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
        email: t.string().email(),
        passwordHash: t.string(),
      })

      let receivedBody: any

      app.post('/users-safe', User.validator('json', { omit: ['passwordHash'] }), (c) => {
        receivedBody = c.req.valid('json')
        return c.json({ ok: true })
      })

      const request = new Request('http://localhost/users-safe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '550e8400-e29b-41d4-a716-446655440006',
          name: 'Safe User',
          email: 'safe@example.com',
          passwordHash: 'should-be-stripped', // This should not appear in validated body
        }),
      })

      const response = await app.fetch(request)
      expect(response.status).toBe(200)
      expect(receivedBody).not.toHaveProperty('passwordHash')
      expect(receivedBody.name).toBe('Safe User')
    })

    it('partial allows optional fields in PATCH request', async () => {
      const { env } = await import('cloudflare:test')
      const app = nanoka(d1Adapter(env.DB))

      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
        email: t.string().email(),
        passwordHash: t.string(),
      })

      let receivedBody: any

      app.patch(
        '/users/:id/partial',
        User.validator('json', { partial: true, pick: ['name', 'email'] }),
        (c) => {
          receivedBody = c.req.valid('json')
          return c.json({ ok: true })
        },
      )

      // Request with only name (partial)
      const request = new Request('http://localhost/users/123/partial', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Partial Update',
        }),
      })

      const response = await app.fetch(request)
      expect(response.status).toBe(200)
      expect(receivedBody).toEqual({ name: 'Partial Update' })
    })
  })
})
