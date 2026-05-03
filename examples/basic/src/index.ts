import { d1Adapter, nanoka } from '@nanokajs/core'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { userFields, userTableName } from './models/user'

export interface Env {
  DB: D1Database
  ENVIRONMENT: string
  DEBUG?: string
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const app = nanoka<{ Bindings: Env }>(d1Adapter(env.DB))
    const User = app.model(userTableName, userFields)

    // Error handler
    app.onError((err, c) => {
      if (err instanceof HTTPException) {
        if (err.status >= 500) {
          // 5xx は内部実装エラーなのでメッセージを外部に出さない
          return c.json({ error: 'Internal Server Error' }, err.status)
        }
        return err.getResponse()
      }
      const status = 500
      // Fail-closed: stack traces only when DEBUG is explicitly enabled.
      // Defaults to safe behavior even if ENVIRONMENT is misconfigured at deploy time.
      // DEBUG=1 のとき err.message / err.stack をレスポンスに含める。production では絶対に設定しないこと。
      // Drizzle / D1 のエラーメッセージに DB 値（パスワードハッシュ等）が含まれる可能性がある。
      const debugEnabled = c.env.DEBUG === '1'
      const body = debugEnabled
        ? { error: err.message, stack: err.stack }
        : { error: 'Internal Server Error' }
      return c.json(body, status)
    })

    // POST /users - Create user
    app.post('/users', User.validator('json', 'create'), async (c) => {
      const body = c.req.valid('json')
      const id = crypto.randomUUID()
      // SECURITY: demo-only — the email is reversible, NEVER use in production.
      // Replace with a real password hash (bcrypt, argon2, scrypt) or accept a
      // pre-hashed value from the client and verify the algorithm.
      const passwordHash = `demo-${body.email}`
      const createdAt = new Date()

      const created = await User.create({
        ...body,
        id,
        passwordHash,
        createdAt,
      })

      return c.json(User.toResponse(created), 201)
    })

    // GET /users - List users
    app.get('/users', async (c) => {
      const querySchema = z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      })

      const queryResult = querySchema.safeParse(c.req.query())
      if (!queryResult.success) {
        throw new HTTPException(400, { message: 'Invalid query parameters' })
      }

      const { limit, offset } = queryResult.data
      const users = await User.findMany({ limit, offset, orderBy: 'id' })
      const result = z.array(User.outputSchema()).parse(users)
      return c.json(result)
    })

    // GET /users/:id - Get single user
    app.get('/users/:id', User.validator('param', { pick: ['id'] }), async (c) => {
      const { id } = c.req.valid('param')
      const user = await User.findOne(id)
      if (!user) {
        throw new HTTPException(404, { message: 'User not found' })
      }
      return c.json(User.toResponse(user))
    })

    // PATCH /users/:id - Update user
    app.patch(
      '/users/:id',
      User.validator('param', { pick: ['id'] }),
      User.validator('json', { partial: true, pick: ['name', 'email'] }),
      async (c) => {
        const { id } = c.req.valid('param')
        const body = c.req.valid('json')
        const updated = await User.update(id, body)
        if (!updated) {
          throw new HTTPException(404, { message: 'User not found' })
        }
        return c.json(User.toResponse(updated))
      },
    )

    // DELETE /users/:id - Delete user
    app.delete('/users/:id', User.validator('param', { pick: ['id'] }), async (c) => {
      const { id } = c.req.valid('param')
      const result = await User.delete(id)
      if (result.deleted === 0) {
        throw new HTTPException(404, { message: 'User not found' })
      }
      return c.body(null, 204)
    })

    return app.fetch(req, env, ctx)
  },
}
