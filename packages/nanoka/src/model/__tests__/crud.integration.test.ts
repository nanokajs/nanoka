import type { D1Database } from '@cloudflare/workers-types'
import { eq, like, or, sql } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { beforeEach, describe, expect, it } from 'vitest'
import { d1Adapter } from '../../adapter/d1'
import { t } from '../../field'
import { defineModel } from '../define'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database
  }
}

describe('readOnly primary UUID auto-generation', () => {
  const AutoModel = defineModel('auto_users', {
    id: t.uuid().primary().readOnly(),
    name: t.string(),
    createdAt: t
      .timestamp()
      .readOnly()
      .default(() => new Date()),
  })

  beforeEach(async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await adapter.drizzle.run(sql`DROP TABLE IF EXISTS auto_users`)
    await adapter.drizzle.run(
      sql`
        CREATE TABLE auto_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          createdAt INTEGER NOT NULL
        )
      `,
    )
  })

  it('create fills id (UUID) and createdAt (Date) automatically', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const created = await AutoModel.create(adapter, { name: 'Alice' })

    expect(typeof created.id).toBe('string')
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(created.createdAt instanceof Date).toBe(true)
    expect(created.name).toBe('Alice')
  })

  it('two consecutive creates produce unique UUIDs', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const first = await AutoModel.create(adapter, { name: 'Bob' })
    const second = await AutoModel.create(adapter, { name: 'Carol' })

    expect(first.id).not.toBe(second.id)
  })
})

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

    it('12. limit: 1000 does not throw (MAX_LIMIT cap removed)', async () => {
      const { env } = await import('cloudflare:test')
      const adapter = d1Adapter(env.DB)

      await User.create(adapter, { id: 'uuid-12', name: 'Test', email: 'test12@example.com' })

      const rows = await User.findMany(adapter, { limit: 1000 })
      expect(rows.length).toBeGreaterThanOrEqual(1)
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

describe('findMany SQL where + toResponseMany', () => {
  const WhereUser = defineModel('where_users', {
    id: t.uuid().primary(),
    name: t.string(),
    email: t.string().email(),
  })

  const SecureUser = defineModel('secure_users', {
    id: t.uuid().primary(),
    name: t.string(),
    email: t.string().email(),
    passwordHash: t.string().serverOnly(),
  })

  beforeEach(async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await adapter.drizzle.run(sql`DROP TABLE IF EXISTS where_users`)
    await adapter.drizzle.run(
      sql`
        CREATE TABLE where_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL
        )
      `,
    )

    await adapter.drizzle.run(sql`DROP TABLE IF EXISTS secure_users`)
    await adapter.drizzle.run(
      sql`
        CREATE TABLE secure_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          passwordHash TEXT NOT NULL
        )
      `,
    )
  })

  it('where: { email } equality AND still works (regression)', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await WhereUser.create(adapter, { id: 'wu-1', name: 'Alice', email: 'alice@example.com' })
    await WhereUser.create(adapter, { id: 'wu-2', name: 'Bob', email: 'bob@example.com' })

    const rows = await WhereUser.findMany(adapter, {
      limit: 20,
      where: { email: 'alice@example.com' },
    })

    expect(rows.length).toBe(1)
    expect(rows[0]!.name).toBe('Alice')
  })

  it('where: like() fetches multiple matching rows', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await WhereUser.create(adapter, { id: 'wu-3', name: 'Charlie', email: 'charlie@example.com' })
    await WhereUser.create(adapter, { id: 'wu-4', name: 'Diana', email: 'diana@example.com' })
    await WhereUser.create(adapter, { id: 'wu-5', name: 'External', email: 'external@other.org' })

    const rows = await WhereUser.findMany(adapter, {
      limit: 20,
      where: like(WhereUser.table.email, '%@example.com'),
    })

    expect(rows.length).toBe(2)
    const emails = rows.map((r) => r.email).sort()
    expect(emails).toEqual(['charlie@example.com', 'diana@example.com'])
  })

  it('where: or(eq(), eq()) performs OR search', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await WhereUser.create(adapter, { id: 'wu-6', name: 'Eve', email: 'eve@example.com' })
    await WhereUser.create(adapter, { id: 'wu-7', name: 'Frank', email: 'frank@example.com' })
    await WhereUser.create(adapter, { id: 'wu-8', name: 'Grace', email: 'grace@example.com' })

    const rows = await WhereUser.findMany(adapter, {
      limit: 20,
      where: or(
        eq(WhereUser.table.email, 'eve@example.com'),
        eq(WhereUser.table.email, 'grace@example.com'),
      ),
    })

    expect(rows.length).toBe(2)
    const names = rows.map((r) => r.name).sort()
    expect(names).toEqual(['Eve', 'Grace'])
  })

  it('toResponseMany removes serverOnly fields', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    // Insert directly via escape hatch because serverOnly fields are excluded from CreateInput
    await adapter.drizzle
      .insert(SecureUser.table)
      // biome-ignore lint/suspicious/noExplicitAny: inserting serverOnly field directly via escape hatch
      .values([
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Heidi',
          email: 'heidi@example.com',
          passwordHash: 'secret9',
        } as any,
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'Ivan',
          email: 'ivan@example.com',
          passwordHash: 'secret10',
        } as any,
      ])
      .run()

    const rows = await SecureUser.findMany(adapter, { limit: 20 })
    const responses = SecureUser.toResponseMany(rows)

    expect(responses.length).toBe(2)
    for (const resp of responses) {
      expect(resp).not.toHaveProperty('passwordHash')
      expect(resp).toHaveProperty('name')
      expect(resp).toHaveProperty('email')
    }
  })
})

