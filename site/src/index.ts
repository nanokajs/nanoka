import { Hono } from 'hono'

type Bindings = {
  ASSETS: Fetcher
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => c.text('Nanoka docs site (placeholder)'))

export default app
