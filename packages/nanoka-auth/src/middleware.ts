import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { verify } from './jwt.js'

export function authMiddleware<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
>(opts: { secret: string }): MiddlewareHandler<{ Variables: { user: TPayload } }> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Unauthorized' })
    }
    const token = authHeader.slice('Bearer '.length)
    if (!token) {
      throw new HTTPException(401, { message: 'Unauthorized' })
    }
    let payload: TPayload
    try {
      payload = await verify<TPayload>(token, opts.secret)
    } catch (err) {
      throw new HTTPException(401, { message: 'Unauthorized', cause: err })
    }
    c.set('user', payload)
    await next()
  }
}
