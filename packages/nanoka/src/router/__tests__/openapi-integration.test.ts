import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { Adapter } from '../../adapter/types'
import { t } from '../../field'
import { toOpenAPISchema } from '../../openapi/generate'
import { nanoka } from '../nanoka'

describe('app.openapi() integration', () => {
  // biome-ignore lint/suspicious/noExplicitAny: mock adapter uses simplified types for testing
  const createMockAdapter = (): Adapter<any> => {
    const mockDrizzle = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }
    const mockBatch = vi.fn(async (queries: unknown[]) => queries.map(() => ({ success: true })))
    // biome-ignore lint/suspicious/noExplicitAny: mock drizzle simplified for testing
    return { drizzle: mockDrizzle as any, batch: mockBatch as any }
  }

  it('collects route metadata and generateOpenAPISpec returns valid document', () => {
    const adapter = createMockAdapter()
    const app = nanoka(adapter)

    app.openapi({
      path: '/users',
      method: 'get',
      summary: 'List users',
      responses: { '200': { description: 'Success' } },
    })

    app.openapi({
      path: '/users',
      method: 'post',
      summary: 'Create user',
      responses: { '201': { description: 'Created' } },
    })

    const spec = app.generateOpenAPISpec({
      info: { title: 'Test API', version: '1.0.0' },
    })

    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toBe('Test API')
    expect(spec.paths['/users']).toBeDefined()
    const usersPath = spec.paths['/users'] as Record<string, unknown>
    expect(usersPath.get).toBeDefined()
    expect(usersPath.post).toBeDefined()
  })

  it('openapi() is chainable', () => {
    const adapter = createMockAdapter()
    const app = nanoka(adapter)

    const result = app
      .openapi({
        path: '/a',
        method: 'get',
        responses: { '200': { description: 'Success' } },
      })
      .openapi({
        path: '/b',
        method: 'post',
        responses: { '201': { description: 'Created' } },
      })

    expect(result).toBe(app)

    const spec = app.generateOpenAPISpec({
      info: { title: 'Test API', version: '1.0.0' },
    })

    expect(spec.paths['/a']).toBeDefined()
    expect(spec.paths['/b']).toBeDefined()
  })

  it('strict mode throws when schema contains unsupported Zod types', () => {
    const adapter = createMockAdapter()
    const app = nanoka(adapter)

    const User = app.model('users', {
      id: t.uuid().primary(),
      data: t.json(z.string().refine(() => true) as unknown as import('zod').ZodTypeAny),
    })

    expect(() => User.toOpenAPISchema('create')).not.toThrow()

    expect(() => toOpenAPISchema(User.fields, 'create', { strict: true })).toThrow(
      /Unsupported Zod type for strict OpenAPI generation/,
    )
  })
})
