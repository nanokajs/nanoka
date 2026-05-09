import { applyD1Migrations, env, SELF } from 'cloudflare:test'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    AUTH_SECRET: string
  }
}

describe('E2E: Auth API', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  })

  beforeEach(async () => {
    await env.DB.exec('DELETE FROM posts')
    await env.DB.exec('DELETE FROM users')
  })

  it('ハッピーパス: register → login → /me → refresh → /me', async () => {
    // register
    const registerRes = await SELF.fetch('http://example.com/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        name: 'Alice',
        passwordHash: 'password123',
      }),
    })
    expect(registerRes.status).toBe(201)
    const registerData = (await registerRes.json()) as Record<string, unknown>
    expect(registerData.id).toBeDefined()
    expect(registerData.email).toBe('alice@example.com')
    expect(registerData.name).toBe('Alice')
    // serverOnly フィールドが露出していないこと
    expect(registerData.passwordHash).toBeUndefined()

    // login
    const loginRes = await SELF.fetch('http://example.com/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', passwordHash: 'password123' }),
    })
    expect(loginRes.status).toBe(200)
    const loginData = (await loginRes.json()) as { accessToken: string; refreshToken: string }
    expect(typeof loginData.accessToken).toBe('string')
    expect(typeof loginData.refreshToken).toBe('string')

    const { accessToken, refreshToken } = loginData

    // /me with accessToken
    const meRes = await SELF.fetch('http://example.com/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(meRes.status).toBe(200)
    const meData = (await meRes.json()) as Record<string, unknown>
    expect(meData.email).toBe('alice@example.com')
    expect(meData.name).toBe('Alice')
    // serverOnly フィールドが露出していないこと
    expect(meData.passwordHash).toBeUndefined()

    // refresh
    const refreshRes = await SELF.fetch('http://example.com/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    expect(refreshRes.status).toBe(200)
    const refreshData = (await refreshRes.json()) as { accessToken: string }
    expect(typeof refreshData.accessToken).toBe('string')

    // /me with new accessToken
    const me2Res = await SELF.fetch('http://example.com/me', {
      headers: { Authorization: `Bearer ${refreshData.accessToken}` },
    })
    expect(me2Res.status).toBe(200)
    const me2Data = (await me2Res.json()) as Record<string, unknown>
    expect(me2Data.email).toBe('alice@example.com')
  })

  it('不正トークン → 401', async () => {
    const res = await SELF.fetch('http://example.com/me', {
      headers: { Authorization: 'Bearer invalid.token.here' },
    })
    expect(res.status).toBe(401)
  })

  it('Authorization ヘッダなし → 401', async () => {
    const res = await SELF.fetch('http://example.com/me')
    expect(res.status).toBe(401)
  })
})
