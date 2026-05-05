import type { SQLiteColumnBuilderBase } from 'drizzle-orm/sqlite-core'
import type { z } from 'zod'

export type FieldPolicy = 'serverOnly' | 'writeOnly' | 'readOnly'

export interface FieldModifiers {
  optional?: boolean
  primary?: boolean
  unique?: boolean
  hasDefault?: boolean
  defaultValue?: unknown
  format?: 'email' | 'uuid'
  min?: number
  max?: number
  policy?: FieldPolicy
}

export type FieldKind =
  | 'string'
  | 'uuid'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'timestamp'
  | 'json'
  | 'relation'

export type RelationKind = 'hasMany' | 'belongsTo'

export interface RelationTargetLike {
  readonly fields: Record<
    string,
    { kind: FieldKind; zodBase: unknown; drizzleColumn(name: string): unknown }
  >
  readonly tableName: string
}

export interface RelationDef<
  Target extends RelationTargetLike = RelationTargetLike,
  FK extends string = string,
> {
  readonly kind: 'relation'
  readonly relationKind: RelationKind
  readonly target: Target | (() => Target)
  readonly foreignKey: FK
  readonly tsType: never
  readonly zodBase: z.ZodNever
  // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for empty modifiers
  readonly modifiers: {}
  drizzleColumn(name: string): never
}

export type IsRelationField<F> = F extends { kind: 'relation' } ? true : false

/**
 * Represents a typed database field with Zod validation and Drizzle column mapping.
 *
 * @template TS - The TypeScript runtime type of the field (e.g. `string`, `number`, `Date`)
 * @template Mods - Modifiers applied to the field (optional, primary, unique, etc.)
 * @template ZB - The Zod base schema type for this field
 *
 * The `tsType` property is a phantom type (its runtime value is always `undefined as unknown as TS`)
 * and serves purely for type narrowing. It is not intended for runtime access.
 *
 * @internal `tsType` is an internal phantom property; use type narrowing via `InferFieldType` instead.
 */
export interface Field<
  TS = unknown,
  // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
  Mods extends FieldModifiers = {},
  ZB extends z.ZodTypeAny = z.ZodTypeAny,
> {
  /**
   * Phantom type representing the TypeScript type of this field.
   *
   * @internal This is a phantom property and should not be accessed at runtime.
   */
  readonly tsType: TS

  /**
   * The kind of field (string, uuid, number, integer, boolean, timestamp, json).
   * Used for code generation and field discrimination.
   */
  readonly kind: FieldKind

  /**
   * A Zod schema that validates values matching this field's configuration.
   * Includes all modifiers (format constraints, min/max, optional, default).
   */
  readonly zodBase: ZB

  /**
   * The modifiers currently applied to this field.
   */
  readonly modifiers: Readonly<Mods>

  /**
   * Returns a Drizzle SQLite column builder for this field with the given column name.
   * The builder includes all modifier constraints (notNull, primary, unique, default, etc.).
   *
   * @param name - The column name in the database
   */
  drizzleColumn(name: string): SQLiteColumnBuilderBase
}

/**
 * Extracts the TypeScript type from a Field instance.
 *
 * @example
 * type T1 = InferFieldType<typeof t.string()> // string
 * type T2 = InferFieldType<typeof t.string().optional()> // string | undefined
 */
export type InferFieldType<F> =
  F extends Field<infer T, FieldModifiers, z.ZodTypeAny>
    ? T
    : // biome-ignore lint/suspicious/noExplicitAny: fallback for Zod 4 ZodTypeAny representation
      F extends Field<infer T, FieldModifiers, any>
      ? T
      : never
