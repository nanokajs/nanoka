import type { NanokaModel } from '@nanokajs/core'
import type { Handler, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Hasher } from './hasher.js'
import { pbkdf2Hasher } from './hashers/pbkdf2.js'
import { sign, verify } from './jwt.js'
import { authMiddleware } from './middleware.js'

export interface CreateAuthOptions {
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for NanokaModel generic constraint
  model: NanokaModel<any>
  secret: string
  fields: { identifier: string; password: string }
  hasher?: Hasher
  jwt?: { expiresIn?: number; refreshExpiresIn?: number }
}

export interface AuthInstance {
  loginHandler(): Handler
  refreshHandler(): Handler
  middleware(): MiddlewareHandler
}

export function createAuth(opts: CreateAuthOptions): AuthInstance {
  if (opts.secret.length < 32) {
    throw new Error('createAuth: secret must be at least 32 characters')
  }

  const hasher = opts.hasher ?? pbkdf2Hasher
  const expiresIn = opts.jwt?.expiresIn ?? 900
  const refreshExpiresIn = opts.jwt?.refreshExpiresIn ?? 604_800
  const identifierField = opts.fields.identifier
  const passwordField = opts.fields.password
  const dummyHashPromise = hasher.hash('__dummy__')

  return {
    loginHandler(): Handler {
      return async (c) => {
        let body: Record<string, unknown>
        try {
          body = await c.req.json<Record<string, unknown>>()
        } catch {
          throw new HTTPException(401, { message: 'Invalid credentials' })
        }
        const identifierValue = body[identifierField]
        const passwordValue = body[passwordField]

        if (typeof identifierValue !== 'string' || typeof passwordValue !== 'string') {
          throw new HTTPException(401, { message: 'Invalid credentials' })
        }

        // biome-ignore lint/suspicious/noExplicitAny: model is typed as NanokaModel<any> per CreateAuthOptions
        const user = await opts.model.findOne({ [identifierField]: identifierValue } as any)

        if (user === null) {
          const dummyHash = await dummyHashPromise
          await hasher.verify('__dummy__', dummyHash)
          throw new HTTPException(401, { message: 'Invalid credentials' })
        }

        // biome-ignore lint/suspicious/noExplicitAny: user shape is unknown at compile time
        const storedHash = (user as any)[passwordField] as string
        const valid = await hasher.verify(passwordValue, storedHash)

        if (!valid) {
          throw new HTTPException(401, { message: 'Invalid credentials' })
        }

        // biome-ignore lint/suspicious/noExplicitAny: user shape is unknown at compile time
        const sub: string = String((user as any).id ?? (user as any)[identifierField])

        const [accessToken, refreshToken] = await Promise.all([
          sign({ sub, type: 'access' }, opts.secret, { expiresIn }),
          sign({ sub, type: 'refresh' }, opts.secret, { expiresIn: refreshExpiresIn }),
        ])

        return c.json({ accessToken, refreshToken }, 200)
      }
    },

    refreshHandler(): Handler {
      return async (c) => {
        let body: Record<string, unknown>
        try {
          body = await c.req.json<Record<string, unknown>>()
        } catch {
          throw new HTTPException(401, { message: 'Invalid credentials' })
        }
        const { refreshToken } = body

        if (typeof refreshToken !== 'string') {
          throw new HTTPException(401, { message: 'Invalid credentials' })
        }

        let payload: Record<string, unknown>
        try {
          payload = await verify<Record<string, unknown>>(refreshToken, opts.secret)
        } catch (err) {
          throw new HTTPException(401, { message: 'Invalid credentials', cause: err })
        }

        if (payload.type !== 'refresh') {
          throw new HTTPException(401, { message: 'Invalid credentials' })
        }

        if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
          throw new HTTPException(401, { message: 'Invalid credentials' })
        }

        const accessToken = await sign({ sub: payload.sub, type: 'access' }, opts.secret, {
          expiresIn,
        })

        return c.json({ accessToken }, 200)
      }
    },

    middleware(): MiddlewareHandler {
      return authMiddleware({ secret: opts.secret })
    },
  }
}
