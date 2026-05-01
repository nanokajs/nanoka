import type { SQLiteColumnBuilderBase } from 'drizzle-orm/sqlite-core'
import type { ZodTypeAny } from 'zod'

export interface FieldModifiers {
  optional?: boolean
  primary?: boolean
  unique?: boolean
  hasDefault?: boolean
  defaultValue?: unknown
  format?: 'email' | 'uuid'
  min?: number
  max?: number
}

/**
 * Represents a typed database field with Zod validation and Drizzle column mapping.
 *
 * @template TS - The TypeScript runtime type of the field (e.g. `string`, `number`, `Date`)
 * @template Mods - Modifiers applied to the field (optional, primary, unique, etc.)
 *
 * The `tsType` property is a phantom type (its runtime value is always `undefined as unknown as TS`)
 * and serves purely for type narrowing. It is not intended for runtime access.
 *
 * @internal `tsType` is an internal phantom property; use type narrowing via `InferFieldType` instead.
 */
// biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
export interface Field<TS = unknown, Mods extends FieldModifiers = {}> {
  /**
   * Phantom type representing the TypeScript type of this field.
   *
   * @internal This is a phantom property and should not be accessed at runtime.
   */
  readonly tsType: TS

  /**
   * A Zod schema that validates values matching this field's configuration.
   * Includes all modifiers (format constraints, min/max, optional, default).
   */
  readonly zodBase: ZodTypeAny

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
export type InferFieldType<F> = F extends Field<infer T, FieldModifiers> ? T : never
