import type { NanokaModel } from '@nanokajs/core'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createAuth } from '../create-auth.js'
import type { Hasher } from '../hasher.js'
import { pbkdf2Hasher } from '../hashers/pbkdf2.js'
import { verify } from '../jwt.js'

const SECRET = 'test-secret-key-must-be-at-least-32-chars'

function makeFakeModel(users: Array<{ id: string; [key: string]: string }>) {
  return {
    findOne: async (where: Record<string, unknown>) => {
      const [key, val] = Object.entries(where)[0] as [string, unknown]
      return users.find((u) => u[key] === val) ?? null
    },
    // biome-ignore lint/suspicious/noExplicitAny: NanokaModel<any> is necessary for test fake implementation
  } as unknown as NanokaModel<any>
}

function makeApp(
  // biome-ignore lint/suspicious/noExplicitAny: NanokaModel<any> is necessary for test helper
  model: NanokaModel<any>,
  opts?: { hasher?: Hasher; jwt?: { expiresIn?: number; refreshExpiresIn?: number } },
) {
  const auth = createAuth({
    model,
    secret: SECRET,
    fields: { identifier: 'email', password: 'passwordHash' },
    ...opts,
  })
  const app = new Hono()
  app.post('/login', auth.loginHandler())
  app.post('/refresh', auth.refreshHandler())
  return app
}

describe('createAuth', () => {
  it('正常ログインで accessToken / refreshToken が返る', async () => {
    const hash = await pbkdf2Hasher.hash('password123')
    const model = makeFakeModel([{ id: 'user-1', email: 'test@example.com', passwordHash: hash }])
    const app = makeApp(model)

    const res = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', passwordHash: 'password123' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { accessToken: string; refreshToken: string }
    expect(typeof body.accessToken).toBe('string')
    expect(typeof body.refreshToken).toBe('string')

    const accessPayload = await verify<{ sub: string; type: string }>(body.accessToken, SECRET)
    expect(accessPayload.sub).toBe('user-1')
    expect(accessPayload.type).toBe('access')

    const refreshPayload = await verify<{ type: string }>(body.refreshToken, SECRET)
    expect(refreshPayload.type).toBe('refresh')
  })

  it('不正パスワードで 401', async () => {
    const hash = await pbkdf2Hasher.hash('password123')
    const model = makeFakeModel([{ id: 'user-1', email: 'test@example.com', passwordHash: hash }])
    const app = makeApp(model)

    const res = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', passwordHash: 'wrongpassword' }),
    })
    expect(res.status).toBe(401)
  })

  it('存在しない identifier で 401（タイミング攻撃対策）', async () => {
    const model = makeFakeModel([])
    const app = makeApp(model)

    const res = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notexist@example.com', passwordHash: 'anypassword' }),
    })
    expect(res.status).toBe(401)
    const text = await res.text()
    expect(text).toBe('Invalid credentials')
  })

  it('refresh token で新しい access token が取得できる', async () => {
    const hash = await pbkdf2Hasher.hash('password123')
    const model = makeFakeModel([
      { id: 'user-2', email: 'refresh@example.com', passwordHash: hash },
    ])
    const app = makeApp(model)

    const loginRes = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'refresh@example.com', passwordHash: 'password123' }),
    })
    expect(loginRes.status).toBe(200)
    const { refreshToken } = (await loginRes.json()) as { refreshToken: string }

    const refreshRes = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    expect(refreshRes.status).toBe(200)

    const body = (await refreshRes.json()) as { accessToken: string }
    const payload = await verify<{ sub: string; type: string }>(body.accessToken, SECRET)
    expect(payload.type).toBe('access')
    expect(payload.sub).toBe('user-2')
  })

  it('access token を refresh エンドポイントに送ると 401', async () => {
    const hash = await pbkdf2Hasher.hash('password123')
    const model = makeFakeModel([{ id: 'user-3', email: 'access@example.com', passwordHash: hash }])
    const app = makeApp(model)

    const loginRes = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'access@example.com', passwordHash: 'password123' }),
    })
    const { accessToken } = (await loginRes.json()) as { accessToken: string }

    const res = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: accessToken }),
    })
    expect(res.status).toBe(401)
  })

  it('改ざん / 別 secret の refresh token で 401', async () => {
    const app = makeApp(makeFakeModel([]))

    const res = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'tampered.invalid.token' }),
    })
    expect(res.status).toBe(401)
  })

  it('middleware() は access token のみを受け入れ refresh token を拒否する', async () => {
    const hash = await pbkdf2Hasher.hash('password123')
    const model = makeFakeModel([{ id: 'user-mw', email: 'mw@example.com', passwordHash: hash }])
    const auth = createAuth({
      model,
      secret: SECRET,
      fields: { identifier: 'email', password: 'passwordHash' },
    })
    const app = new Hono()
    app.post('/login', auth.loginHandler())
    app.use('/protected', auth.middleware())
    app.get('/protected', (c) => c.json({ ok: true }))

    const loginRes = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mw@example.com', passwordHash: 'password123' }),
    })
    const { accessToken, refreshToken } = (await loginRes.json()) as {
      accessToken: string
      refreshToken: string
    }

    const okRes = await app.request('/protected', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(okRes.status).toBe(200)

    const ngRes = await app.request('/protected', {
      headers: { Authorization: `Bearer ${refreshToken}` },
    })
    expect(ngRes.status).toBe(401)
  })

  it('カスタム hasher が差し込めるテスト（タイミング攻撃対策を含む）', async () => {
    const verifyCalls: Array<[string, string]> = []
    const stubHasher: Hasher = {
      hash: async (plain: string) => `stub:${plain}`,
      verify: async (plain: string, stored: string) => {
        verifyCalls.push([plain, stored])
        return stored === `stub:${plain}`
      },
    }

    const model = makeFakeModel([
      { id: 'user-stub', email: 'stub@example.com', passwordHash: 'stub:correctpassword' },
    ])
    const app = makeApp(model, { hasher: stubHasher })

    const res = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'stub@example.com', passwordHash: 'correctpassword' }),
    })
    expect(res.status).toBe(200)
    expect(verifyCalls.length).toBeGreaterThanOrEqual(1)
    expect(verifyCalls.some(([plain]) => plain === 'correctpassword')).toBe(true)

    verifyCalls.length = 0
    const missRes = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notexist@example.com', passwordHash: 'anypassword' }),
    })
    expect(missRes.status).toBe(401)
    expect(verifyCalls.length).toBeGreaterThanOrEqual(1)
  })
})
