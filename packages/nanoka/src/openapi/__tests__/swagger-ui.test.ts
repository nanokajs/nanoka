import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { swaggerUI } from '../swagger-ui'

describe('swaggerUI middleware', () => {
  it('returns HTML response with text/html content-type', async () => {
    const app = new Hono()
    app.get('/docs', swaggerUI({ url: '/openapi.json' }))

    const response = await app.request('/docs')

    expect(response.status).toBe(200)
    const contentType = response.headers.get('content-type')
    expect(contentType).toMatch(/text\/html/)
  })

  it('includes the spec URL in the HTML', async () => {
    const app = new Hono()
    app.get('/docs', swaggerUI({ url: '/openapi.json' }))

    const response = await app.request('/docs')
    const html = await response.text()

    expect(html).toContain('/openapi.json')
  })

  it('includes swagger-ui CDN links', async () => {
    const app = new Hono()
    app.get('/docs', swaggerUI({ url: '/openapi.json' }))

    const response = await app.request('/docs')
    const html = await response.text()

    expect(html).toContain('swagger-ui-dist')
    expect(html).toContain('swagger-ui.css')
    expect(html).toContain('swagger-ui-bundle.js')
  })

  it('uses the provided title', async () => {
    const app = new Hono()
    app.get('/docs', swaggerUI({ url: '/openapi.json', title: 'My Custom API Docs' }))

    const response = await app.request('/docs')
    const html = await response.text()

    expect(html).toContain('My Custom API Docs')
  })

  it('defaults to "API Documentation" when title is not provided', async () => {
    const app = new Hono()
    app.get('/docs', swaggerUI({ url: '/openapi.json' }))

    const response = await app.request('/docs')
    const html = await response.text()

    expect(html).toContain('API Documentation')
  })
})
