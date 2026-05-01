import { z } from 'zod'
import type { Field } from '../field/types'
import type { SchemaOptions } from './types'

/**
 * Builds a Zod object schema from a fields definition.
 * Returns a ZodObject with all fields required and present.
 */
// biome-ignore lint/suspicious/noExplicitAny: any is necessary for generic Field handling and Zod shape
export function buildBaseObject(fields: Record<string, Field<any, any>>): z.ZodObject<any> {
  // biome-ignore lint/suspicious/noExplicitAny: Record key-value pairs have any type for shape
  const shape: Record<string, any> = {}
  for (const [key, field] of Object.entries(fields)) {
    shape[key] = field.zodBase
  }
  return z.object(shape)
}

/**
 * Applies pick, omit, and partial transformations to a Zod object schema.
 * Order: pick → omit → partial
 *
 * Returns the transformed schema, cast to Apply<Shape, Opts> at the call site.
 */
export function applySchemaOptions(
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for generic Zod shape operations
  baseSchema: z.ZodObject<any>,
  opts: SchemaOptions | undefined,
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for return type
): z.ZodObject<any> {
  if (!opts) {
    return baseSchema
  }

  let schema = baseSchema

  // Apply pick
  if (opts.pick !== undefined) {
    // Convert readonly array to string array for .pick()
    const pickArray = Array.from(opts.pick)
    schema = schema.pick(
      // biome-ignore lint/suspicious/noExplicitAny: Zod API
      Object.fromEntries(pickArray.map((k) => [k, true])) as any,
    )
  }

  // Apply omit
  if (opts.omit !== undefined) {
    // Convert readonly array to string array for .omit()
    const omitArray = Array.from(opts.omit)
    schema = schema.omit(
      // biome-ignore lint/suspicious/noExplicitAny: Zod API
      Object.fromEntries(omitArray.map((k) => [k, true])) as any,
    )
  }

  // Apply partial
  if (opts.partial === true) {
    schema = schema.partial()
  }

  // biome-ignore lint/suspicious/noExplicitAny: Cast to Apply type at call site
  return schema as any
}
