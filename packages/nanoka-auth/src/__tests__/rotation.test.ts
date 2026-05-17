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

type Entry = { exp: number; payload: '1' | { sub: string } }

function makeBlacklistWithSubject(): BlacklistStore {
  const storeMap = new Map<string, Entry>()
  return {
    async add(jti, expiresAt) {
      storeMap.set(jti, { exp: expiresAt, payload: '1' })
    },
    async has(jti) {
      const e = storeMap.get(jti)
      if (!e) return false
      if (Math.floor(Date.now() / 1000) >= e.exp) return false
      return true
    },
    async addWithSubject(jti, sub, expiresAt) {
      storeMap.set(jti, { exp: expiresAt, payload: { sub } })
    },
    async hasForSubject(jti, sub) {
      const e = storeMap.get(jti)
      if (!e) return false
      if (Math.floor(Date.now() / 1000) >= e.exp) return false
      if (e.payload === '1') return true
      return e.payload.sub === sub
    },
  }
}

describe('M-1: addWithSubject/hasForSubject 対応 BlacklistStore の sub 一致チェック', () => {
  it('同一 sub での jti 再利用は blacklist で 401 になる', async () => {
    const blacklist = makeBlacklistWithSubject()
    const app = await makeUserAndApp({ rotation: true, blacklist })

    const loginRes = await login(app)
    const { refreshToken: refreshTokenA } = (await loginRes.json()) as { refreshToken: string }

    const firstRefresh = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshTokenA }),
    })
    expect(firstRefresh.status).toBe(200)

    const reuseByUser1 = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshTokenA }),
    })
    expect(reuseByUser1.status).toBe(401)
  })

  it('異なる sub の crafted token は別ユーザーの blacklist で false-positive にならない', async () => {
    const blacklist = makeBlacklistWithSubject()
    const app = await makeUserAndApp({ rotation: true, blacklist })

    const loginRes = await login(app)
    const { refreshToken: refreshTokenA } = (await loginRes.json()) as { refreshToken: string }
    const payloadA = await verify<Record<string, unknown>>(refreshTokenA, SECRET)
    const jtiA = payloadA.jti as string

    const firstRefresh = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshTokenA }),
    })
    expect(firstRefresh.status).toBe(200)

    // 攻撃者が jti_A を知っていると仮定し、sub='user-2' として crafted token を作成する
    // hasForSubject(jti_A, 'user-2') は false を返す (user-2 にとっては blacklist 未登録)
    // → user-2 の crafted token は 200 OK になる
    const craftedTokenForUser2 = await sign({ sub: 'user-2', type: 'refresh', jti: jtiA }, SECRET, {
      expiresIn: 604_800,
    })
    const craftedRefresh = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: craftedTokenForUser2 }),
    })
    expect(craftedRefresh.status).toBe(200)
  })

  it('addWithSubject 未実装の自前 BlacklistStore は従来の has 経路で動く（後方互換）', async () => {
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
})

describe('M-2: verify 失敗時のエラー情報漏洩防止', () => {
  it('verify 失敗時のレスポンスに err.cause が含まれない', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist })

    const res = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'invalid.token.value' }),
    })
    expect(res.status).toBe(401)
    const body = await res.text()
    expect(body).not.toContain('cause')
    expect(body).not.toContain('stack')
    expect(body).not.toContain('Error')
  })
})

describe('m-2: cookie モード空文字列フォールバック', () => {
  it('cookie モードで refresh_token が空文字列は body fallback に進む (rotation 無効)', async () => {
    const app = await makeUserAndApp({ cookie: {} })

    const refreshToken = await sign({ sub: 'user-1', type: 'refresh' }, SECRET, {
      expiresIn: 604_800,
    })

    const res = await app.request('/refresh', {
      method: 'POST',
      headers: {
        Cookie: 'refresh_token=',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })
    expect(res.status).toBe(200)
  })

  it('rotation 有効 + cookie モードで refresh_token が空文字列は 401', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist, cookie: {} })

    const res = await app.request('/refresh', {
      method: 'POST',
      headers: {
        Cookie: 'refresh_token=',
        'Content-Type': 'application/json',
      },
    })
    expect(res.status).toBe(401)
  })
})

describe('m-3: jti フォーマット検証', () => {
  it('jti が 257 文字以上は 401', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist })

    const longJti = 'a'.repeat(257)
    const tokenWithLongJti = await sign({ sub: 'user-1', type: 'refresh', jti: longJti }, SECRET, {
      expiresIn: 604_800,
    })

    const res = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokenWithLongJti }),
    })
    expect(res.status).toBe(401)
  })

  it('jti に base64url 外の文字 (空白) は 401', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist })

    const tokenWithSpace = await sign(
      { sub: 'user-1', type: 'refresh', jti: 'hello world' },
      SECRET,
      { expiresIn: 604_800 },
    )

    const res = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokenWithSpace }),
    })
    expect(res.status).toBe(401)
  })

  it('jti に base64url 外の文字 (日本語) は 401', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist })

    const tokenWithJapanese = await sign(
      { sub: 'user-1', type: 'refresh', jti: 'あいう' },
      SECRET,
      { expiresIn: 604_800 },
    )

    const res = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokenWithJapanese }),
    })
    expect(res.status).toBe(401)
  })

  it('crypto.randomUUID() 形式の jti (- 含む) は許容される', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist })
    const loginRes = await login(app)
    const { refreshToken } = (await loginRes.json()) as { refreshToken: string }
    const payload = await verify<Record<string, unknown>>(refreshToken, SECRET)

    expect(typeof payload.jti).toBe('string')
    expect(payload.jti as string).toMatch(/^[0-9a-f-]+$/)

    const res = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    expect(res.status).toBe(200)
  })

  it('jti に制御文字 (\\x00) は 401', async () => {
    const blacklist = makeInMemoryBlacklist()
    const app = await makeUserAndApp({ rotation: true, blacklist })

    const tokenWithControl = await sign(
      { sub: 'user-1', type: 'refresh', jti: 'hello\x00world' },
      SECRET,
      { expiresIn: 604_800 },
    )

    const res = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokenWithControl }),
    })
    expect(res.status).toBe(401)
  })
})
