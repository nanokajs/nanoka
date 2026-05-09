import { createAuth, pbkdf2Hasher } from '@nanokajs/auth'
import { d1Adapter, nanoka, swaggerUI, t } from '@nanokajs/core'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { postFields, postTableName } from './models/post'
import { userFields, userTableName } from './models/user'

export interface Env {
  DB: D1Database
  ENVIRONMENT: string
  DEBUG?: string
  AUTH_SECRET: string
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const app = nanoka<{ Bindings: Env }>(d1Adapter(env.DB))

    // Bidirectional relation graph requires forward reference via thunk.
    // User is declared as any to allow Post to reference it via thunk before User is assigned.
    // User is assigned immediately after Post, so no query runs before User is defined.
    // biome-ignore lint/suspicious/noExplicitAny: cyclic model graph requires forward declaration
    let User: any

    const Post = app.model(postTableName, {
      ...postFields,
      author: t.belongsTo(() => User, { foreignKey: 'userId' }),
    })

    User = app.model(userTableName, {
      ...userFields,
      posts: t.hasMany(() => Post, { foreignKey: 'userId' }),
    })

    const auth = createAuth({
      model: User,
      secret: env.AUTH_SECRET,
      fields: { identifier: 'email', password: 'passwordHash' },
      // hasher は省略すると pbkdf2Hasher (zero-dependency) が使われる。
      // bcrypt や argon2 を使う場合は Hasher インターフェース実装を渡す:
      //   import { Hasher } from '@nanokajs/auth'
      //   const bcryptHasher: Hasher = { hash: ..., verify: ... }
      //   createAuth({ ..., hasher: bcryptHasher })
    })

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

    // Known limitation: routes using inline { openapi } lose c.req.valid type inference
    // (H[] variadic overload). Cast explicitly below. Use app.openapi() + separate route
    // definition if full handler type safety is required.

