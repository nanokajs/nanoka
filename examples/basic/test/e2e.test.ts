import { applyD1Migrations, env, SELF } from 'cloudflare:test'
import { d1Adapter, defineModel } from '@nanokajs/core'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { postFields, postTableName } from '../src/models/post'
import { userFields, userTableName } from '../src/models/user'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[]
    ENVIRONMENT: string
  }
}

describe('E2E: User CRUD API', () => {
  const User = defineModel(userTableName, userFields)
  const seedUser = (row: {
    id: string
    name: string
    email: string
    passwordHash: string
    createdAt: Date
  }) => User.create(d1Adapter(env.DB), row)

  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  beforeEach(async () => {
    await env.DB.exec('DELETE FROM posts')
    await env.DB.exec('DELETE FROM users')
  })

  it('1. POST /users creates user without passwordHash exposure', async () => {
    const response = await SELF.fetch('http://example.com/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice',
        email: 'alice@example.com',
      }),
    })
    expect(response.status).toBe(201)

    const data = (await response.json()) as Record<string, unknown>
    expect(data.id).toBeDefined()
    expect(data.name).toBe('Alice')
    expect(data.email).toBe('alice@example.com')
    expect(data.passwordHash).toBeUndefined()
    expect(data.createdAt).toBeDefined()
  })

  it('2. POST with passwordHash injection is blocked by validator', async () => {
    const response = await SELF.fetch('http://example.com/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob',
        email: 'bob@example.com',
        passwordHash: 'injected',
      }),
    })
    expect(response.status).toBe(201)

    const data = (await response.json()) as Record<string, unknown>
    expect(data.passwordHash).toBeUndefined()
    const result = await env.DB.prepare('SELECT passwordHash FROM users WHERE email = ?1')
      .bind('bob@example.com')
      .first<{ passwordHash: string }>()
    expect(result?.passwordHash).toBe('demo-bob@example.com')
  })

  it('3. GET /users returns array without passwordHash', async () => {
    await seedUser({
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Alice',
      email: 'alice@example.com',
      passwordHash: 'hash1',
      createdAt: new Date(),
    })

    await seedUser({
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Bob',
      email: 'bob@example.com',
      passwordHash: 'hash2',
      createdAt: new Date(),
    })

    const response = await SELF.fetch('http://example.com/users?limit=10')
    expect(response.status).toBe(200)

    const data = (await response.json()) as unknown[]
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(2)
    expect((data[0] as Record<string, unknown>).passwordHash).toBeUndefined()
    expect((data[1] as Record<string, unknown>).passwordHash).toBeUndefined()
  })

  it('4. GET /users?limit=999 returns 400 (exceeds max)', async () => {
    const response = await SELF.fetch('http://example.com/users?limit=999')
    expect(response.status).toBe(400)
  })

  it('5. GET /users/:id returns 200 or 404', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440005'
    await seedUser({
      id: userId,
      name: 'Charlie',
      email: 'charlie@example.com',
      passwordHash: 'hash3',
      createdAt: new Date(),
    })

    const existResponse = await SELF.fetch(`http://example.com/users/${userId}`)
    expect(existResponse.status).toBe(200)
    const existData = (await existResponse.json()) as Record<string, unknown>
    expect(existData.id).toBe(userId)
    expect(existData.passwordHash).toBeUndefined()

    const notFoundResponse = await SELF.fetch(
      'http://example.com/users/550e8400-e29b-41d4-a716-446655440099',
    )
    expect(notFoundResponse.status).toBe(404)
  })

  it('6. PATCH /users/:id updates fields without exposing passwordHash', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440006'
    await seedUser({
      id: userId,
      name: 'Diana',
      email: 'diana@example.com',
      passwordHash: 'hash4',
      createdAt: new Date(),
    })

    const response = await SELF.fetch(`http://example.com/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Diana2' }),
    })
    expect(response.status).toBe(200)

    const data = (await response.json()) as Record<string, unknown>
    expect(data.name).toBe('Diana2')
    expect(data.passwordHash).toBeUndefined()
  })

  it('7. DELETE /users/:id returns 204 and removes user', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440007'
    await seedUser({
      id: userId,
      name: 'Eve',
      email: 'eve@example.com',
      passwordHash: 'hash5',
      createdAt: new Date(),
    })

    const deleteResponse = await SELF.fetch(`http://example.com/users/${userId}`, {
      method: 'DELETE',
    })
    expect(deleteResponse.status).toBe(204)

    const getResponse = await SELF.fetch(`http://example.com/users/${userId}`)
    expect(getResponse.status).toBe(404)
  })
})

