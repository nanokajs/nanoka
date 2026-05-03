import { type Hook, zValidator } from '@hono/zod-validator'
import type { Env, ValidationTargets } from 'hono'
import type { z } from 'zod'
import type { Adapter } from '../adapter/types'
import type { Field } from '../field/types'
import { toOpenAPIComponent, toOpenAPISchema } from '../openapi/generate'
import type { OpenAPIUsage } from '../openapi/types'
import { createImpl, deleteImpl, findManyImpl, findOneImpl, updateImpl } from './crud'
import { applySchemaOptions, buildBaseObject, derivePolicyOptions } from './schema'
import { buildTable } from './table'
import type {
  Apply,
  CreateInput,
  FieldsToZodShape,
  FindManyOptions,
  IdOrWhere,
  Model,
  RowType,
  SchemaOptions,
} from './types'
import { buildFieldAccessor } from './types'

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
  const accessor = buildFieldAccessor(fields)

  return {
    fields,
    tableName,
    table,

    schema<Opts extends SchemaOptions<keyof Fields & string> | undefined>(
      opts?: Opts,
    ): Apply<FieldsToZodShape<Fields>, Opts> {
      const baseSchema = buildBaseObject(fields)
      const schema = applySchemaOptions(baseSchema, opts, accessor)
      // biome-ignore lint/suspicious/noExplicitAny: Zod .pick()/.omit() return type narrowing requires cast at boundary
      return schema as any
    },

    validator(
      target: keyof ValidationTargets,
      optsOrPreset?: 'create' | 'update' | SchemaOptions<keyof Fields & string>,
      // biome-ignore lint/suspicious/noExplicitAny: Hook<T> is contravariant in T; any is required to bridge overload implementations
      hook?: Hook<any, Env, string, keyof ValidationTargets>,
    ) {
      let schema: z.ZodTypeAny
      if (optsOrPreset === 'create' || optsOrPreset === 'update') {
        schema = this.inputSchema(optsOrPreset)
      } else {
        schema = this.schema(optsOrPreset as SchemaOptions<keyof Fields & string>)
      }
      // biome-ignore lint/suspicious/noExplicitAny: zValidator return type cast required at overload boundary
      return zValidator(target, schema, hook) as any
    },

    inputSchema(
      usage: 'create' | 'update',
      opts?: SchemaOptions<keyof Fields & string>,
      // biome-ignore lint/suspicious/noExplicitAny: precise return type is enforced by Model<Fields> overload signatures
    ): any {
      const merged = derivePolicyOptions(
        fields,
        usage === 'create' ? 'input-create' : 'input-update',
        opts,
        accessor,
      )
      const baseSchema = buildBaseObject(fields)
      return applySchemaOptions(baseSchema, merged)
    },

    outputSchema(
      opts?: SchemaOptions<keyof Fields & string>,
      // biome-ignore lint/suspicious/noExplicitAny: precise return type is enforced by Model<Fields> overload signatures
    ): any {
      const merged = derivePolicyOptions(fields, 'output', opts, accessor)
      const baseSchema = buildBaseObject(fields)
      return applySchemaOptions(baseSchema, merged)
    },

    toResponse(row: RowType<Fields>): unknown {
      return this.outputSchema().parse(row)
    },

    toOpenAPIComponent() {
      return toOpenAPIComponent(fields)
    },

    toOpenAPISchema(usage: OpenAPIUsage) {
      return toOpenAPISchema(fields, usage)
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