    // POST /users - Create user
    app.post(
      '/users',
      {
        openapi: {
          summary: 'Create user',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: User.toOpenAPISchema('create') } },
          },
          responses: {
            '201': {
              description: 'Created user',
              content: { 'application/json': { schema: User.toOpenAPISchema('output') } },
            },
            '400': { description: 'Validation error' },
          },
        },
      },
      User.validator('json', 'create'),
      async (c) => {
        // biome-ignore lint/suspicious/noExplicitAny: known limitation, see above
        const body = (c.req.valid as (target: 'json') => any)('json')
        // SECURITY: demo-only — the email is reversible, NEVER use in production.
        // Replace with a real password hash (bcrypt, argon2, scrypt) or accept a
        // pre-hashed value from the client and verify the algorithm.
        const passwordHash = `demo-${body.email}`

        const created = await User.create({ ...body, passwordHash })

        return c.json(User.toResponse(created), 201)
      },
    )

    // GET /users - List users
    app.get(
      '/users',
      {
        openapi: {
          summary: 'List users',
          responses: {
            '200': {
              description: 'List of users',
              content: {
                'application/json': {
                  schema: { type: 'array', items: User.toOpenAPISchema('output') },
                },
              },
            },
          },
        },
      },
      async (c) => {
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
      },
    )

    // GET /users/:id - Get single user (supports ?with=posts)
    app.get(
      '/users/:id',
      {
        openapi: {
          summary: 'Get user by ID',
          params: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'User found',
              content: { 'application/json': { schema: User.toOpenAPISchema('output') } },
            },
            '404': { description: 'User not found' },
          },
        },
      },
      User.validator('param', { pick: ['id'] }) as import('hono').MiddlewareHandler,
      async (c) => {
        // biome-ignore lint/suspicious/noExplicitAny: known limitation, see above
        const { id } = (c.req.valid as (target: 'param') => any)('param')
        const withParam = c.req.query('with')
        if (withParam === 'posts') {
          const userWithPosts = await User.findOne(id, { with: { posts: true } })
          if (!userWithPosts) {
            throw new HTTPException(404, { message: 'User not found' })
          }
          // biome-ignore lint/suspicious/noExplicitAny: relation result shape varies at runtime
          const { posts, ...userData } = userWithPosts as any
          return c.json({ ...User.toResponse(userData), posts: Post.toResponseMany(posts) })
        }
        const user = await User.findOne(id)
        if (!user) {
          throw new HTTPException(404, { message: 'User not found' })
        }
        return c.json(User.toResponse(user))
      },
    )

    // PATCH /users/:id - Update user
    app.patch(
      '/users/:id',
      {
        openapi: {
          summary: 'Update user',
          params: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: User.toOpenAPISchema('update') } },
          },
          responses: {
            '200': {
              description: 'Updated user',
              content: { 'application/json': { schema: User.toOpenAPISchema('output') } },
            },
            '404': { description: 'User not found' },
          },
        },
      },
      User.validator('param', { pick: ['id'] }) as import('hono').MiddlewareHandler,
      User.validator('json', {
        partial: true,
        pick: ['name', 'email'],
      }) as import('hono').MiddlewareHandler,
      async (c) => {
        // biome-ignore lint/suspicious/noExplicitAny: known limitation, see above
        const { id } = (c.req.valid as (target: 'param') => any)('param')
        // biome-ignore lint/suspicious/noExplicitAny: known limitation, see above
        const body = (c.req.valid as (target: 'json') => any)('json')
        const updated = await User.update(id, body)
        if (!updated) {
          throw new HTTPException(404, { message: 'User not found' })
        }
        return c.json(User.toResponse(updated))
      },
    )

    // DELETE /users/:id - Delete user
    app.delete(
      '/users/:id',
      {
        openapi: {
          summary: 'Delete user',
          params: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '204': { description: 'User deleted' },
            '404': { description: 'User not found' },
          },
        },
      },
      User.validator('param', { pick: ['id'] }) as import('hono').MiddlewareHandler,
      async (c) => {
        // biome-ignore lint/suspicious/noExplicitAny: known limitation, see above
        const { id } = (c.req.valid as (target: 'param') => any)('param')
        const result = await User.delete(id)
        if (result.deleted === 0) {
          throw new HTTPException(404, { message: 'User not found' })
        }
        return c.body(null, 204)
      },
    )

    // POST /auth/register - Register new user
    //
    // ⚠️ SECURITY WARNING ⚠️
    // リクエストボディの `passwordHash` フィールドは **平文パスワード** を受け取る。
    // この命名は `@nanokajs/auth` が `fields.password` で DB カラム名と request body キー名を
    // 共有する仕様に揃えたもの（login / register でキー名統一）。
    //
    //   - クライアント側でハッシュ化した値を送ってはいけない（サーバ側で再ハッシュされ verify が失敗する）
    //   - サーバ側で必ず `pbkdf2Hasher.hash()` を通してから DB に保存すること（下のコード参照）
    //   - この example をコピーして改変する際、`pbkdf2Hasher.hash()` 行を消すと **平文パスワードが
    //     そのまま DB に保存される**。`serverOnly()` で API には出ないので、漏洩時まで気付けない
    //
    // 将来的な改善: `@nanokajs/auth` の `fields.password` に `{ db, request }` 分離を追加して
    // request body キー名を `password`、DB カラム名を `passwordHash` のように分離可能にする予定。
    app.post(
      '/auth/register',
      {
        openapi: {
          summary: 'Register new user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'name', 'passwordHash'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    name: { type: 'string' },
                    passwordHash: {
                      type: 'string',
                      description:
                        'Plain-text password. Server hashes it with PBKDF2 before storing. Do NOT pre-hash on the client.',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'User created',
              content: { 'application/json': { schema: User.toOpenAPISchema('output') } },
            },
            '400': { description: 'Validation error' },
          },
        },
      },
      async (c) => {
        const body = await c.req.json<{ email?: string; name?: string; passwordHash?: string }>()
        if (
          typeof body.email !== 'string' ||
          typeof body.name !== 'string' ||
          typeof body.passwordHash !== 'string'
        ) {
          throw new HTTPException(400, { message: 'email, name, and passwordHash are required' })
        }
        const hashed = await pbkdf2Hasher.hash(body.passwordHash)
        const created = await User.create({
          email: body.email,
          name: body.name,
          passwordHash: hashed,
        })
        return c.json(User.toResponse(created), 201)
      },
    )

    // POST /auth/login - Login
    app.post(
      '/auth/login',
      {
        openapi: {
          summary: 'Login',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'passwordHash'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    passwordHash: {
                      type: 'string',
                      description:
                        'Plain-text password. Server compares it against the stored PBKDF2 hash.',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                    },
                  },
                },
              },
            },
            '401': { description: 'Invalid credentials' },
          },
        },
      },
      auth.loginHandler(),
    )

    // POST /auth/refresh - Refresh access token
    app.post(
      '/auth/refresh',
      {
        openapi: {
          summary: 'Refresh access token',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['refreshToken'],
                  properties: {
                    refreshToken: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Token refreshed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                    },
                  },
                },
              },
            },
            '401': { description: 'Invalid or expired refresh token' },
          },
        },
      },
      auth.refreshHandler(),
    )

    // GET /me - Get current user (requires Bearer token)
    app.get(
      '/me',
      {
        openapi: {
          summary: 'Get current authenticated user',
          responses: {
            '200': {
              description: 'Authenticated user',
              content: { 'application/json': { schema: User.toOpenAPISchema('output') } },
            },
            '401': { description: 'Unauthorized' },
            '404': { description: 'User not found' },
          },
        },
      },
      auth.middleware(),
      async (c) => {
        // auth.middleware() は Variables 型を持たないため 'user' as never でキャストする。
        // payload には { sub: string; type: 'access'; ... } が入る。
        const payload = c.get('user' as never) as { sub?: unknown; type?: unknown }
        // middleware は alg/exp/type を verify するが sub の型・存在は検証しないため
        // ここで明示的にチェックして DB クエリの不正な引数を防ぐ。
        if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
          throw new HTTPException(401, { message: 'Unauthorized' })
        }
        const user = await User.findOne(payload.sub)
        if (!user) {
          throw new HTTPException(404, { message: 'User not found' })
        }
        return c.json(User.toResponse(user))
      },
    )

    // POST /posts - Create post
    app.post(
      '/posts',
      {
        openapi: {
          summary: 'Create post',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: Post.toOpenAPISchema('create') } },
          },
          responses: {
            '201': {
              description: 'Created post',
              content: { 'application/json': { schema: Post.toOpenAPISchema('output') } },
            },
            '400': { description: 'Validation error' },
          },
        },
      },
      Post.validator('json', 'create'),
      async (c) => {
        // biome-ignore lint/suspicious/noExplicitAny: known limitation, see above
        const body = (c.req.valid as (target: 'json') => any)('json')
        const created = await Post.create(body)
        return c.json(Post.toResponse(created), 201)
      },
    )

    // GET /posts - List posts
    app.get(
      '/posts',
      {
        openapi: {
          summary: 'List posts',
          responses: {
            '200': {
              description: 'List of posts',
              content: {
                'application/json': {
                  schema: { type: 'array', items: Post.toOpenAPISchema('output') },
                },
              },
            },
          },
        },
      },
      async (c) => {
        const querySchema = z.object({
          limit: z.coerce.number().int().min(1).max(100).default(20),
          offset: z.coerce.number().int().min(0).default(0),
        })

        const queryResult = querySchema.safeParse(c.req.query())
        if (!queryResult.success) {
          throw new HTTPException(400, { message: 'Invalid query parameters' })
        }

        const { limit, offset } = queryResult.data
        const posts = await Post.findMany({ limit, offset, orderBy: 'id' })
        const result = z.array(Post.outputSchema()).parse(posts)
        return c.json(result)
      },
    )

    // GET /posts/:id - Get single post (supports ?with=author)
    app.get(
      '/posts/:id',
      {
        openapi: {
          summary: 'Get post by ID',
          params: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Post found',
              content: { 'application/json': { schema: Post.toOpenAPISchema('output') } },
            },
            '404': { description: 'Post not found' },
          },
        },
      },
      Post.validator('param', { pick: ['id'] }) as import('hono').MiddlewareHandler,
      async (c) => {
        // biome-ignore lint/suspicious/noExplicitAny: known limitation, see above
        const { id } = (c.req.valid as (target: 'param') => any)('param')
        const withParam = c.req.query('with')
        if (withParam === 'author') {
          const postWithAuthor = await Post.findOne(id, { with: { author: true } })
          if (!postWithAuthor) {
            throw new HTTPException(404, { message: 'Post not found' })
          }
          // biome-ignore lint/suspicious/noExplicitAny: relation result shape varies at runtime
          const { author, ...postData } = postWithAuthor as any
          // Pass author through User.toResponse to strip serverOnly fields (e.g. passwordHash)
          const safeAuthor = author ? User.toResponse(author) : null
          // biome-ignore lint/suspicious/noExplicitAny: spread on toResponse result requires cast when postData is any
          return c.json({ ...(Post.toResponse(postData) as any), author: safeAuthor })
        }
        const post = await Post.findOne(id)
        if (!post) {
          throw new HTTPException(404, { message: 'Post not found' })
        }
        return c.json(Post.toResponse(post))
      },
    )

    // PATCH /posts/:id - Update post
    app.patch(
      '/posts/:id',
      {
        openapi: {
          summary: 'Update post',
          params: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: Post.toOpenAPISchema('update') } },
          },
          responses: {
            '200': {
              description: 'Updated post',
              content: { 'application/json': { schema: Post.toOpenAPISchema('output') } },
            },
            '404': { description: 'Post not found' },
          },
        },
      },
      Post.validator('param', { pick: ['id'] }) as import('hono').MiddlewareHandler,
      Post.validator('json', {
        partial: true,
        pick: ['title', 'body'],
      }) as import('hono').MiddlewareHandler,
      async (c) => {
        // biome-ignore lint/suspicious/noExplicitAny: known limitation, see above
        const { id } = (c.req.valid as (target: 'param') => any)('param')
        // biome-ignore lint/suspicious/noExplicitAny: known limitation, see above
        const body = (c.req.valid as (target: 'json') => any)('json')
        const updated = await Post.update(id, body)
        if (!updated) {
          throw new HTTPException(404, { message: 'Post not found' })
        }
        return c.json(Post.toResponse(updated))
      },
    )

    // DELETE /posts/:id - Delete post
    app.delete(
      '/posts/:id',
      {
        openapi: {
          summary: 'Delete post',
          params: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '204': { description: 'Post deleted' },
            '404': { description: 'Post not found' },
          },
        },
      },
      Post.validator('param', { pick: ['id'] }) as import('hono').MiddlewareHandler,
      async (c) => {
        // biome-ignore lint/suspicious/noExplicitAny: known limitation, see above
        const { id } = (c.req.valid as (target: 'param') => any)('param')
        const result = await Post.delete(id)
        if (result.deleted === 0) {
          throw new HTTPException(404, { message: 'Post not found' })
        }
        return c.body(null, 204)
      },
    )

    app.get('/openapi.json', (c) =>
      c.json(
        app.generateOpenAPISpec({
          info: { title: 'Nanoka Basic Example', version: '0.1.0' },
        }),
      ),
    )
    app.get('/docs', swaggerUI({ url: '/openapi.json', title: 'API Docs' }))

    return app.fetch(req, env, ctx)
  },
}
