import type { NanokaModel } from '@nanokajs/core'
import type { Handler, MiddlewareHandler } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import type { BlacklistStore } from './blacklist-store.js'
import type { Hasher } from './hasher.js'
import { pbkdf2Hasher } from './hashers/pbkdf2.js'
import { sign, verify } from './jwt.js'

export interface CookieOptions {
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
  secure?: boolean
  path?: string
  accessTokenName?: string
  refreshTokenName?: string
}

export interface CreateAuthOptions {
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for NanokaModel generic constraint
  model: NanokaModel<any>
  secret: string
  fields: { identifier: string; password: string }
  hasher?: Hasher
  jwt?: { expiresIn?: number; refreshExpiresIn?: number; rotation?: boolean }
  cookie?: CookieOptions
  blacklist?: BlacklistStore
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

  const rotation = opts.jwt?.rotation ?? false
  if (rotation && opts.blacklist === undefined) {
    throw new Error('createAuth: blacklist is required when jwt.rotation is true')
  }

  const hasher = opts.hasher ?? pbkdf2Hasher
  const expiresIn = opts.jwt?.expiresIn ?? 900
  const refreshExpiresIn = opts.jwt?.refreshExpiresIn ?? 604_800
  const identifierField = opts.fields.identifier
  const passwordField = opts.fields.password
  const dummyHashPromise = hasher.hash('__dummy__')

  const cookieOpts = opts.cookie
  const accessTokenName = cookieOpts?.accessTokenName ?? 'access_token'
  const refreshTokenName = cookieOpts?.refreshTokenName ?? 'refresh_token'

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

        const refreshPayload: Record<string, unknown> = { sub, type: 'refresh' }
        if (rotation) {
          refreshPayload.jti = crypto.randomUUID()
        }

        const [accessToken, refreshToken] = await Promise.all([
          sign({ sub, type: 'access' }, opts.secret, { expiresIn }),
          sign(refreshPayload, opts.secret, { expiresIn: refreshExpiresIn }),
        ])

        if (cookieOpts !== undefined) {
          const sameSite = cookieOpts.sameSite ?? 'Lax'
          const baseCookieOptions = {
            httpOnly: cookieOpts.httpOnly ?? true,
            sameSite,
            secure: sameSite === 'None' ? true : (cookieOpts.secure ?? true),
            path: cookieOpts.path ?? '/',
          } as const
          setCookie(c, accessTokenName, accessToken, {
            ...baseCookieOptions,
            maxAge: expiresIn,
          })
          setCookie(c, refreshTokenName, refreshToken, {
            ...baseCookieOptions,
            maxAge: refreshExpiresIn,
          })
          return c.json({ ok: true }, 200)
        }

