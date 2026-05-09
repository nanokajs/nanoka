import type { D1Database } from '@cloudflare/workers-types'
import { eq, sql } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
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
        // biome-ignore lint/suspicious/noExplicitAny: accessing Drizzle escape hatch with raw table type
        .from(User.table as any)
        // biome-ignore lint/suspicious/noExplicitAny: accessing Drizzle escape hatch with raw table type
        .where(eq((User.table as any).id, userId))
        .limit(1)

      expect(rawResult).toHaveLength(1)
      // biome-ignore lint/suspicious/noExplicitAny: accessing raw Drizzle result without schema type
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

      // biome-ignore lint/suspicious/noExplicitAny: batch API type requires cast for mixed query types
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

    it('findAll returns all rows via app.model()', async () => {
      const { env } = await import('cloudflare:test')
      const app = nanoka(d1Adapter(env.DB))

      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
        email: t.string().email(),
        passwordHash: t.string(),
      })

      // Create two users
      const userId1 = '550e8400-e29b-41d4-a716-446655440007'
      const userId2 = '550e8400-e29b-41d4-a716-446655440008'

      await User.create({
        id: userId1,
        name: 'User One',
        email: 'user1@example.com',
        passwordHash: 'hashed1',
      })

      await User.create({
        id: userId2,
        name: 'User Two',
        email: 'user2@example.com',
        passwordHash: 'hashed2',
      })

      // Call findAll without arguments
      const allUsers = await User.findAll()
      expect(allUsers).toHaveLength(2)

      // Call findAll with optional orderBy argument
      const orderedUsers = await User.findAll({ orderBy: 'id' })
      expect(orderedUsers.map((u) => u.id)).toEqual([userId1, userId2])

      // Call findAll with where filter
      const filtered = await User.findAll({ where: { name: 'User One' } })
      expect(filtered).toHaveLength(1)
      // biome-ignore lint/style/noNonNullAssertion: length checked above
      expect(filtered[0]!.id).toBe(userId1)
    })
  })

  describe('relation eager loading through app.model', () => {
    beforeEach(async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await adapter.drizzle.run(sql`DROP TABLE IF EXISTS router_relation_users`)
      await adapter.drizzle.run(sql`DROP TABLE IF EXISTS router_relation_posts`)
      await adapter.drizzle.run(sql`DROP TABLE IF EXISTS router_relation_authors`)
      await adapter.drizzle.run(
        sql`
          CREATE TABLE router_relation_users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
          )
        `,
      )
      await adapter.drizzle.run(
        sql`
          CREATE TABLE router_relation_authors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
          )
        `,
      )
      await adapter.drizzle.run(
        sql`
          CREATE TABLE router_relation_posts (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            authorId TEXT NOT NULL,
            title TEXT NOT NULL
          )
        `,
      )
    })

    it('findMany loads hasMany relations from adapter-bound API', async () => {
      const { env } = await import('cloudflare:test')
      const app = nanoka(d1Adapter(env.DB))

      const Post = app.model('router_relation_posts', {
        id: t.uuid().primary(),
        userId: t.uuid(),
        authorId: t.uuid(),
        title: t.string(),
      })
      const User = app.model('router_relation_users', {
        id: t.uuid().primary(),
        name: t.string(),
        posts: t.hasMany(Post, { foreignKey: 'userId' }),
      })

      await User.create({ id: 'rru-1', name: 'Alice' })
      await Post.create({ id: 'rrp-1', userId: 'rru-1', authorId: 'rra-1', title: 'First' })

      const users = await User.findMany({ limit: 10, with: { posts: true } })

      expect(users).toHaveLength(1)
      expect(users[0]?.posts.map((post) => post.id)).toEqual(['rrp-1'])
    })

    it('findOne loads belongsTo relations from adapter-bound API', async () => {
      const { env } = await import('cloudflare:test')
      const app = nanoka(d1Adapter(env.DB))

      const Author = app.model('router_relation_authors', {
        id: t.uuid().primary(),
        name: t.string(),
      })
      const Post = app.model('router_relation_posts', {
        id: t.uuid().primary(),
        userId: t.uuid(),
        authorId: t.uuid(),
        title: t.string(),
        author: t.belongsTo(Author, { foreignKey: 'authorId' }),
      })

      await Author.create({ id: 'rra-1', name: 'Author' })
      await Post.create({ id: 'rrp-1', userId: 'rru-1', authorId: 'rra-1', title: 'First' })

      const post = await Post.findOne('rrp-1', { with: { author: true } })

      expect(post?.author?.id).toBe('rra-1')
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

      // biome-ignore lint/suspicious/noExplicitAny: test variable to capture validated body
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

      // biome-ignore lint/suspicious/noExplicitAny: test variable to capture validated body
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

  describe('MAX_OFFSET cap on findMany', () => {
    it('findMany rejects offset > MAX_OFFSET via app.model() binding', async () => {
      const { env } = await import('cloudflare:test')
      const app = nanoka(d1Adapter(env.DB))

      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
        email: t.string().email(),
        passwordHash: t.string(),
      })

      // findMany called through app.model() should reject offset > 100_000
      await expect(User.findMany({ limit: 20, offset: 100_001 })).rejects.toThrow(HTTPException)
    })
  })
})
