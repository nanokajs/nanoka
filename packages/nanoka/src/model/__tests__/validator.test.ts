import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { t } from '../../field'
import { defineModel } from '../define'

describe('Model: validator() Hono integration', () => {
  const User = defineModel('users', {
    id: t.uuid().primary(),
    name: t.string(),
    email: t.string().email(),
    passwordHash: t.string(),
  })

  describe('validator(target, opts)', () => {
    it('creates a Hono middleware for JSON validation', async () => {
      const app = new Hono()

      app.post('/users', User.validator('json', { omit: ['passwordHash'] }), (c) => {
        const body = c.req.valid('json')
        return c.json({ received: body })
      })

      const validRequest = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John Doe',
          email: 'john@example.com',
        }),
      })

      const response = await app.fetch(validRequest)
      expect(response.status).toBe(200)

      const data = (await response.json()) as Record<string, unknown>
      expect(data.received).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john@example.com',
      })
    })

    it('rejects invalid body with 400', async () => {
      const app = new Hono()

      app.post('/users', User.validator('json', { omit: ['passwordHash'] }), (c) => {
        const body = c.req.valid('json')
        return c.json({ received: body })
      })

      const invalidRequest = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John Doe',
          // email is missing and required
        }),
      })

      const response = await app.fetch(invalidRequest)
      expect(response.status).toBe(400)
    })

    it('strips omitted fields from validated body', async () => {
      const app = new Hono()

      app.post('/users', User.validator('json', { omit: ['passwordHash'] }), (c) => {
        const body = c.req.valid('json')
        return c.json({
          received: body,
          hasPasswordHash: 'passwordHash' in (body as Record<string, unknown>),
        })
      })

      const request = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John Doe',
          email: 'john@example.com',
          passwordHash: 'should-be-stripped',
        }),
      })

      const response = await app.fetch(request)
      expect(response.status).toBe(200)

      const data = (await response.json()) as Record<string, unknown>
      expect(data.hasPasswordHash).toBe(false)
    })

    it('handles partial with pick', async () => {
      const app = new Hono()

      app.patch(
        '/users/:id',
        User.validator('json', { partial: true, pick: ['name', 'email'] }),
        (c) => {
          const body = c.req.valid('json')
          return c.json({ received: body })
        },
      )

      const partialRequest = new Request(
        'http://localhost/users/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Jane Doe',
          }),
        },
      )

      const response = await app.fetch(partialRequest)
      expect(response.status).toBe(200)

      const data = (await response.json()) as Record<string, unknown>
      expect(data.received).toEqual({
        name: 'Jane Doe',
      })
    })

    it('accepts empty body with partial', async () => {
      const app = new Hono()

      app.patch(
        '/users/:id',
        User.validator('json', { partial: true, pick: ['name', 'email'] }),
        (c) => {
          const body = c.req.valid('json')
          return c.json({ received: body })
        },
      )

      const emptyRequest = new Request(
        'http://localhost/users/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      )

      const response = await app.fetch(emptyRequest)
      expect(response.status).toBe(200)

      const data = (await response.json()) as Record<string, unknown>
      expect(data.received).toEqual({})
    })

    it('validates format constraints even with partial', async () => {
      const app = new Hono()

      app.patch('/users/:id', User.validator('json', { partial: true, pick: ['email'] }), (c) => {
        const body = c.req.valid('json')
        return c.json({ received: body })
      })

      const invalidRequest = new Request(
        'http://localhost/users/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'invalid-email',
          }),
        },
      )

      const response = await app.fetch(invalidRequest)
      expect(response.status).toBe(400)
    })

    it('works with query validation', async () => {
      const app = new Hono()

      app.get('/users', User.validator('query', { pick: ['name', 'email'] }), (c) => {
        const query = c.req.valid('query')
        return c.json({ query })
      })

      const queryRequest = new Request('http://localhost/users?name=John&email=john@example.com')

      const response = await app.fetch(queryRequest)
      expect(response.status).toBe(200)

      const data = (await response.json()) as Record<string, unknown>
      expect(data.query).toEqual({
        name: 'John',
        email: 'john@example.com',
      })
    })
  })

  describe('validator(target, opts, hook)', () => {
    it('hook is called on successful validation', async () => {
      const app = new Hono()
      let hookCalled = false

      app.post(
        '/users',
        User.validator('json', { omit: ['passwordHash'] }, (result, _c) => {
          if (result.success) hookCalled = true
        }),
        (c) => c.json({ ok: true }),
      )

      const request = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John Doe',
          email: 'john@example.com',
        }),
      })

      const response = await app.fetch(request)
      expect(response.status).toBe(200)
      expect(hookCalled).toBe(true)
    })

    it('hook is called on failed validation', async () => {
      const app = new Hono()
      let hookCalled = false

      app.post(
        '/users',
        User.validator('json', { omit: ['passwordHash'] }, (result, _c) => {
          if (!result.success) hookCalled = true
        }),
        (c) => c.json({ ok: true }),
      )

      const request = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John Doe' }), // missing id and email
      })

      const response = await app.fetch(request)
      expect(response.status).toBe(400)
      expect(hookCalled).toBe(true)
    })

    it('hook returning c.json overrides default validator behavior', async () => {
      const app = new Hono()

      app.post(
        '/users',
        User.validator('json', { omit: ['passwordHash'] }, (result, c) => {
          if (!result.success) return c.json({ error: 'Invalid request' }, 400)
        }),
        (c) => c.json({ ok: true }),
      )

      const request = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John Doe' }), // missing required fields
      })

      const response = await app.fetch(request)
      expect(response.status).toBe(400)
      const data = (await response.json()) as Record<string, unknown>
      expect(data).toEqual({ error: 'Invalid request' })
    })

    it('validator without hook continues to work (backward compatibility)', async () => {
      const app = new Hono()

      app.post('/users', User.validator('json', { omit: ['passwordHash'] }), (c) => {
        const body = c.req.valid('json')
        return c.json({ received: body })
      })

      const validRequest = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John Doe',
          email: 'john@example.com',
        }),
      })

      const response = await app.fetch(validRequest)
      expect(response.status).toBe(200)
    })
  })

  describe('validator() type safety', () => {
    it('typed context narrows body to exclude omitted fields', async () => {
      const app = new Hono()

      app.post('/users', User.validator('json', { omit: ['passwordHash'] }), (c) => {
        const body = c.req.valid('json')
        const _ok: typeof body = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John',
          email: 'john@example.com',
        }
        void _ok
        const _bad: typeof body = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John',
          email: 'john@example.com',
          // @ts-expect-error - passwordHash should not be assignable to validated body type
          passwordHash: 'leaked',
        }
        void _bad
        return c.json({ ok: true })
      })

      const request = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John',
          email: 'john@example.com',
        }),
      })

      const response = await app.fetch(request)
      expect(response.status).toBe(200)
    })

    it('strips omitted fields at runtime', async () => {
      const app = new Hono()

      app.post('/users', User.validator('json', { omit: ['passwordHash'] }), (c) => {
        const body = c.req.valid('json')
        return c.json({ received: body })
      })

      const request = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John',
          email: 'john@example.com',
          passwordHash: 'should-be-ignored',
        }),
      })

      const response = await app.fetch(request)
      expect(response.status).toBe(200)
      const data = (await response.json()) as Record<string, unknown>
      const received = data.received as Record<string, unknown>
      expect(received).not.toHaveProperty('passwordHash')
    })
  })
})
