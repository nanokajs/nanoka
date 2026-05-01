import type { SQLiteColumnBuilderBase } from 'drizzle-orm/sqlite-core'
import { integer, real, text } from 'drizzle-orm/sqlite-core'
import type { ZodTypeAny } from 'zod'
import { z } from 'zod'
import { BaseFieldBuilder } from './builder'
import type { FieldModifiers } from './types'

// ==================== StringFieldBuilder ====================

// biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
class StringFieldBuilder<TS = string, Mods extends FieldModifiers = {}> extends BaseFieldBuilder<
  TS,
  Mods
> {
  get zodBase(): ZodTypeAny {
    let schema = z.string() as ZodTypeAny

    if (this.modifiers.min !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).min(this.modifiers.min)
    }
    if (this.modifiers.max !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).max(this.modifiers.max)
    }
    if (this.modifiers.format === 'email') {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).email()
    }

    return this.applyModifiersToZod(schema)
  }

  drizzleColumn(name: string): SQLiteColumnBuilderBase {
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle column builder chaining
    let col = text(name) as any

    if (!this.modifiers.optional) {
      col = col.notNull()
    }
    if (this.modifiers.primary) {
      col = col.primaryKey()
    }
    if (this.modifiers.unique) {
      col = col.unique()
    }
    if (this.modifiers.hasDefault) {
      const defaultValue = this.modifiers.defaultValue
      if (typeof defaultValue === 'function') {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.$defaultFn(defaultValue as any)
      } else {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.default(defaultValue as any)
      }
    }

    return col as SQLiteColumnBuilderBase
  }

  protected cloneWithModifiers<NewMods extends FieldModifiers>(
    mods: NewMods,
  ): StringFieldBuilder<TS, NewMods> {
    return new StringFieldBuilder<TS, NewMods>(mods)
  }

  /**
   * Marks this field as optional (allows undefined / null).
   */
  optional(
    this: StringFieldBuilder<TS, Mods>,
  ): StringFieldBuilder<TS | undefined, Mods & { optional: true }> {
    const newMods = { ...this.modifiers, optional: true } as Mods & { optional: true }
    return new StringFieldBuilder<TS | undefined, Mods & { optional: true }>(newMods)
  }

  /**
   * Marks this field as the primary key of its table.
   */
  primary(this: StringFieldBuilder<TS, Mods>): StringFieldBuilder<TS, Mods & { primary: true }> {
    const newMods = { ...this.modifiers, primary: true } as Mods & { primary: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Adds a unique constraint to this field.
   */
  unique(this: StringFieldBuilder<TS, Mods>): StringFieldBuilder<TS, Mods & { unique: true }> {
    const newMods = { ...this.modifiers, unique: true } as Mods & { unique: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets a default value for this field.
   */
  default(
    this: StringFieldBuilder<TS, Mods>,
    value: TS | (() => TS),
  ): StringFieldBuilder<TS, Mods & { hasDefault: true }> {
    const newMods = { ...this.modifiers, hasDefault: true, defaultValue: value } as Mods & {
      hasDefault: true
    }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Adds email format validation.
   */
  email(this: StringFieldBuilder<TS, Mods>): StringFieldBuilder<TS, Mods & { format: 'email' }> {
    const newMods = { ...this.modifiers, format: 'email' as const } as Mods & { format: 'email' }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets minimum string length.
   */
  min(
    this: StringFieldBuilder<TS, Mods>,
    n: number,
  ): StringFieldBuilder<TS, Mods & { min: number }> {
    const newMods = { ...this.modifiers, min: n } as Mods & { min: number }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets maximum string length.
   */
  max(
    this: StringFieldBuilder<TS, Mods>,
    n: number,
  ): StringFieldBuilder<TS, Mods & { max: number }> {
    const newMods = { ...this.modifiers, max: n } as Mods & { max: number }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== UuidFieldBuilder ====================

// biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
class UuidFieldBuilder<TS = string, Mods extends FieldModifiers = {}> extends BaseFieldBuilder<
  TS,
  Mods
> {
  get zodBase(): ZodTypeAny {
    let schema = z.string().uuid() as ZodTypeAny

    if (this.modifiers.min !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).min(this.modifiers.min)
    }
    if (this.modifiers.max !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).max(this.modifiers.max)
    }

    return this.applyModifiersToZod(schema)
  }

  drizzleColumn(name: string): SQLiteColumnBuilderBase {
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle column builder chaining
    let col = text(name) as any

    if (!this.modifiers.optional) {
      col = col.notNull()
    }
    if (this.modifiers.primary) {
      col = col.primaryKey()
    }
    if (this.modifiers.unique) {
      col = col.unique()
    }
    if (this.modifiers.hasDefault) {
      const defaultValue = this.modifiers.defaultValue
      if (typeof defaultValue === 'function') {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.$defaultFn(defaultValue as any)
      } else {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.default(defaultValue as any)
      }
    }

    return col as SQLiteColumnBuilderBase
  }

  protected cloneWithModifiers<NewMods extends FieldModifiers>(
    mods: NewMods,
  ): UuidFieldBuilder<TS, NewMods> {
    return new UuidFieldBuilder<TS, NewMods>(mods)
  }

  /**
   * Marks this field as optional (allows undefined / null).
   */
  optional(
    this: UuidFieldBuilder<TS, Mods>,
  ): UuidFieldBuilder<TS | undefined, Mods & { optional: true }> {
    const newMods = { ...this.modifiers, optional: true } as Mods & { optional: true }
    return new UuidFieldBuilder<TS | undefined, Mods & { optional: true }>(newMods)
  }

  /**
   * Marks this field as the primary key of its table.
   */
  primary(this: UuidFieldBuilder<TS, Mods>): UuidFieldBuilder<TS, Mods & { primary: true }> {
    const newMods = { ...this.modifiers, primary: true } as Mods & { primary: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Adds a unique constraint to this field.
   */
  unique(this: UuidFieldBuilder<TS, Mods>): UuidFieldBuilder<TS, Mods & { unique: true }> {
    const newMods = { ...this.modifiers, unique: true } as Mods & { unique: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets a default value for this field.
   */
  default(
    this: UuidFieldBuilder<TS, Mods>,
    value: TS | (() => TS),
  ): UuidFieldBuilder<TS, Mods & { hasDefault: true }> {
    const newMods = { ...this.modifiers, hasDefault: true, defaultValue: value } as Mods & {
      hasDefault: true
    }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets minimum string length.
   */
  min(this: UuidFieldBuilder<TS, Mods>, n: number): UuidFieldBuilder<TS, Mods & { min: number }> {
    const newMods = { ...this.modifiers, min: n } as Mods & { min: number }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets maximum string length.
   */
  max(this: UuidFieldBuilder<TS, Mods>, n: number): UuidFieldBuilder<TS, Mods & { max: number }> {
    const newMods = { ...this.modifiers, max: n } as Mods & { max: number }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== NumberFieldBuilder ====================

// biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
class NumberFieldBuilder<TS = number, Mods extends FieldModifiers = {}> extends BaseFieldBuilder<
  TS,
  Mods
> {
  get zodBase(): ZodTypeAny {
    let schema = z.number() as ZodTypeAny

    if (this.modifiers.min !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).min(this.modifiers.min)
    }
    if (this.modifiers.max !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).max(this.modifiers.max)
    }

    return this.applyModifiersToZod(schema)
  }

  drizzleColumn(name: string): SQLiteColumnBuilderBase {
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle column builder chaining
    let col = real(name) as any

    if (!this.modifiers.optional) {
      col = col.notNull()
    }
    if (this.modifiers.primary) {
      col = col.primaryKey()
    }
    if (this.modifiers.unique) {
      col = col.unique()
    }
    if (this.modifiers.hasDefault) {
      const defaultValue = this.modifiers.defaultValue
      if (typeof defaultValue === 'function') {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.$defaultFn(defaultValue as any)
      } else {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.default(defaultValue as any)
      }
    }

    return col as SQLiteColumnBuilderBase
  }

  protected cloneWithModifiers<NewMods extends FieldModifiers>(
    mods: NewMods,
  ): NumberFieldBuilder<TS, NewMods> {
    return new NumberFieldBuilder<TS, NewMods>(mods)
  }

  /**
   * Marks this field as optional (allows undefined / null).
   */
  optional(
    this: NumberFieldBuilder<TS, Mods>,
  ): NumberFieldBuilder<TS | undefined, Mods & { optional: true }> {
    const newMods = { ...this.modifiers, optional: true } as Mods & { optional: true }
    return new NumberFieldBuilder<TS | undefined, Mods & { optional: true }>(newMods)
  }

  /**
   * Marks this field as the primary key of its table.
   */
  primary(this: NumberFieldBuilder<TS, Mods>): NumberFieldBuilder<TS, Mods & { primary: true }> {
    const newMods = { ...this.modifiers, primary: true } as Mods & { primary: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Adds a unique constraint to this field.
   */
  unique(this: NumberFieldBuilder<TS, Mods>): NumberFieldBuilder<TS, Mods & { unique: true }> {
    const newMods = { ...this.modifiers, unique: true } as Mods & { unique: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets a default value for this field.
   */
  default(
    this: NumberFieldBuilder<TS, Mods>,
    value: TS | (() => TS),
  ): NumberFieldBuilder<TS, Mods & { hasDefault: true }> {
    const newMods = { ...this.modifiers, hasDefault: true, defaultValue: value } as Mods & {
      hasDefault: true
    }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets minimum value.
   */
  min(
    this: NumberFieldBuilder<TS, Mods>,
    n: number,
  ): NumberFieldBuilder<TS, Mods & { min: number }> {
    const newMods = { ...this.modifiers, min: n } as Mods & { min: number }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets maximum value.
   */
  max(
    this: NumberFieldBuilder<TS, Mods>,
    n: number,
  ): NumberFieldBuilder<TS, Mods & { max: number }> {
    const newMods = { ...this.modifiers, max: n } as Mods & { max: number }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== IntegerFieldBuilder ====================

// biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
class IntegerFieldBuilder<TS = number, Mods extends FieldModifiers = {}> extends BaseFieldBuilder<
  TS,
  Mods
> {
  get zodBase(): ZodTypeAny {
    let schema = z.number().int() as ZodTypeAny

    if (this.modifiers.min !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).min(this.modifiers.min)
    }
    if (this.modifiers.max !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).max(this.modifiers.max)
    }

    return this.applyModifiersToZod(schema)
  }

  drizzleColumn(name: string): SQLiteColumnBuilderBase {
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle column builder chaining
    let col = integer(name) as any

    if (!this.modifiers.optional) {
      col = col.notNull()
    }
    if (this.modifiers.primary) {
      col = col.primaryKey()
    }
    if (this.modifiers.unique) {
      col = col.unique()
    }
    if (this.modifiers.hasDefault) {
      const defaultValue = this.modifiers.defaultValue
      if (typeof defaultValue === 'function') {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.$defaultFn(defaultValue as any)
      } else {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.default(defaultValue as any)
      }
    }

    return col as SQLiteColumnBuilderBase
  }

  protected cloneWithModifiers<NewMods extends FieldModifiers>(
    mods: NewMods,
  ): IntegerFieldBuilder<TS, NewMods> {
    return new IntegerFieldBuilder<TS, NewMods>(mods)
  }

  /**
   * Marks this field as optional (allows undefined / null).
   */
  optional(
    this: IntegerFieldBuilder<TS, Mods>,
  ): IntegerFieldBuilder<TS | undefined, Mods & { optional: true }> {
    const newMods = { ...this.modifiers, optional: true } as Mods & { optional: true }
    return new IntegerFieldBuilder<TS | undefined, Mods & { optional: true }>(newMods)
  }

  /**
   * Marks this field as the primary key of its table.
   */
  primary(this: IntegerFieldBuilder<TS, Mods>): IntegerFieldBuilder<TS, Mods & { primary: true }> {
    const newMods = { ...this.modifiers, primary: true } as Mods & { primary: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Adds a unique constraint to this field.
   */
  unique(this: IntegerFieldBuilder<TS, Mods>): IntegerFieldBuilder<TS, Mods & { unique: true }> {
    const newMods = { ...this.modifiers, unique: true } as Mods & { unique: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets a default value for this field.
   */
  default(
    this: IntegerFieldBuilder<TS, Mods>,
    value: TS | (() => TS),
  ): IntegerFieldBuilder<TS, Mods & { hasDefault: true }> {
    const newMods = { ...this.modifiers, hasDefault: true, defaultValue: value } as Mods & {
      hasDefault: true
    }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets minimum value.
   */
  min(
    this: IntegerFieldBuilder<TS, Mods>,
    n: number,
  ): IntegerFieldBuilder<TS, Mods & { min: number }> {
    const newMods = { ...this.modifiers, min: n } as Mods & { min: number }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets maximum value.
   */
  max(
    this: IntegerFieldBuilder<TS, Mods>,
    n: number,
  ): IntegerFieldBuilder<TS, Mods & { max: number }> {
    const newMods = { ...this.modifiers, max: n } as Mods & { max: number }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== BooleanFieldBuilder ====================

// biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
class BooleanFieldBuilder<TS = boolean, Mods extends FieldModifiers = {}> extends BaseFieldBuilder<
  TS,
  Mods
> {
  get zodBase(): ZodTypeAny {
    return this.applyModifiersToZod(z.boolean())
  }

  drizzleColumn(name: string): SQLiteColumnBuilderBase {
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle column builder chaining
    let col = integer(name, { mode: 'boolean' }) as any

    if (!this.modifiers.optional) {
      col = col.notNull()
    }
    if (this.modifiers.primary) {
      col = col.primaryKey()
    }
    if (this.modifiers.unique) {
      col = col.unique()
    }
    if (this.modifiers.hasDefault) {
      const defaultValue = this.modifiers.defaultValue
      if (typeof defaultValue === 'function') {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.$defaultFn(defaultValue as any)
      } else {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.default(defaultValue as any)
      }
    }

    return col as SQLiteColumnBuilderBase
  }

  protected cloneWithModifiers<NewMods extends FieldModifiers>(
    mods: NewMods,
  ): BooleanFieldBuilder<TS, NewMods> {
    return new BooleanFieldBuilder<TS, NewMods>(mods)
  }

  /**
   * Marks this field as optional (allows undefined / null).
   */
  optional(
    this: BooleanFieldBuilder<TS, Mods>,
  ): BooleanFieldBuilder<TS | undefined, Mods & { optional: true }> {
    const newMods = { ...this.modifiers, optional: true } as Mods & { optional: true }
    return new BooleanFieldBuilder<TS | undefined, Mods & { optional: true }>(newMods)
  }

  /**
   * Marks this field as the primary key of its table.
   */
  primary(this: BooleanFieldBuilder<TS, Mods>): BooleanFieldBuilder<TS, Mods & { primary: true }> {
    const newMods = { ...this.modifiers, primary: true } as Mods & { primary: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Adds a unique constraint to this field.
   */
  unique(this: BooleanFieldBuilder<TS, Mods>): BooleanFieldBuilder<TS, Mods & { unique: true }> {
    const newMods = { ...this.modifiers, unique: true } as Mods & { unique: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets a default value for this field.
   */
  default(
    this: BooleanFieldBuilder<TS, Mods>,
    value: TS | (() => TS),
  ): BooleanFieldBuilder<TS, Mods & { hasDefault: true }> {
    const newMods = { ...this.modifiers, hasDefault: true, defaultValue: value } as Mods & {
      hasDefault: true
    }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== TimestampFieldBuilder ====================

// biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
class TimestampFieldBuilder<TS = Date, Mods extends FieldModifiers = {}> extends BaseFieldBuilder<
  TS,
  Mods
> {
  get zodBase(): ZodTypeAny {
    return this.applyModifiersToZod(z.coerce.date())
  }

  drizzleColumn(name: string): SQLiteColumnBuilderBase {
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle column builder chaining
    let col = integer(name, { mode: 'timestamp_ms' }) as any

    if (!this.modifiers.optional) {
      col = col.notNull()
    }
    if (this.modifiers.primary) {
      col = col.primaryKey()
    }
    if (this.modifiers.unique) {
      col = col.unique()
    }
    if (this.modifiers.hasDefault) {
      const defaultValue = this.modifiers.defaultValue
      if (typeof defaultValue === 'function') {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.$defaultFn(defaultValue as any)
      } else {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.default(defaultValue as any)
      }
    }

    return col as SQLiteColumnBuilderBase
  }

  protected cloneWithModifiers<NewMods extends FieldModifiers>(
    mods: NewMods,
  ): TimestampFieldBuilder<TS, NewMods> {
    return new TimestampFieldBuilder<TS, NewMods>(mods)
  }

  /**
   * Marks this field as optional (allows undefined / null).
   */
  optional(
    this: TimestampFieldBuilder<TS, Mods>,
  ): TimestampFieldBuilder<TS | undefined, Mods & { optional: true }> {
    const newMods = { ...this.modifiers, optional: true } as Mods & { optional: true }
    return new TimestampFieldBuilder<TS | undefined, Mods & { optional: true }>(newMods)
  }

  /**
   * Marks this field as the primary key of its table.
   */
  primary(
    this: TimestampFieldBuilder<TS, Mods>,
  ): TimestampFieldBuilder<TS, Mods & { primary: true }> {
    const newMods = { ...this.modifiers, primary: true } as Mods & { primary: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Adds a unique constraint to this field.
   */
  unique(
    this: TimestampFieldBuilder<TS, Mods>,
  ): TimestampFieldBuilder<TS, Mods & { unique: true }> {
    const newMods = { ...this.modifiers, unique: true } as Mods & { unique: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets a default value for this field.
   */
  default(
    this: TimestampFieldBuilder<TS, Mods>,
    value: TS | (() => TS),
  ): TimestampFieldBuilder<TS, Mods & { hasDefault: true }> {
    const newMods = { ...this.modifiers, hasDefault: true, defaultValue: value } as Mods & {
      hasDefault: true
    }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== JsonFieldBuilder ====================

class JsonFieldBuilder<
  T = unknown,
  TS = T,
  // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
  Mods extends FieldModifiers = {},
> extends BaseFieldBuilder<TS, Mods> {
  get zodBase(): ZodTypeAny {
    return this.applyModifiersToZod(z.unknown())
  }

  drizzleColumn(name: string): SQLiteColumnBuilderBase {
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle column builder chaining
    let col = text(name, { mode: 'json' }).$type<T>() as any

    if (!this.modifiers.optional) {
      col = col.notNull()
    }
    if (this.modifiers.primary) {
      col = col.primaryKey()
    }
    if (this.modifiers.unique) {
      col = col.unique()
    }
    if (this.modifiers.hasDefault) {
      const defaultValue = this.modifiers.defaultValue
      if (typeof defaultValue === 'function') {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.$defaultFn(defaultValue as any)
      } else {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle API
        col = col.default(defaultValue as any)
      }
    }

    return col as SQLiteColumnBuilderBase
  }

  protected cloneWithModifiers<NewMods extends FieldModifiers>(
    mods: NewMods,
  ): JsonFieldBuilder<T, TS, NewMods> {
    return new JsonFieldBuilder<T, TS, NewMods>(mods)
  }

  /**
   * Marks this field as optional (allows undefined / null).
   */
  optional(
    this: JsonFieldBuilder<T, TS, Mods>,
  ): JsonFieldBuilder<T, TS | undefined, Mods & { optional: true }> {
    const newMods = { ...this.modifiers, optional: true } as Mods & { optional: true }
    return new JsonFieldBuilder<T, TS | undefined, Mods & { optional: true }>(newMods)
  }

  /**
   * Marks this field as the primary key of its table.
   */
  primary(this: JsonFieldBuilder<T, TS, Mods>): JsonFieldBuilder<T, TS, Mods & { primary: true }> {
    const newMods = { ...this.modifiers, primary: true } as Mods & { primary: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Adds a unique constraint to this field.
   */
  unique(this: JsonFieldBuilder<T, TS, Mods>): JsonFieldBuilder<T, TS, Mods & { unique: true }> {
    const newMods = { ...this.modifiers, unique: true } as Mods & { unique: true }
    return this.cloneWithModifiers(newMods)
  }

  /**
   * Sets a default value for this field.
   */
  default(
    this: JsonFieldBuilder<T, TS, Mods>,
    value: TS | (() => TS),
  ): JsonFieldBuilder<T, TS, Mods & { hasDefault: true }> {
    const newMods = { ...this.modifiers, hasDefault: true, defaultValue: value } as Mods & {
      hasDefault: true
    }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== Factory ====================

/**
 * Field DSL factory for building type-safe database fields.
 *
 * @example
 * const nameField = t.string().min(1).max(255)
 * const emailField = t.string().email()
 * const idField = t.uuid().primary()
 * const ageField = t.integer().min(0).max(150)
 * const createdAtField = t.timestamp().default(() => new Date())
 * const dataField = t.json<{ foo: string }>()
 */
export const t = {
  string(): StringFieldBuilder<
    string,
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    {}
  > {
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    return new StringFieldBuilder<string, {}>()
  },

  uuid(): UuidFieldBuilder<
    string,
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    {}
  > {
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    return new UuidFieldBuilder<string, {}>()
  },

  number(): NumberFieldBuilder<
    number,
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    {}
  > {
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    return new NumberFieldBuilder<number, {}>()
  },

  integer(): IntegerFieldBuilder<
    number,
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    {}
  > {
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    return new IntegerFieldBuilder<number, {}>()
  },

  boolean(): BooleanFieldBuilder<
    boolean,
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    {}
  > {
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    return new BooleanFieldBuilder<boolean, {}>()
  },

  timestamp(): TimestampFieldBuilder<
    Date,
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    {}
  > {
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    return new TimestampFieldBuilder<Date, {}>()
  },

  json<T = unknown>(): JsonFieldBuilder<
    T,
    T,
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    {}
  > {
    // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
    return new JsonFieldBuilder<T, T, {}>()
  },
}