describe('relation eager loading', () => {
  const RelationAuthor = defineModel('relation_authors', {
    id: t.uuid().primary(),
    name: t.string(),
  })

  const RelationComment = defineModel('relation_comments', {
    id: t.uuid().primary(),
    postId: t.uuid(),
    body: t.string(),
  })

  const RelationPost = defineModel('relation_posts', {
    id: t.uuid().primary(),
    userId: t.uuid(),
    authorId: t.uuid(),
    title: t.string(),
    author: t.belongsTo(RelationAuthor, { foreignKey: 'authorId' }),
    comments: t.hasMany(RelationComment, { foreignKey: 'postId' }),
  })

  const RelationUser = defineModel('relation_users', {
    id: t.uuid().primary(),
    name: t.string(),
    posts: t.hasMany(RelationPost, { foreignKey: 'userId' }),
  })

  // biome-ignore lint/suspicious/noExplicitAny: cyclic model graph needs lazy self references in test setup
  let CycleUser: any
  // biome-ignore lint/suspicious/noExplicitAny: cyclic model graph needs lazy self references in test setup
  let CyclePost: any
  CycleUser = defineModel('cycle_users', {
    id: t.uuid().primary(),
    posts: t.hasMany(() => CyclePost, { foreignKey: 'userId' }),
  })
  CyclePost = defineModel('cycle_posts', {
    id: t.uuid().primary(),
    userId: t.uuid(),
    user: t.belongsTo(() => CycleUser, { foreignKey: 'userId' }),
  })

  beforeEach(async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await adapter.drizzle.run(sql`DROP TABLE IF EXISTS relation_users`)
    await adapter.drizzle.run(sql`DROP TABLE IF EXISTS relation_posts`)
    await adapter.drizzle.run(sql`DROP TABLE IF EXISTS relation_authors`)
    await adapter.drizzle.run(sql`DROP TABLE IF EXISTS relation_comments`)
    await adapter.drizzle.run(sql`DROP TABLE IF EXISTS cycle_users`)
    await adapter.drizzle.run(sql`DROP TABLE IF EXISTS cycle_posts`)

    await adapter.drizzle.run(
      sql`
        CREATE TABLE relation_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        )
      `,
    )
    await adapter.drizzle.run(
      sql`
        CREATE TABLE relation_authors (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        )
      `,
    )
    await adapter.drizzle.run(
      sql`
        CREATE TABLE relation_posts (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          authorId TEXT NOT NULL,
          title TEXT NOT NULL
        )
      `,
    )
    await adapter.drizzle.run(
      sql`
        CREATE TABLE relation_comments (
          id TEXT PRIMARY KEY,
          postId TEXT NOT NULL,
          body TEXT NOT NULL
        )
      `,
    )
    await adapter.drizzle.run(
      sql`
        CREATE TABLE cycle_users (
          id TEXT PRIMARY KEY
        )
      `,
    )
    await adapter.drizzle.run(
      sql`
        CREATE TABLE cycle_posts (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL
        )
      `,
    )

    await RelationUser.create(adapter, { id: 'ru-1', name: 'Alice' })
    await RelationUser.create(adapter, { id: 'ru-2', name: 'Bob' })
    await RelationAuthor.create(adapter, { id: 'ra-1', name: 'Author One' })
    await RelationAuthor.create(adapter, { id: 'ra-2', name: 'Author Two' })
    await RelationPost.create(adapter, {
      id: 'rp-1',
      userId: 'ru-1',
      authorId: 'ra-1',
      title: 'First',
    })
    await RelationPost.create(adapter, {
      id: 'rp-2',
      userId: 'ru-1',
      authorId: 'ra-2',
      title: 'Second',
    })
    await RelationPost.create(adapter, {
      id: 'rp-3',
      userId: 'ru-2',
      authorId: 'missing-author',
      title: 'Third',
    })
    await RelationComment.create(adapter, { id: 'rc-1', postId: 'rp-1', body: 'One' })
    await RelationComment.create(adapter, { id: 'rc-2', postId: 'rp-1', body: 'Two' })
    await CycleUser.create(adapter, { id: 'cu-1' })
    await CyclePost.create(adapter, { id: 'cp-1', userId: 'cu-1' })
  })

  it('findMany loads hasMany rows grouped by parent', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const users = await RelationUser.findMany(adapter, {
      limit: 10,
      orderBy: 'id',
      with: { posts: true },
    })

    expect(users).toHaveLength(2)
    expect(users[0]!.posts.map((post) => post.id)).toEqual(['rp-1', 'rp-2'])
    expect(users[1]!.posts.map((post) => post.id)).toEqual(['rp-3'])
  })

  it('findOne loads hasMany rows', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const post = await RelationPost.findOne(adapter, 'rp-1', { with: { comments: true } })

    expect(post).not.toBeNull()
    expect(post?.comments.map((comment) => comment.id)).toEqual(['rc-1', 'rc-2'])
  })

  it('findMany loads belongsTo rows or null', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const posts = await RelationPost.findMany(adapter, {
      limit: 10,
      orderBy: 'id',
      with: { author: true },
    })

    expect(posts[0]!.author?.id).toBe('ra-1')
    expect(posts[1]!.author?.id).toBe('ra-2')
    expect(posts[2]!.author).toBeNull()
  })

  it('combines where, orderBy, offset, and with on the parent query', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const users = await RelationUser.findMany(adapter, {
      limit: 1,
      offset: 1,
      orderBy: 'id',
      where: like(RelationUser.table.id, 'ru-%'),
      with: { posts: true },
    })

    expect(users).toHaveLength(1)
    expect(users[0]!.id).toBe('ru-2')
    expect(users[0]!.posts.map((post) => post.id)).toEqual(['rp-3'])
  })

  it('returns an empty parent result without relation rows', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const users = await RelationUser.findMany(adapter, {
      limit: 10,
      where: { id: 'missing-user' },
      with: { posts: true },
    })

    expect(users).toEqual([])
  })

  it('rejects nested with at runtime', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await expect(
      RelationUser.findMany(adapter, {
        limit: 10,
        with: { posts: { with: { comments: true } } },
      } as any),
    ).rejects.toThrow(HTTPException)
  })

  it('rejects invalid relation keys at runtime', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await expect(
      RelationUser.findMany(adapter, { limit: 10, with: { name: true } } as any),
    ).rejects.toThrow(HTTPException)
  })

  it('rejects invalid with option shapes at runtime', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await expect(RelationUser.findMany(adapter, { limit: 10, with: null } as any)).rejects.toThrow(
      HTTPException,
    )
    await expect(
      RelationUser.findMany(adapter, { limit: 10, with: ['posts'] } as any),
    ).rejects.toThrow(HTTPException)
  })

  it('allows depth-1 hasMany loading on bidirectional relation graphs', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const users = await CycleUser.findMany(adapter, {
      limit: 10,
      with: { posts: true },
    })

    expect(users).toHaveLength(1)
    expect(users[0]!.posts.map((post: { id: string }) => post.id)).toEqual(['cp-1'])
  })

  it('allows depth-1 belongsTo loading on bidirectional relation graphs', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const posts = await CyclePost.findMany(adapter, {
      limit: 10,
      with: { user: true },
    })

    expect(posts).toHaveLength(1)
    expect(posts[0]!.user?.id).toBe('cu-1')
  })

  it('returns null for findOne with missing parent row and with option', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await expect(
      CycleUser.findOne(adapter, 'missing-user', { with: { posts: true } }),
    ).resolves.toBeNull()
  })

  it('validates findOne with option before returning null for missing parent rows', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await expect(
      CycleUser.findOne(adapter, 'missing-user', {
        with: { posts: { with: { user: true } } },
      } as any),
    ).rejects.toThrow(HTTPException)
    await expect(
      CycleUser.findOne(adapter, 'missing-user', { with: { name: true } } as any),
    ).rejects.toThrow(HTTPException)
  })
})

