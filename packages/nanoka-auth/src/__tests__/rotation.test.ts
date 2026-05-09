import type { NanokaModel } from '@nanokajs/core'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { BlacklistStore } from '../blacklist-store.js'
import type { CookieOptions } from '../create-auth.js'
import { createAuth } from '../create-auth.js'
import { pbkdf2Hasher } from '../hashers/pbkdf2.js'
import { sign, verify } from '../jwt.js'

const SECRET = 'test-secret-key-must-be-at-least-32-chars'

function makeInMemoryBlacklist(): BlacklistStore {
  const store = new Map<string, number>()
  return {
    async add(jti: string, expiresAt: number): Promise<void> {
      store.set(jti, expiresAt)
    },
    async has(jti: string): Promise<boolean> {
      const exp = store.get(jti)
      if (exp === undefined) return false
      if (Math.floor(Date.now() / 1000) >= exp) {
        store.delete(jti)
        return false
      }
      return true
    },
  }
}

function makeFakeModel(users: Array<{ id: string; [key: string]: string }>) {
  return {
    findOne: async (where: Record<string, unknown>) => {
      const [key, val] = Object.entries(where)[0] as [string, unknown]
      return users.find((u) => u[key] === val) ?? null
    },
    // biome-ignore lint/suspicious/noExplicitAny: NanokaModel<any> is necessary for test fake implementation
  } as unknown as NanokaModel<any>
}

async function makeUserAndApp(opts?: {
  rotation?: boolean
  blacklist?: BlacklistStore
  cookie?: CookieOptions
}): Promise<Hono> {
  const hash = await pbkdf2Hasher.hash('password123')
  const model = makeFakeModel([{ id: 'user-1', email: 'test@example.com', passwordHash: hash }])

  const auth = createAuth({
    model,
    secret: SECRET,
    fields: { identifier: 'email', password: 'passwordHash' },
    jwt: { rotation: opts?.rotation },
    blacklist: opts?.blacklist,
    cookie: opts?.cookie,
  })
  const app = new Hono()
  app.post('/login', auth.loginHandler())
  app.post('/refresh', auth.refreshHandler())
  return app
}

async function login(app: Hono) {
  const res = await app.request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', passwordHash: 'password123' }),
  })
  return res
}

describe('rotation 無効時の互換性', () => {
  it('refreshHandler が { accessToken } のみを返す', async () => {
    const app = await makeUserAndApp()
    const loginRes = await login(app)
    const { refreshToken } = (await loginRes.json()) as { refreshToken: string }

    const refreshRes = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    expect(refreshRes.status).toBe(200)
    const body = (await refreshRes.json()) as Record<string, unknown>
    expect(typeof body.accessToken).toBe('string')
    expect(body.refreshToken).toBeUndefined()
  })

  it('rotation 無効時は access token に jti が付かない', async () => {
    const app = await makeUserAndApp()
    const loginRes = await login(app)
    const { accessToken } = (await loginRes.json()) as { accessToken: string }
    const payload = await verify<Record<string, unknown>>(accessToken, SECRET)
    expect(payload.jti).toBeUndefined()
  })
})

describe('rotation 有効時の正常系', () => {
  it('loginHandler が refresh token に jti を付与する', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist })
    const loginRes = await login(app)
    const { refreshToken } = (await loginRes.json()) as { refreshToken: string }
    const payload = await verify<Record<string, unknown>>(refreshToken, SECRET)
    expect(typeof payload.jti).toBe('string')
    expect((payload.jti as string).length).toBeGreaterThan(0)
  })

  it('access token には jti が付かない', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist })
    const loginRes = await login(app)
    const { accessToken } = (await loginRes.json()) as { accessToken: string }
    const payload = await verify<Record<string, unknown>>(accessToken, SECRET)
    expect(payload.jti).toBeUndefined()
  })

  it('refreshHandler が { accessToken, refreshToken } を返す', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist })
    const loginRes = await login(app)
    const { refreshToken } = (await loginRes.json()) as { refreshToken: string }

    const refreshRes = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    expect(refreshRes.status).toBe(200)
    const body = (await refreshRes.json()) as Record<string, unknown>
    expect(typeof body.accessToken).toBe('string')
    expect(typeof body.refreshToken).toBe('string')
  })

  it('新 refresh token は別の jti を持つ', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist })
    const loginRes = await login(app)
    const { refreshToken: oldRefreshToken } = (await loginRes.json()) as { refreshToken: string }
    const oldPayload = await verify<Record<string, unknown>>(oldRefreshToken, SECRET)

    const refreshRes = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: oldRefreshToken }),
    })
    const { refreshToken: newRefreshToken } = (await refreshRes.json()) as { refreshToken: string }
    const newPayload = await verify<Record<string, unknown>>(newRefreshToken, SECRET)

    expect(newPayload.jti).not.toBe(oldPayload.jti)
  })
})

