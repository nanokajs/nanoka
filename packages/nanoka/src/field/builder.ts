import type { SQLiteColumnBuilderBase } from 'drizzle-orm/sqlite-core'
import type { z } from 'zod'
import type { Field, FieldKind, FieldModifiers } from './types'

/**
 * Abstract base class for field builders.
 * Provides shared implementation for Zod and Drizzle integration.
 *
 * Subclasses must implement:
 * - `zodBase: ZB` getter
 * - `drizzleColumn(name: string): SQLiteColumnBuilderBase` method
 * - Modifier chain methods (optional, primary, unique, default) that return the subclass type
 *
 * @template TS - The TypeScript type of the field
 * @template Mods - The type of modifiers currently applied
 * @template ZB - The Zod base schema type for this field
 */
export abstract class BaseFieldBuilder<
  TS,
  // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
  Mods extends FieldModifiers = {},
  ZB extends z.ZodTypeAny = z.ZodTypeAny,
> implements Field<TS, Mods, ZB>
{
  readonly tsType: TS = undefined as unknown as TS
  abstract readonly kind: FieldKind
  readonly modifiers: Readonly<Mods>

  constructor(modifiers?: Mods) {
    this.modifiers = Object.freeze((modifiers ?? {}) as Mods)
  }

  abstract get zodBase(): ZB
  abstract drizzleColumn(name: string): SQLiteColumnBuilderBase

  /**
   * Creates an immutable copy of this field with updated modifiers.
   * Subclasses must implement this to maintain their concrete type.
   */
  // biome-ignore lint/suspicious/noExplicitAny: Field builders return polymorphic types
  protected abstract cloneWithModifiers(mods: FieldModifiers): any

  /**
   * Returns the Zod schema with all modifiers applied.
   * Order: base schema → format/min/max constraints → optional → default
   */
  protected applyModifiersToZod(baseSchema: z.ZodTypeAny): z.ZodTypeAny {
    let schema = baseSchema

    // Apply optional — use nullable() first so D1/SQLite null values are accepted
    if (this.modifiers.optional) {
      schema = schema.nullable().optional()
    }

    // Apply default
    if (this.modifiers.hasDefault) {
      const defaultValue = this.modifiers.defaultValue
      schema = schema.default(defaultValue)
    }

    return schema
  }
}
