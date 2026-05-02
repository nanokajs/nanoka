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

  describe('validator() type safety', () => {
    // TODO:M5 Type safety validation for validator() return type
    // Currently, the validator middleware returns MiddlewareHandler<any, any, any>,
    // which means c.req.valid('json') has type `any`, so the type assignment check
    // below does not catch type mismatches at compile time.
    //
    // In M5, when we refactor validator() to return a properly-typed MiddlewareHandler
    // with zValidator's generic signature, the body type will be narrowed to exclude
    // omitted fields (e.g., passwordHash). At that point, this test should be rewritten
    // to use @ts-expect-error to verify that attempting to assign a shape containing
    // passwordHash is rejected by TypeScript.
    //
    // See: docs/phase1-plan.md M5 section for details.
    it('[TODO:M5] typed context with omit (currently tests runtime only — body is any)', async () => {
      const app = new Hono()

      app.post('/users', User.validator('json', { omit: ['passwordHash'] }), (c) => {
        const body = c.req.valid('json')
        // body should not have passwordHash
        type BodyType = typeof body
        const _check: BodyType = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John',
          email: 'john@example.com',
        }
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
  })
})
