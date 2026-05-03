import { d1Adapter, nanoka } from '@nanokajs/core'
import { postFields, postTableName } from './models/posts'

export interface Env {
  DB: D1Database
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const app = nanoka(d1Adapter(env.DB))
    const Post = app.model(postTableName, postFields)

    app.post('/posts', Post.validator('json', { omit: ['id', 'createdAt'] }), async (c) => {
      const body = c.req.valid('json')
      const created = await Post.create({
        ...body,
        id: crypto.randomUUID(),
        createdAt: new Date(),
      })
      return c.json(created, 201)
    })

    app.get('/posts', async (c) => {
      const posts = await Post.findMany({ limit: 20 })
      return c.json(posts)
    })

    return app.fetch(req, env, ctx)
  },
}