describe('E2E: Post CRUD API', () => {
  const User = defineModel(userTableName, userFields)
  const Post = defineModel(postTableName, postFields)

  const seedUser = (row: {
    id: string
    name: string
    email: string
    passwordHash: string
    createdAt: Date
  }) => User.create(d1Adapter(env.DB), row)

  const seedPost = (row: {
    id: string
    userId: string
    title: string
    body?: string
    createdAt: Date
  }) => Post.create(d1Adapter(env.DB), row)

  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  beforeEach(async () => {
    await env.DB.exec('DELETE FROM posts')
    await env.DB.exec('DELETE FROM users')
  })

  it('8. POST /posts creates a post with userId and title', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440010'
    await seedUser({
      id: userId,
      name: 'Alice',
      email: 'alice@example.com',
      passwordHash: 'hash1',
      createdAt: new Date(),
    })

    const response = await SELF.fetch('http://example.com/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title: 'Hello World' }),
    })
    expect(response.status).toBe(201)

    const data = (await response.json()) as Record<string, unknown>
    expect(data.id).toBeDefined()
    expect(data.userId).toBe(userId)
    expect(data.title).toBe('Hello World')
    expect(data.createdAt).toBeDefined()
  })

  it('9. GET /users/:id?with=posts returns user with posts array', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440011'
    const postId = '550e8400-e29b-41d4-a716-446655440012'

    await seedUser({
      id: userId,
      name: 'Alice',
      email: 'alice@example.com',
      passwordHash: 'hash1',
      createdAt: new Date(),
    })
    await seedPost({
      id: postId,
      userId,
      title: 'Test Post',
      createdAt: new Date(),
    })

    const response = await SELF.fetch(`http://example.com/users/${userId}?with=posts`)
    expect(response.status).toBe(200)

    const data = (await response.json()) as Record<string, unknown>
    expect(data.id).toBe(userId)
    expect(data.passwordHash).toBeUndefined()
    expect(Array.isArray(data.posts)).toBe(true)
    const posts = data.posts as Record<string, unknown>[]
    expect(posts.length).toBe(1)
    // biome-ignore lint/style/noNonNullAssertion: length is asserted to be 1 above
    expect(posts[0]!.id).toBe(postId)
    // biome-ignore lint/style/noNonNullAssertion: length is asserted to be 1 above
    expect(posts[0]!.title).toBe('Test Post')
  })

  it('10. GET /posts/:id?with=author returns post with author (no passwordHash)', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440013'
    const postId = '550e8400-e29b-41d4-a716-446655440014'

    await seedUser({
      id: userId,
      name: 'Bob',
      email: 'bob@example.com',
      passwordHash: 'secret-hash',
      createdAt: new Date(),
    })
    await seedPost({
      id: postId,
      userId,
      title: 'Authored Post',
      createdAt: new Date(),
    })

    const response = await SELF.fetch(`http://example.com/posts/${postId}?with=author`)
    expect(response.status).toBe(200)

    const data = (await response.json()) as Record<string, unknown>
    expect(data.id).toBe(postId)
    expect(data.title).toBe('Authored Post')

    // author must be present
    expect(data.author).toBeDefined()
    const author = data.author as Record<string, unknown>
    expect(author.id).toBe(userId)
    expect(author.name).toBe('Bob')

    // SECURITY: passwordHash must never leak via relation
    expect(author.passwordHash).toBeUndefined()
  })

  it('11. GET /users/:id (without with) does not include posts', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440015'

    await seedUser({
      id: userId,
      name: 'Charlie',
      email: 'charlie@example.com',
      passwordHash: 'hash3',
      createdAt: new Date(),
    })

    const response = await SELF.fetch(`http://example.com/users/${userId}`)
    expect(response.status).toBe(200)

    const data = (await response.json()) as Record<string, unknown>
    expect(data.id).toBe(userId)
    expect(data.posts).toBeUndefined()
  })
})