        return c.json({ accessToken, refreshToken }, 200)
      }
    },

    refreshHandler(): Handler {
      return async (c) => {
        let refreshToken: string | undefined

        if (cookieOpts !== undefined) {
          refreshToken = getCookie(c, refreshTokenName)
          if ((refreshToken === undefined || refreshToken === '') && rotation) {
            throw new HTTPException(401, { message: 'Invalid credentials' })
          }
        }

        if (refreshToken === undefined || refreshToken === '') {
          let body: Record<string, unknown>
          try {
            body = await c.req.json<Record<string, unknown>>()
          } catch {
            throw new HTTPException(401, { message: 'Invalid credentials' })
          }
          const bodyRefreshToken = body.refreshToken
          if (typeof bodyRefreshToken !== 'string') {
            throw new HTTPException(401, { message: 'Invalid credentials' })
          }
          refreshToken = bodyRefreshToken
        }

        let payload: Record<string, unknown>
        try {
          payload = await verify<Record<string, unknown>>(refreshToken, opts.secret)
        } catch (err) {
          console.warn('refresh token verify failed', err)
          throw new HTTPException(401, { message: 'Invalid credentials' })
        }

        if (payload.type !== 'refresh') {
          throw new HTTPException(401, { message: 'Invalid credentials' })
        }

        if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
          throw new HTTPException(401, { message: 'Invalid credentials' })
        }

        if (rotation) {
          const jti = payload.jti
          if (typeof jti !== 'string' || jti.length === 0) {
            throw new HTTPException(401, { message: 'Invalid credentials' })
          }
          if (jti.length > 256) {
            throw new HTTPException(401, { message: 'Invalid credentials' })
          }
          if (!/^[A-Za-z0-9_-]+$/.test(jti)) {
            throw new HTTPException(401, { message: 'Invalid credentials' })
          }
          // biome-ignore lint/style/noNonNullAssertion: blacklist is guaranteed non-null when rotation is true (validated at createAuth call)
          const blacklist = opts.blacklist!
          const blacklisted =
            blacklist.hasForSubject !== undefined
              ? await blacklist.hasForSubject(jti, payload.sub)
              : await blacklist.has(jti)
          if (blacklisted) {
            throw new HTTPException(401, { message: 'Invalid credentials' })
          }
          const exp =
            typeof payload.exp === 'number'
              ? payload.exp
              : Math.floor(Date.now() / 1000) + refreshExpiresIn
          try {
            if (blacklist.addWithSubject !== undefined) {
              await blacklist.addWithSubject(jti, payload.sub, exp)
            } else {
              await blacklist.add(jti, exp)
            }
          } catch (err) {
            console.error('blacklist.add failed', err)
            throw new HTTPException(401, { message: 'Invalid credentials' })
          }

          const newJti = crypto.randomUUID()
          const [accessToken, newRefreshToken] = await Promise.all([
            sign({ sub: payload.sub, type: 'access' }, opts.secret, { expiresIn }),
            sign({ sub: payload.sub, type: 'refresh', jti: newJti }, opts.secret, {
              expiresIn: refreshExpiresIn,
            }),
          ])

          if (cookieOpts !== undefined) {
            const sameSite = cookieOpts.sameSite ?? 'Lax'
            const baseCookieOptions = {
              httpOnly: cookieOpts.httpOnly ?? true,
              sameSite,
              secure: sameSite === 'None' ? true : (cookieOpts.secure ?? true),
              path: cookieOpts.path ?? '/',
            } as const
            setCookie(c, accessTokenName, accessToken, {
              ...baseCookieOptions,
              maxAge: expiresIn,
            })
            setCookie(c, refreshTokenName, newRefreshToken, {
              ...baseCookieOptions,
              maxAge: refreshExpiresIn,
            })
            return c.json({ ok: true }, 200)
          }

          return c.json({ accessToken, refreshToken: newRefreshToken }, 200)
        }

        const accessToken = await sign({ sub: payload.sub, type: 'access' }, opts.secret, {
          expiresIn,
        })

        if (cookieOpts !== undefined) {
          const sameSite = cookieOpts.sameSite ?? 'Lax'
          const baseCookieOptions = {
            httpOnly: cookieOpts.httpOnly ?? true,
            sameSite,
            secure: sameSite === 'None' ? true : (cookieOpts.secure ?? true),
            path: cookieOpts.path ?? '/',
          } as const
          setCookie(c, accessTokenName, accessToken, {
            ...baseCookieOptions,
            maxAge: expiresIn,
          })
          return c.json({ ok: true }, 200)
        }

        return c.json({ accessToken }, 200)
      }
    },

    middleware(): MiddlewareHandler {
      return async (c, next) => {
        const authHeader = c.req.header('Authorization')
        if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
          throw new HTTPException(401, { message: 'Unauthorized' })
        }
        const token = authHeader.replace(/^Bearer\s+/i, '')
        if (!token) {
          throw new HTTPException(401, { message: 'Unauthorized' })
        }
        let payload: Record<string, unknown>
        try {
          payload = await verify<Record<string, unknown>>(token, opts.secret)
        } catch (err) {
          console.warn('access token verify failed', err)
          throw new HTTPException(401, { message: 'Unauthorized' })
        }
        if (payload.type !== 'access') {
          throw new HTTPException(401, { message: 'Unauthorized' })
        }
        // biome-ignore lint/suspicious/noExplicitAny: Variables shape is unknown at this call site
        c.set('user' as any, payload)
        await next()
      }
    },
  }
}
