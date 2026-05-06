import { d1Adapter, nanoka, swaggerUI, t } from '@nanokajs/core'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { postFields, postTableName } from './models/post'
import { userFields, userTableName } from './models/user'

export interface Env {
  DB: D1Database
  ENVIRONMENT: string
  DEBUG?: string
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