describe('rotation 有効時の再利用拒否', () => {
  it('同じ refresh token を 2 回使うと 2 回目は 401', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist })
    const loginRes = await login(app)
    const { refreshToken } = (await loginRes.json()) as { refreshToken: string }

    const first = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    expect(first.status).toBe(200)

    const second = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    expect(second.status).toBe(401)
  })

  it('連鎖: 1→2→3 で 1 を再利用すると 401', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist })
    const loginRes = await login(app)
    const { refreshToken: token1 } = (await loginRes.json()) as { refreshToken: string }

    const res2 = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token1 }),
    })
    const { refreshToken: token2 } = (await res2.json()) as { refreshToken: string }

    await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token2 }),
    })

    const reuse = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token1 }),
    })
    expect(reuse.status).toBe(401)
  })
})

describe('cookie モード + rotation', () => {
  it('loginHandler が Set-Cookie で refresh_token を設定する', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist, cookie: {} })
    const loginRes = await login(app)
    expect(loginRes.status).toBe(200)

    const setCookies = loginRes.headers.getSetCookie()
    const refreshCookie = setCookies.find((h) => h.startsWith('refresh_token='))
    expect(refreshCookie).toBeDefined()
  })

  it('refreshHandler が新しい access_token と refresh_token の両方を Set-Cookie で書き戻す', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist, cookie: {} })
    const loginRes = await login(app)

    const setCookies = loginRes.headers.getSetCookie()
    const refreshCookieHeader = setCookies.find((h) => h.startsWith('refresh_token='))
    if (refreshCookieHeader === undefined) throw new Error('refresh_token cookie not set')
    const refreshTokenValue =
      refreshCookieHeader.split(';').at(0)?.replace('refresh_token=', '') ?? ''

    const refreshRes = await app.request('/refresh', {
      method: 'POST',
      headers: { Cookie: `refresh_token=${refreshTokenValue}` },
    })
    expect(refreshRes.status).toBe(200)

    const body = (await refreshRes.json()) as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.accessToken).toBeUndefined()
    expect(body.refreshToken).toBeUndefined()

    const refreshSetCookies = refreshRes.headers.getSetCookie()
    const newAccessCookie = refreshSetCookies.find((h) => h.startsWith('access_token='))
    const newRefreshCookie = refreshSetCookies.find((h) => h.startsWith('refresh_token='))
    expect(newAccessCookie).toBeDefined()
    expect(newRefreshCookie).toBeDefined()
  })

  it('cookie モード: 同じ refresh_token を 2 回使うと 2 回目は 401', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist, cookie: {} })
    const loginRes = await login(app)

    const setCookies = loginRes.headers.getSetCookie()
    const refreshCookieHeader = setCookies.find((h) => h.startsWith('refresh_token='))
    if (refreshCookieHeader === undefined) throw new Error('refresh_token cookie not set')
    const refreshTokenValue =
      refreshCookieHeader.split(';').at(0)?.replace('refresh_token=', '') ?? ''

    await app.request('/refresh', {
      method: 'POST',
      headers: { Cookie: `refresh_token=${refreshTokenValue}` },
    })

    const second = await app.request('/refresh', {
      method: 'POST',
      headers: { Cookie: `refresh_token=${refreshTokenValue}` },
    })
    expect(second.status).toBe(401)
  })
})

describe('blacklist 未指定 + rotation: true の早期失敗', () => {
  it('createAuth 呼び出しで Error を throw する', () => {
    const model = makeFakeModel([])
    expect(() =>
      createAuth({
        model,
        secret: SECRET,
        fields: { identifier: 'email', password: 'passwordHash' },
        jwt: { rotation: true },
      }),
    ).toThrow('createAuth: blacklist is required when jwt.rotation is true')
  })
})

describe('rotation 有効時の jti 欠落拒否', () => {
  it('jti を持たない refresh token を送ると 401 になる', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist })

    const tokenWithoutJti = await sign({ sub: 'user-1', type: 'refresh' }, SECRET, {
      expiresIn: 604_800,
    })

    const res = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokenWithoutJti }),
    })
    expect(res.status).toBe(401)
  })
})
