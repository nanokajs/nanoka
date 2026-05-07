import type { D1Migration } from 'cloudflare:test'
import { applyD1Migrations, env } from 'cloudflare:test'
import { d1Adapter, nanoka, t } from '@nanokajs/core'
import { Hono } from 'hono'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createAuth } from '../create-auth.js'
import { pbkdf2Hasher } from '../hashers/pbkdf2.js'
import { verify } from '../jwt.js'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    // biome-ignore lint/suspicious/noExplicitAny: D1Database is provided by miniflare at runtime
    DB: any
    TEST_MIGRATIONS: D1Migration[]
    AUTH_SECRET: string
  }
}

const userTableName = 'users'
const userFields = {
  id: t.uuid().primary().readOnly(),
  email: t.string().email().unique(),
  passwordHash: t.string().serverOnly(),
  createdAt: t.timestamp().readOnly(),
}

async function seedUser(opts: { id: string; email: string; password: string }): Promise<void> {
  const passwordHash = await pbkdf2Hasher.hash(opts.password)
  await env.DB.prepare(
    'INSERT INTO users (id, email, passwordHash, createdAt) VALUES (?1, ?2, ?3, ?4)',
  )
    .bind(opts.id, opts.email, passwordHash, Date.now())
    .run()
}

function makeApp(cookieMode = false) {
  const nanokaApp = nanoka(d1Adapter(env.DB))
  const User = nanokaApp.model(userTableName, userFields)

  const auth = createAuth({
    model: User,
    secret: env.AUTH_SECRET,
    fields: { identifier: 'email', password: 'passwordHash' },
    ...(cookieMode ? { cookie: {} } : {}),
  })

  const app = new Hono<{ Bindings: typeof env }>()
  app.post('/auth/login', auth.loginHandler())
  app.post('/auth/refresh', auth.refreshHandler())
  app.use('/me', auth.middleware())
  app.get('/me', (c) => c.json({ ok: true }))

  return app
}

describe('E2E Workers: createAuth with D1', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM users').run()
  })

  it('シナリオ1: 正常ログイン → access/refresh トークン取得 → /me で 200', async () => {
    const id = crypto.randomUUID()
    await seedUser({ id, email: 'alice@example.com', password: 'password123' })

    const app = makeApp()

    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `fields.password` に 'passwordHash' を指定しているため、リクエストボディのキー名は 'passwordHash'
      // (実際に送るのは平文パスワード)
      body: JSON.stringify({ email: 'alice@example.com', passwordHash: 'password123' }),
    })
    expect(loginRes.status).toBe(200)

    const body = (await loginRes.json()) as { accessToken: string; refreshToken: string }
    expect(typeof body.accessToken).toBe('string')
    expect(typeof body.refreshToken).toBe('string')

    const payload = await verify<{ sub: string; type: string }>(body.accessToken, env.AUTH_SECRET)
    expect(payload.sub).toBe(id)
    expect(payload.type).toBe('access')

    const meRes = await app.request('/me', {
      headers: { Authorization: `Bearer ${body.accessToken}` },
    })
    expect(meRes.status).toBe(200)
  })

  it('シナリオ2: 不正パスワード → 401', async () => {
    const id = crypto.randomUUID()
    await seedUser({ id, email: 'bob@example.com', password: 'password123' })

    const app = makeApp()

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `fields.password` に 'passwordHash' を指定しているため、リクエストボディのキー名は 'passwordHash'
      // (実際に送るのは平文パスワード)
      body: JSON.stringify({ email: 'bob@example.com', passwordHash: 'wrongpassword' }),
    })
    expect(res.status).toBe(401)
  })

  it('シナリオ3: 存在しない email → 401', async () => {
    const app = makeApp()

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `fields.password` に 'passwordHash' を指定しているため、リクエストボディのキー名は 'passwordHash'
      // (実際に送るのは平文パスワード)
      body: JSON.stringify({ email: 'notexist@example.com', passwordHash: 'anypassword' }),
    })
    expect(res.status).toBe(401)
  })

  it('シナリオ4: cookie モード — Set-Cookie に access_token / refresh_token が含まれ、refresh で新しい access_token が返る', async () => {
    const id = crypto.randomUUID()
    await seedUser({ id, email: 'carol@example.com', password: 'password123' })

    const app = makeApp(true)

    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `fields.password` に 'passwordHash' を指定しているため、リクエストボディのキー名は 'passwordHash'
      // (実際に送るのは平文パスワード)
      body: JSON.stringify({ email: 'carol@example.com', passwordHash: 'password123' }),
    })
    expect(loginRes.status).toBe(200)

    const setCookieHeaders = loginRes.headers.getSetCookie()
    const accessCookie = setCookieHeaders.find((h) => h.startsWith('access_token='))
    const refreshCookie = setCookieHeaders.find((h) => h.startsWith('refresh_token='))
    expect(accessCookie).toBeDefined()
    expect(refreshCookie).toBeDefined()

    const refreshTokenValue =
      // biome-ignore lint/style/noNonNullAssertion: refreshCookie is asserted above
      refreshCookie!.split(';').at(0)?.replace('refresh_token=', '') ?? ''

    const refreshRes = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { Cookie: `refresh_token=${refreshTokenValue}` },
    })
    expect(refreshRes.status).toBe(200)

    const refreshSetCookies = refreshRes.headers.getSetCookie()
    const newAccessCookie = refreshSetCookies.find((h) => h.startsWith('access_token='))
    expect(newAccessCookie).toBeDefined()
  })
})