describe('findAll', () => {
  const AllUser = defineModel('all_users', {
    id: t.uuid().primary(),
    name: t.string(),
    email: t.string().email(),
  })

  beforeEach(async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await adapter.drizzle.run(sql`DROP TABLE IF EXISTS all_users`)
    await adapter.drizzle.run(
      sql`
        CREATE TABLE all_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL
        )
      `,
    )

    await AllUser.create(adapter, { id: 'all-1', name: 'Alice', email: 'alice@example.com' })
    await AllUser.create(adapter, { id: 'all-2', name: 'Bob', email: 'bob@example.com' })
    await AllUser.create(adapter, { id: 'all-3', name: 'Charlie', email: 'charlie@example.com' })
  })

  it('returns all rows without arguments', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const rows = await AllUser.findAll(adapter)
    expect(rows.length).toBe(3)
  })

  it('returns all rows with empty options object', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const rows = await AllUser.findAll(adapter, {})
    expect(rows.length).toBe(3)
  })

  it('offset reduces returned rows', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const rows = await AllUser.findAll(adapter, { offset: 1, orderBy: 'id' })
    expect(rows.length).toBe(2)
    expect(rows[0]!.id).toBe('all-2')
    expect(rows[1]!.id).toBe('all-3')
  })

  it('orderBy asc sorts correctly', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const rows = await AllUser.findAll(adapter, { orderBy: 'name' })
    expect(rows.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('orderBy desc sorts correctly', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const rows = await AllUser.findAll(adapter, { orderBy: { column: 'name', direction: 'desc' } })
    expect(rows.map((r) => r.name)).toEqual(['Charlie', 'Bob', 'Alice'])
  })

  it('orderBy as array sorts by multiple columns', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const rows = await AllUser.findAll(adapter, {
      orderBy: ['name', { column: 'id', direction: 'asc' }],
    })
    expect(rows.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('where plain object filters rows', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const rows = await AllUser.findAll(adapter, { where: { email: 'alice@example.com' } })
    expect(rows.length).toBe(1)
    expect(rows[0]!.name).toBe('Alice')
  })

  it('where Drizzle SQL expression (like) filters rows', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    const rows = await AllUser.findAll(adapter, {
      where: like(AllUser.table.email, '%@example.com'),
    })
    expect(rows.length).toBe(3)
  })

  it('rejects invalid orderBy column name (identifier injection guard)', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: intentional invalid orderBy for guard test
      AllUser.findAll(adapter, { orderBy: 'evil; drop' as any }),
    ).rejects.toThrow(HTTPException)
  })

  it('rejects negative offset', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: intentional invalid offset for guard test
      AllUser.findAll(adapter, { offset: -1 as any }),
    ).rejects.toThrow(HTTPException)
  })

  it('rejects non-integer offset', async () => {
    const { env } = await import('cloudflare:test')
    const adapter = d1Adapter(env.DB)

    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: intentional invalid offset for guard test
      AllUser.findAll(adapter, { offset: 1.5 as any }),
    ).rejects.toThrow(HTTPException)
  })
})
