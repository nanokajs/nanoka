import { Hono } from 'hono'
import type { BlankEnv, Env } from 'hono/types'
import type { Adapter } from '../adapter/types'
import type { Field } from '../field/types'
import { defineModel } from '../model/define'
import type { Nanoka, NanokaModel } from './types'

/**
 * Creates a Nanoka application instance with the given database adapter.
 *
 * @param adapter - The database adapter (e.g., d1Adapter(env.DB))
 * @returns A Nanoka application (Hono extended with model(), db, and batch)
 *
 * @example
 * export default {
 *   fetch(req: Request, env: Env, ctx: ExecutionContext) {
 *     const app = nanoka(d1Adapter(env.DB))
 *     const User = app.model('users', { id, name, email, passwordHash })
 *     app.get('/users', async (c) => {
 *       const users = await User.findMany({ limit: 20 })
 *       return c.json(users)
 *     })
 *     return app.fetch(req, env, ctx)
 *   }
 * }
 */
export function nanoka<E extends Env = BlankEnv>(adapter: Adapter): Nanoka<E> {
  const app = new Hono<E>() as Nanoka<E>

  Object.defineProperty(app, 'db', {
    get: () => adapter.drizzle,
    enumerable: true,
  })

  app.batch = ((queries: Parameters<Adapter['batch']>[0]) =>
    adapter.batch(queries)) as unknown as Adapter['batch']

  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field generic constraint
  app.model = function model<Fields extends Record<string, Field<any, any, any>>>(
    name: string,
    fields: Fields,
  ): NanokaModel<Fields> {
    const inner = defineModel(name, fields)

    return {
      fields: inner.fields,
      tableName: inner.tableName,
      table: inner.table,

      schema: (opts) => inner.schema(opts),

      // biome-ignore lint/suspicious/noExplicitAny: Hook<T> is contravariant in T; any is required to bridge overload implementations
      validator: (
        ...args: [
          keyof import('hono').ValidationTargets,
          ('create' | 'update' | import('../model/types').SchemaOptions<keyof Fields & string>)?,
          import('@hono/zod-validator').Hook<
            any,
            import('hono').Env,
            string,
            keyof import('hono').ValidationTargets
          >?,
        ]
      ) => {
        // `ReturnType<typeof inner.validator>` は overload の最後の戻り型しか取れないため、
        // preset overload の戻り型と完全には一致しない。outer の `NanokaModel` interface の
        // overload 定義 (router/types.ts) で type safety は担保しているが、
        // `validator` preset の型を精緻化するタイミング (Phase 2 M2.3) でこの cast も併せて見直す。
        return (inner.validator as (...a: typeof args) => ReturnType<typeof inner.validator>)(
          ...args,
        )
      },

      inputSchema: (usage, opts) => inner.inputSchema(usage, opts),

      outputSchema: (opts) => inner.outputSchema(opts),

      toResponse: (row) => inner.toResponse(row),

      findMany: (options) => inner.findMany(adapter, options),

      findOne: (idOrWhere) => inner.findOne(adapter, idOrWhere),

      create: (data) => inner.create(adapter, data),

      update: (idOrWhere, data) => inner.update(adapter, idOrWhere, data),

      delete: (idOrWhere) => inner.delete(adapter, idOrWhere),
    }
  }

  return app
}
