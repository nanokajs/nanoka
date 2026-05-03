import { d1Adapter, nanoka } from '@nanokajs/core'
import { z } from 'zod'
import { userFields, userTableName } from './models/user'

export interface Env {
  DB: D1Database
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const app = nanoka<{ Bindings: Env }>(d1Adapter(env.DB))
    const User = app.model(userTableName, userFields)

    app.post(
      '/users',
      User.validator('json', { omit: ['id', 'passwordHash', 'createdAt'] }),
      async (c) => {
        const body = c.req.valid('json')
        const created = await User.create({
          ...body,
          id: crypto.randomUUID(),
          passwordHash: 'hashed_value_here',
          createdAt: new Date(),
        })
        const user = User.schema({ omit: ['passwordHash'] }).parse(created)
        return c.json(user, 201)
      },
    )

    app.post('/users/create-preset', User.validator('json', 'create'), async (c) => {
      const body = c.req.valid('json')
      // @ts-expect-error serverToken is serverOnly and must not appear in create input
      const _check: string = body.serverToken
      const created = await User.create({
        ...body,
        id: crypto.randomUUID(),
        passwordHash: 'hashed_value_here',
        createdAt: new Date(),
      })
      return c.json(User.toResponse(created), 201)
    })

    app.get('/users', async (c) => {
      const users = await User.findMany({ limit: 20 })
      const result = z.array(User.schema({ omit: ['passwordHash'] })).parse(users)
      return c.json(result)
    })

    return app.fetch(req, env, ctx)
  },
}
