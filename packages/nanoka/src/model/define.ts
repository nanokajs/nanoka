import { zValidator } from '@hono/zod-validator'
import type { Field } from '../field/types'
import { applySchemaOptions, buildBaseObject } from './schema'
import type { Apply, FieldsToZodShape, Model, SchemaOptions } from './types'

const validationTargets = {
  json: true,
  query: true,
  param: true,
  header: true,
  cookie: true,
  form: true,
} as const

/**
 * Creates a Model instance from a fields definition.
 * The model supports deriving Zod schemas and Hono validators with pick/omit/partial transformations.
 *
 * @example
 * const User = defineModel({
 *   id: t.uuid().primary(),
 *   name: t.string(),
 *   email: t.string().email(),
 *   passwordHash: t.string(),
 * })
 *
 * const CreateSchema = User.schema({ omit: ['passwordHash'] })
 * app.post('/users', User.validator('json', { omit: ['passwordHash'] }), c => {
 *   const body = c.req.valid('json')
 * })
 */
// biome-ignore lint/suspicious/noExplicitAny: any is necessary for generic Field constraint
export function defineModel<Fields extends Record<string, Field<any, any, any>>>(
  fields: Fields,
): Model<Fields> {
  return {
    fields,

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
  }
}
