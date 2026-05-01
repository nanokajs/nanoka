import type { SQLiteColumnBuilderBase } from 'drizzle-orm/sqlite-core'
import type { ZodTypeAny } from 'zod'
import type { Field, FieldModifiers } from './types'

/**
 * Abstract base class for field builders.
 * Provides shared implementation for Zod and Drizzle integration.
 *
 * Subclasses must implement:
 * - `zodBase: ZodTypeAny` getter
 * - `drizzleColumn(name: string): SQLiteColumnBuilderBase` method
 * - Modifier chain methods (optional, primary, unique, default) that return the subclass type
 *
 * @template TS - The TypeScript type of the field
 * @template Mods - The type of modifiers currently applied
 */
// biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
export abstract class BaseFieldBuilder<TS, Mods extends FieldModifiers = {}>
  implements Field<TS, Mods>
{
  readonly tsType: TS = undefined as unknown as TS
  readonly modifiers: Readonly<Mods>

  constructor(modifiers?: Mods) {
    this.modifiers = Object.freeze((modifiers ?? {}) as Mods)
  }

  abstract get zodBase(): ZodTypeAny
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
  protected applyModifiersToZod(baseSchema: ZodTypeAny): ZodTypeAny {
    let schema = baseSchema

    // Apply optional
    if (this.modifiers.optional) {
      schema = schema.optional()
    }

    // Apply default
    if (this.modifiers.hasDefault) {
      const defaultValue = this.modifiers.defaultValue
      schema = schema.default(defaultValue)
    }

    return schema
  }
}
