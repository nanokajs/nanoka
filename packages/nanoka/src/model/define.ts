import { zValidator } from '@hono/zod-validator'
import type { Field } from '../field/types'
import type { Adapter } from '../adapter/types'
import { applySchemaOptions, buildBaseObject } from './schema'
import { buildTable } from './table'
import { findManyImpl, findOneImpl, createImpl, updateImpl, deleteImpl } from './crud'
import type { Apply, FieldsToZodShape, Model, SchemaOptions, FindManyOptions, IdOrWhere, RowType, CreateInput } from './types'

const validationTargets = {
  json: true,
  query: true,
  param: true,
  header: true,
  cookie: true,
  form: true,
} as const

/**
 * Creates a Model instance from a tableName and fields definition.
 * The model supports deriving Zod schemas, Hono validators, and CRUD operations.
 *
 * @example
 * const User = defineModel('users', {
 *   id: t.uuid().primary(),
 *   name: t.string(),
 *   email: t.string().email(),
 *   passwordHash: t.string(),
 * })
 *
 * const CreateSchema = User.schema({ omit: ['passwordHash'] })
 * const users = await User.findMany(adapter, { limit: 20 })
 */
// biome-ignore lint/suspicious/noExplicitAny: any is necessary for generic Field constraint
export function defineModel<Fields extends Record<string, Field<any, any, any>>>(
  tableName: string,
  fields: Fields,
): Model<Fields> {
  const table = buildTable(tableName, fields)

  return {
    fields,
    tableName,
    table,

    schema<Opts extends SchemaOptions<keyof Fields & string> | undefined = undefined>(
      opts?: Opts,
    ): Apply<FieldsToZodShape<Fields>, Opts> {
      const baseSchema = buildBaseObject(fields)
      const schema = applySchemaOptions(baseSchema, opts)
      // biome-ignore lint/suspicious/noExplicitAny: Zod .pick()/.omit() return type narrowing requires cast at boundary
      return schema as any
    },

    validator<
      Target extends keyof typeof validationTargets,
      Opts extends SchemaOptions<keyof Fields & string> | undefined = undefined,
    >(target: Target, opts?: Opts) {
      const schema = this.schema(opts)
      // biome-ignore lint/suspicious/noExplicitAny: zValidator requires casting for proper operation
      return zValidator(target, schema as any)
    },

    findMany(adapter: Adapter, options: FindManyOptions<Fields>): Promise<RowType<Fields>[]> {
      return findManyImpl(adapter, table, fields, options)
    },

    findOne(adapter: Adapter, idOrWhere: IdOrWhere<Fields>): Promise<RowType<Fields> | null> {
      return findOneImpl(adapter, table, fields, idOrWhere)
    },

    create(adapter: Adapter, data: CreateInput<Fields>): Promise<RowType<Fields>> {
      return createImpl(adapter, table, data)
    },

    update(
      adapter: Adapter,
      idOrWhere: IdOrWhere<Fields>,
      data: Partial<RowType<Fields>>,
    ): Promise<RowType<Fields> | null> {
      return updateImpl(adapter, table, fields, idOrWhere, data)
    },

    delete(adapter: Adapter, idOrWhere: IdOrWhere<Fields>): Promise<{ readonly deleted: number }> {
      return deleteImpl(adapter, table, fields, idOrWhere)
    },
  }
}
