import { describe, expect, it } from 'vitest'
import { buildOpenAPIDocument } from '../route'
import type { OpenAPIRouteMetadata } from '../types'

describe('buildOpenAPIDocument', () => {
  it('generates valid OpenAPI 3.1 document', () => {
    const routes: OpenAPIRouteMetadata[] = [
      {
        path: '/users',
        method: 'get',
        summary: 'List users',
        responses: {
          '200': { description: 'Success' },
        },
      },
    ]

    const doc = buildOpenAPIDocument(routes, {
      info: { title: 'Test API', version: '1.0.0' },
    })

    expect(doc.openapi).toBe('3.1.0')
    expect(doc.info.title).toBe('Test API')
    expect(doc.info.version).toBe('1.0.0')
    expect(doc.paths).toBeDefined()
    expect(doc.paths['/users']).toBeDefined()
    expect((doc.paths['/users'] as Record<string, unknown>).get).toBeDefined()
  })

  it('converts Hono :id syntax to {id}', () => {
    const routes: OpenAPIRouteMetadata[] = [
      {
        path: '/users/:id',
        method: 'get',
        responses: { '200': { description: 'Success' } },
      },
    ]

    const doc = buildOpenAPIDocument(routes, {
      info: { title: 'Test API', version: '1.0.0' },
    })

    expect(doc.paths['/users/{id}']).toBeDefined()
    expect(doc.paths['/users/:id']).toBeUndefined()
  })

  it('merges multiple methods for the same path', () => {
    const routes: OpenAPIRouteMetadata[] = [
      {
        path: '/users',
        method: 'get',
        responses: { '200': { description: 'Success' } },
      },
      {
        path: '/users',
        method: 'post',
        responses: { '201': { description: 'Created' } },
      },
    ]

    const doc = buildOpenAPIDocument(routes, {
      info: { title: 'Test API', version: '1.0.0' },
    })

    const userPath = doc.paths['/users'] as Record<string, unknown>
    expect(userPath.get).toBeDefined()
    expect(userPath.post).toBeDefined()
  })

  it('auto-adds path parameters from path syntax', () => {
    const routes: OpenAPIRouteMetadata[] = [
      {
        path: '/users/:id/posts/:postId',
        method: 'get',
        responses: { '200': { description: 'Success' } },
      },
    ]

    const doc = buildOpenAPIDocument(routes, {
      info: { title: 'Test API', version: '1.0.0' },
    })

    const operation = (doc.paths['/users/{id}/posts/{postId}'] as Record<string, unknown>)
      .get as Record<string, unknown>
    const parameters = operation.parameters as Array<Record<string, unknown>>
    expect(parameters).toHaveLength(2)
    expect(parameters[0]).toMatchObject({ name: 'id', in: 'path', required: true })
    expect(parameters[1]).toMatchObject({ name: 'postId', in: 'path', required: true })
  })

  it('does not duplicate path params already in route.params', () => {
    const routes: OpenAPIRouteMetadata[] = [
      {
        path: '/users/:id',
        method: 'get',
        params: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Success' } },
      },
    ]

    const doc = buildOpenAPIDocument(routes, {
      info: { title: 'Test API', version: '1.0.0' },
    })

    const operation = (doc.paths['/users/{id}'] as Record<string, unknown>).get as Record<
      string,
      unknown
    >
    const parameters = operation.parameters as Array<Record<string, unknown>>
    expect(parameters).toHaveLength(1)
    expect(parameters[0]).toMatchObject({ schema: { type: 'string', format: 'uuid' } })
  })

  it('matches snapshot for multi-route fixture', () => {
    const routes: OpenAPIRouteMetadata[] = [
      {
        path: '/users',
        method: 'post',
        operationId: 'createUser',
        summary: 'Create user',
        tags: ['users'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Bad request' },
        },
      },
      {
        path: '/users',
        method: 'get',
        operationId: 'listUsers',
        summary: 'List users',
        tags: ['users'],
        responses: {
          '200': { description: 'Success' },
        },
      },
      {
        path: '/users/:id',
        method: 'get',
        operationId: 'getUser',
        params: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Success' },
          '404': { description: 'Not found' },
        },
      },
    ]

    const doc = buildOpenAPIDocument(routes, {
      info: { title: 'Fixture API', version: '0.1.0' },
      servers: [{ url: 'https://api.example.com' }],
    })

    expect(doc).toMatchSnapshot()
  })
})
