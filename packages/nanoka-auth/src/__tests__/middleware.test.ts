import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { sign } from '../jwt.js'
import { authMiddleware } from '../middleware.js'

const SECRET = 'test-secret-key'

describe('authMiddleware', () => {
  it('valid token passes through and sets user on context', async () => {
    type AuthVars = { user: { sub: string } }
    const app = new Hono<{ Variables: AuthVars }>()
    app.use('/protected', authMiddleware<AuthVars['user']>({ secret: SECRET }))
    app.get('/protected', (c) => c.json({ user: c.get('user') }))

    const token = await sign({ sub: 'user-1', type: 'access' }, SECRET)
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as AuthVars
    expect(body.user.sub).toBe('user-1')
  })

  it('missing Authorization header returns 401', async () => {
    const app = new Hono()
    app.use('/protected', authMiddleware({ secret: SECRET }))
    app.get('/protected', (c) => c.json({ ok: true }))

    const res = await app.request('/protected')
    expect(res.status).toBe(401)
  })

  it('Authorization: Token xxx (non-Bearer) returns 401', async () => {
    const token = await sign({ sub: 'user-1' }, SECRET)
    const app = new Hono()
    app.use('/protected', authMiddleware({ secret: SECRET }))
    app.get('/protected', (c) => c.json({ ok: true }))

    const res = await app.request('/protected', {
      headers: { Authorization: `Token ${token}` },
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 when Bearer has no trailing token', async () => {
    const app = new Hono()
    app.use('/protected', authMiddleware({ secret: SECRET }))
    app.get('/protected', (c) => c.json({ ok: true }))

    const res = await app.request('/protected', {
      headers: { Authorization: 'Bearer ' },
    })
    expect(res.status).toBe(401)
  })

  it('token signed with different secret returns 401', async () => {
    const token = await sign({ sub: 'user-1' }, 'other-secret')
    const app = new Hono()
    app.use('/protected', authMiddleware({ secret: SECRET }))
    app.get('/protected', (c) => c.json({ ok: true }))

    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(401)
  })

  it('expired token returns 401', async () => {
    const token = await sign({ sub: 'user-1' }, SECRET, { expiresIn: -1 })
    const app = new Hono()
    app.use('/protected', authMiddleware({ secret: SECRET }))
    app.get('/protected', (c) => c.json({ ok: true }))

    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(401)
  })

  it('lowercase bearer scheme passes through (case-insensitive)', async () => {
    type AuthVars = { user: { sub: string } }
    const app = new Hono<{ Variables: AuthVars }>()
    app.use('/protected', authMiddleware<AuthVars['user']>({ secret: SECRET }))
    app.get('/protected', (c) => c.json({ user: c.get('user') }))

    const token = await sign({ sub: 'user-1', type: 'access' }, SECRET)
    const res = await app.request('/protected', {
      headers: { Authorization: `bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as AuthVars
    expect(body.user.sub).toBe('user-1')
  })

  it('type inference: c.get("user").sub is string', async () => {
    type UserPayload = { sub: string }
    const app = new Hono<{ Variables: { user: UserPayload } }>()
    app.use('/protected', authMiddleware<UserPayload>({ secret: SECRET }))
    app.get('/protected', (c) => {
      const user = c.get('user')
      const _check: string = user.sub
      return c.json({ sub: _check })
    })

    const token = await sign({ sub: 'type-check-user', type: 'access' }, SECRET)
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { sub: string }
    expect(body.sub).toBe('type-check-user')
  })

  it('refresh token (type: "refresh") returns 401', async () => {
    const token = await sign({ sub: 'user-1', type: 'refresh' }, SECRET)
    const app = new Hono()
    app.use('/protected', authMiddleware({ secret: SECRET }))
    app.get('/protected', (c) => c.json({ ok: true }))
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(401)
  })

  it('token without type claim returns 401', async () => {
    const token = await sign({ sub: 'user-1' }, SECRET)
    const app = new Hono()
    app.use('/protected', authMiddleware({ secret: SECRET }))
    app.get('/protected', (c) => c.json({ ok: true }))
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(401)
  })

  it('token with non-string type claim returns 401', async () => {
    const token = await sign({ sub: 'user-1', type: 123 }, SECRET)
    const app = new Hono()
    app.use('/protected', authMiddleware({ secret: SECRET }))
    app.get('/protected', (c) => c.json({ ok: true }))
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(401)
  })

  it.each([
    ['Access (case-mismatch)', 'Access'],
    ['ACCESS (case-mismatch)', 'ACCESS'],
    ['"access " (trailing space)', 'access '],
    ['" access" (leading space)', ' access'],
    ['empty string', ''],
    ['boolean true', true],
    ['null', null],
    ['array ["access"]', ['access']],
    ['object { value: "access" }', { value: 'access' }],
  ])('rejects bypass attempt with type=%s (returns 401)', async (_label, typeValue) => {
    const token = await sign({ sub: 'user-1', type: typeValue }, SECRET)
    const app = new Hono()
    app.use('/protected', authMiddleware({ secret: SECRET }))
    app.get('/protected', (c) => c.json({ ok: true }))
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(401)
  })
})
