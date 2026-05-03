import { z } from 'zod'
import type { Field } from '../field/types'
import type { SchemaOptions } from './types'

type PolicyUsage = 'input-create' | 'input-update' | 'output'

/**
 * Returns field names that are security-critical and must always be omitted from API schemas.
 * Currently only serverOnly fields. These cannot be overridden by user pick/omit.
 */
function computeForcedOmit(
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for generic Field handling
  fields: Record<string, Field<any, any, any>>,
): string[] {
  const omit: string[] = []
  for (const [key, field] of Object.entries(fields)) {
    if (field.modifiers.policy === 'serverOnly') {
      omit.push(key)
    }
  }
  return omit
}

/**
 * Returns field names to omit based on UX-oriented policy (writeOnly / readOnly).
 * These can be overridden when user explicitly provides pick.
 */
function computeOptionalOmit(
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for generic Field handling
  fields: Record<string, Field<any, any, any>>,
  target: PolicyUsage,
): string[] {
  const omit: string[] = []
  for (const [key, field] of Object.entries(fields)) {
    const policy = field.modifiers.policy
    if (!policy) continue
    if (policy === 'writeOnly' && target === 'output') {
      omit.push(key)
    } else if (policy === 'readOnly' && (target === 'input-create' || target === 'input-update')) {
      omit.push(key)
    }
  }
  return omit
}

/**
 * Merges policy-derived omit with user-provided SchemaOptions.
 *
 * serverOnly fields are always omitted regardless of user pick/omit (security invariant).
 * writeOnly / readOnly are UX-oriented and can be overridden when user provides pick.
 * For 'input-update', partial defaults to true unless user specifies otherwise.
 */
export function derivePolicyOptions(
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for generic Field handling
  fields: Record<string, Field<any, any, any>>,
  usage: PolicyUsage,
  userOpts?: SchemaOptions,
): SchemaOptions {
  const forced = computeForcedOmit(fields)
  const optional = computeOptionalOmit(fields, usage)

  if (userOpts?.pick !== undefined) {
    const partial = usage === 'input-update' ? (userOpts.partial ?? true) : userOpts.partial
    // serverOnly fields are stripped from pick even if user explicitly listed them
    const sanitizedPick = Array.from(userOpts.pick).filter((k) => !forced.includes(k))
    // Combine forced omit with user-provided omit to preserve both constraints
    const combinedOmit = [...new Set([...forced, ...(userOpts.omit ?? [])])]
    return {
      ...userOpts,
      pick: sanitizedPick,
      ...(combinedOmit.length > 0 ? { omit: combinedOmit } : {}),
      partial,
    }
  }

  const combinedOmit = [...new Set([...forced, ...optional, ...(userOpts?.omit ?? [])])]
  const partial =
    usage === 'input-update' ? (userOpts?.partial ?? true) : (userOpts?.partial ?? undefined)

  return {
    ...(userOpts ?? {}),
    ...(combinedOmit.length > 0 ? { omit: combinedOmit } : {}),
    ...(partial !== undefined ? { partial } : {}),
  }
}

/**
 * Builds a Zod object schema from a fields definition.
 * Returns a ZodObject with all fields required and present.
 */
// biome-ignore lint/suspicious/noExplicitAny: any is necessary for generic Field handling and Zod shape
export function buildBaseObject(fields: Record<string, Field<any, any, any>>): z.ZodObject<any> {
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
  // `partial: false` を渡してもこの条件で何もしない。スキーマは required のまま。
  if (opts.partial === true) {
    schema = schema.partial()
  }

  // biome-ignore lint/suspicious/noExplicitAny: Cast to Apply type at call site
  return schema as any
}
