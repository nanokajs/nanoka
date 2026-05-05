import { z } from 'zod'
import type { Field } from '../field/types'
import { type FieldAccessor, resolveSchemaOptionKeys, type SchemaOptions } from './types'

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
 * Returns field names for relation fields that must always be omitted from API schemas.
 * Relation fields have no DB column and no Zod schema representation.
 */
function computeRelationOmit(
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for generic Field handling
  fields: Record<string, Field<any, any, any>>,
): Set<string> {
  const keys = new Set<string>()
  for (const [key, field] of Object.entries(fields)) {
    if (field.kind === 'relation') keys.add(key)
  }
  return keys
}

/**
 * Returns field names to omit based on UX-oriented policy (writeOnly / readOnly).
 * These can be overridden when user explicitly provides pick.
 *
 * Policy mapping:
 * - `writeOnly`: omitted from output only. For input targets (input-create, input-update),
 *   writeOnly fields are NOT omitted — they are intentionally part of the input (e.g. password).
 * - `readOnly`: omitted from input targets (input-create, input-update) only. Remains in output.
 *
 * The asymmetry is by design: writeOnly means "accepted on write, hidden on read";
 * readOnly means "visible on read, rejected on write".
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
  // biome-ignore lint/suspicious/noExplicitAny: accessor is a plain object with string keys
  accessor?: FieldAccessor<any>,
): SchemaOptions {
  const forcedBase = computeForcedOmit(fields)
  const relationOmit = computeRelationOmit(fields)
  const forced = [...new Set([...forcedBase, ...relationOmit])]
  const optional = computeOptionalOmit(fields, usage)

  const acc = accessor ?? ({} as FieldAccessor<string>)
  const resolvedPick = resolveSchemaOptionKeys(userOpts?.pick, acc)
  const resolvedOmit = resolveSchemaOptionKeys(userOpts?.omit, acc)

  if (resolvedPick !== undefined) {
    const partial = usage === 'input-update' ? (userOpts?.partial ?? true) : userOpts?.partial
    // serverOnly fields are stripped from pick even if user explicitly listed them
    const sanitizedPick = Array.from(resolvedPick).filter((k) => !forced.includes(k))
    // Combine forced omit with user-provided omit to preserve both constraints
    const combinedOmit = [...new Set([...forced, ...(resolvedOmit ?? [])])]
    return {
      ...userOpts,
      pick: sanitizedPick,
      ...(combinedOmit.length > 0 ? { omit: combinedOmit } : {}),
      partial,
    }
  }

  const combinedOmit = [...new Set([...forced, ...optional, ...(resolvedOmit ?? [])])]
  const partial =
    usage === 'input-update' ? (userOpts?.partial ?? true) : (userOpts?.partial ?? undefined)

  return {
    ...(userOpts ?? {}),
    pick: undefined,
    ...(combinedOmit.length > 0 ? { omit: combinedOmit } : {}),
    ...(partial !== undefined ? { partial } : {}),
  }
}

/**
 * Builds a Zod object schema from a fields definition.
 * Returns a ZodObject with all fields required and present.
 * Relation fields are excluded as they have no Zod schema representation.
 */
// biome-ignore lint/suspicious/noExplicitAny: any is necessary for generic Field handling and Zod shape
export function buildBaseObject(fields: Record<string, Field<any, any, any>>): z.ZodObject<any> {
  // biome-ignore lint/suspicious/noExplicitAny: Record key-value pairs have any type for shape
  const shape: Record<string, any> = {}
  for (const [key, field] of Object.entries(fields)) {
    if (field.kind === 'relation') continue
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
  // biome-ignore lint/suspicious/noExplicitAny: accessor is a plain object with string keys
  accessor?: FieldAccessor<any>,
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for return type
): z.ZodObject<any> {
  if (!opts) {
    return baseSchema
  }

  const acc = accessor ?? ({} as FieldAccessor<string>)
  const resolvedPick = resolveSchemaOptionKeys(opts.pick, acc)
  const resolvedOmit = resolveSchemaOptionKeys(opts.omit, acc)

  let schema = baseSchema

  // Apply pick
  if (resolvedPick !== undefined) {
    const pickArray = Array.from(resolvedPick)
    schema = schema.pick(
      // biome-ignore lint/suspicious/noExplicitAny: Zod API
      Object.fromEntries(pickArray.map((k) => [k, true])) as any,
    )
  }

  // Apply omit
  if (resolvedOmit !== undefined) {
    const omitArray = Array.from(resolvedOmit)
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
