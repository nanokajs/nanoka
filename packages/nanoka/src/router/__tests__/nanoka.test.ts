import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { Adapter } from '../../adapter/types'
import { t } from '../../field'
import { nanoka } from '../nanoka'

describe('nanoka(adapter)', () => {
  // Mock adapter for testing without D1.
  // biome-ignore lint/suspicious/noExplicitAny: mock adapter uses simplified types for testing
  const createMockAdapter = (): Adapter<any> => {
    const mockDrizzle = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }

    const mockBatch = vi.fn(async (queries: unknown[]) => {
      return queries.map(() => ({ success: true }))
    })

    // biome-ignore lint/suspicious/noExplicitAny: mock drizzle simplified for testing
    return { drizzle: mockDrizzle as any, batch: mockBatch as any }
  }

  describe('nanoka() factory', () => {
    it('returns a Hono instance', () => {
      const adapter = createMockAdapter()
      const app = nanoka(adapter)

      expect(app).toBeInstanceOf(Hono)
    })

    it('exposes db property that references adapter.drizzle', () => {
      const adapter = createMockAdapter()
      const app = nanoka(adapter)

      expect(app.db).toBe(adapter.drizzle)
    })

    it('exposes batch method that delegates to adapter.batch', async () => {
      const adapter = createMockAdapter()
      const app = nanoka(adapter)

      const queries = [{ query: 'SELECT 1' }]
      // biome-ignore lint/suspicious/noExplicitAny: batch query type is complex, test uses simplified value
      const result = await app.batch(queries as any)

      expect(adapter.batch).toHaveBeenCalledWith(queries)
      expect(result).toBeDefined()
    })

    it('app.batch is bound to the adapter', async () => {
      const adapter = createMockAdapter()
      const app = nanoka(adapter)

      // Even when called without explicit this binding, should work
      const batchMethod = app.batch
      // biome-ignore lint/suspicious/noExplicitAny: batch query type is complex, test uses simplified value
      await batchMethod([{ query: 'SELECT 1' }] as any)

      expect(adapter.batch).toHaveBeenCalled()
    })
  })

  describe('app.model()', () => {
    it('registers a model and returns NanokaModel', () => {
      const adapter = createMockAdapter()
      const app = nanoka(adapter)

      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
        email: t.string().email(),
        passwordHash: t.string(),
      })

      expect(User).toBeDefined()
      expect(User.fields).toBeDefined()
      expect(User.tableName).toBe('users')
      expect(User.table).toBeDefined()
    })

    it('NanokaModel.schema() works', () => {
      const adapter = createMockAdapter()
      const app = nanoka(adapter)

      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
        email: t.string().email(),
        passwordHash: t.string(),
      })

      const schema = User.schema({ omit: ['passwordHash'] })
      expect(schema).toBeDefined()
    })

    it('NanokaModel.validator() works', () => {
      const adapter = createMockAdapter()
      const app = nanoka(adapter)

      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
        email: t.string().email(),
        passwordHash: t.string(),
      })

      const validator = User.validator('json', { omit: ['passwordHash'] })
      expect(validator).toBeDefined()
      expect(typeof validator).toBe('function')
    })

    it('multiple models can be registered', () => {
      const adapter = createMockAdapter()
      const app = nanoka(adapter)

      const User = app.model('users', {
        id: t.uuid().primary(),
        name: t.string(),
      })

      const Post = app.model('posts', {
        id: t.uuid().primary(),
        title: t.string(),
      })

      expect(User.tableName).toBe('users')
      expect(Post.tableName).toBe('posts')
    })
  })

  describe('Hono integration', () => {
    it('app.use works (standard Hono middleware)', async () => {
      const adapter = createMockAdapter()
      const app = nanoka(adapter)

      let middlewareExecuted = false

      app.use('*', (_c, next) => {
        middlewareExecuted = true
        return next()
      })

      app.get('/test', (c) => c.json({ ok: true }))

      const request = new Request('http://localhost/test')
      const response = await app.fetch(request)

      expect(middlewareExecuted).toBe(true)
      expect(response.status).toBe(200)
    })

    it('app.get/post/patch/delete work (standard Hono routing)', async () => {
      const adapter = createMockAdapter()
      const app = nanoka(adapter)

      app.get('/get', (c) => c.json({ method: 'GET' }))
      app.post('/post', (c) => c.json({ method: 'POST' }))
      app.patch('/patch', (c) => c.json({ method: 'PATCH' }))
      app.delete('/delete', (c) => c.json({ method: 'DELETE' }))

      const getResponse = await app.fetch(new Request('http://localhost/get'))
      expect(getResponse.status).toBe(200)
      expect(await getResponse.json()).toEqual({ method: 'GET' })

      const postResponse = await app.fetch(new Request('http://localhost/post', { method: 'POST' }))
      expect(postResponse.status).toBe(200)
      expect(await postResponse.json()).toEqual({ method: 'POST' })
    })

    it('app.notFound works (standard Hono 404 handler)', async () => {
      const adapter = createMockAdapter()
      const app = nanoka(adapter)

      app.notFound((c) => c.json({ error: 'not found' }, 404))

      const response = await app.fetch(new Request('http://localhost/nonexistent'))
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'not found' })
    })

    it('app.fetch works for standard HTTP requests', async () => {
      const adapter = createMockAdapter()
      const app = nanoka(adapter)

      app.get('/users', (c) => c.json({ users: [] }))

      const request = new Request('http://localhost/users')
      const response = await app.fetch(request)

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ users: [] })
    })
  })

  describe('error handling', () => {
    it('Hono HTTPException is handled by default error handler', async () => {
      const adapter = createMockAdapter()
      const app = nanoka(adapter)
      const { HTTPException } = await import('hono/http-exception')

      app.get('/error', () => {
        throw new HTTPException(400, { message: 'bad request' })
      })

      const response = await app.fetch(new Request('http://localhost/error'))
      expect(response.status).toBe(400)
    })
  })
})
