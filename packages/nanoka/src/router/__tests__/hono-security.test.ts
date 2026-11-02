import { env } from 'cloudflare:test'
import { csrf } from 'hono/csrf'
import { describe, expect, it } from 'vitest'
import { d1Adapter } from '../../adapter'
import { t } from '../../field'
import { nanoka } from '../nanoka'

const createApp = () => nanoka(d1Adapter(env.DB))

describe('Hono security boundaries through Nanoka', () => {
  it('keeps wildcard middleware on a route ending in a segment wildcard', async () => {
    const app = createApp()
    app.use('/private/*', async (c) => c.text('blocked', 401))
    app.get('/private*', (c) => c.text('must not run'))

    expect((await app.request('/private/item')).status).toBe(401)
  })

  it('applies middleware with an explicit default parameter pattern', async () => {
    const app = createApp()
    app.use('/teams/:team{[^/]+}/private/*', async (c) => c.text('blocked', 401))
    app.get('/teams/:team/private/:item', (c) => c.text('must not run'))

    expect((await app.request('/teams/fixture/private/item')).status).toBe(401)
  })

  it.each(['%0A', '%0D', '%E2%80%A8', '%E2%80%A9'])(
    'keeps wildcard middleware before not-found for encoded line terminator %s',
    async (terminator) => {
      const app = createApp()
      app.use('/private/*', async (c) => c.text('blocked', 401))
      app.get('/public', (c) => c.text('public'))
      app.notFound((c) => c.text('must not run', 404))

      expect((await app.request(`/private/item${terminator}`)).status).toBe(401)
    },
  )

  it('removes a dynamic mount prefix using the matched segment length', async () => {
    const app = createApp()
    app.mount('/service/:team', (request) => new Response(new URL(request.url).pathname))

    expect(await (await app.request('/service/long-fixture-team/leaf')).text()).toBe('/leaf')
  })

  it('preserves encoded mount paths without normalizing them into another route', async () => {
    const app = createApp()
    app.mount('/service', (request) => new Response(new URL(request.url).pathname))

    const path = '/public%5C..%5Cprivate/item'
    expect(await (await app.request(`/service${path}`)).text()).toBe(path)
  })

  it.each([
    ['short', 200],
    ['long fixture value', 400],
  ] as const)(
    'validates multipart fields with extra Content-Type parameters: %s',
    async (name, status) => {
      const app = createApp()
      const Item = app.model('form_fixture', { name: t.string().max(8) })
      app.patch('/items', Item.validator('form', 'update'), (c) => c.json(c.req.valid('form')))
      const body = new FormData()
      body.set('name', name)
      const request = new Request('http://localhost/items', { method: 'PATCH', body })
      request.headers.set('Content-Type', `${request.headers.get('Content-Type')}; charset=UTF-8`)

      const response = await app.fetch(request)
      expect(response.status).toBe(status)
      if (status === 200) expect(await response.json()).toEqual({ name })
    },
  )

  it.each([
    ['https://foreign.example', 'cross-site', 403],
    ['http://localhost', 'same-origin', 200],
  ] as const)('checks text/ping with csrf middleware: %s', async (origin, site, status) => {
    const app = createApp()
    app.use('/change', csrf())
    app.post('/change', (c) => c.text('accepted'))

    const response = await app.request('/change', {
      method: 'POST',
      headers: { 'Content-Type': 'text/ping', Origin: origin, 'Sec-Fetch-Site': site },
      body: 'PING',
    })
    expect(response.status).toBe(status)
  })
})
