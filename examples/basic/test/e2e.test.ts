import { applyD1Migrations, env, SELF } from 'cloudflare:test'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[]
    ENVIRONMENT: string
  }
}

describe('E2E: User CRUD API', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  beforeEach(async () => {
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
    await env.DB.prepare(
      'INSERT INTO users (id, name, email, passwordHash, createdAt) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(
        '550e8400-e29b-41d4-a716-446655440001',
        'Alice',
        'alice@example.com',
        'hash1',
        Date.now(),
      )
      .run()

    await env.DB.prepare(
      'INSERT INTO users (id, name, email, passwordHash, createdAt) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind('550e8400-e29b-41d4-a716-446655440002', 'Bob', 'bob@example.com', 'hash2', Date.now())
      .run()

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
    await env.DB.prepare(
      'INSERT INTO users (id, name, email, passwordHash, createdAt) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(userId, 'Charlie', 'charlie@example.com', 'hash3', Date.now())
      .run()

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
    await env.DB.prepare(
      'INSERT INTO users (id, name, email, passwordHash, createdAt) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(userId, 'Diana', 'diana@example.com', 'hash4', Date.now())
      .run()

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
    await env.DB.prepare(
      'INSERT INTO users (id, name, email, passwordHash, createdAt) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(userId, 'Eve', 'eve@example.com', 'hash5', Date.now())
      .run()

    const deleteResponse = await SELF.fetch(`http://example.com/users/${userId}`, {
      method: 'DELETE',
    })
    expect(deleteResponse.status).toBe(204)

    const getResponse = await SELF.fetch(`http://example.com/users/${userId}`)
    expect(getResponse.status).toBe(404)
  })
})
