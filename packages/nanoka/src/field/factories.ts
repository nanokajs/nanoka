import type { SQLiteColumnBuilderBase } from 'drizzle-orm/sqlite-core'
import { integer, real, text } from 'drizzle-orm/sqlite-core'
import type { z } from 'zod'
import { z as zLib } from 'zod'
import { BaseFieldBuilder } from './builder'
import type { FieldModifiers } from './types'

// ==================== StringFieldBuilder ====================

class StringFieldBuilder<
  TS = string,
  // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
  Mods extends FieldModifiers = {},
  ZB extends z.ZodTypeAny = z.ZodTypeAny,
> extends BaseFieldBuilder<TS, Mods, ZB> {
  readonly kind = 'string' as const

  get zodBase(): ZB {
    let schema: z.ZodTypeAny = zLib.string()

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

    // biome-ignore lint/suspicious/noExplicitAny: Return type cast for generic ZB parameter
    return this.applyModifiersToZod(schema) as any
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

  serverOnly(
    this: StringFieldBuilder<TS, Mods>,
  ): StringFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'serverOnly' }> {
    const newMods = { ...this.modifiers, policy: 'serverOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'serverOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  writeOnly(
    this: StringFieldBuilder<TS, Mods>,
  ): StringFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'writeOnly' }> {
    const newMods = { ...this.modifiers, policy: 'writeOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'writeOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  readOnly(
    this: StringFieldBuilder<TS, Mods>,
  ): StringFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'readOnly' }> {
    const newMods = { ...this.modifiers, policy: 'readOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'readOnly'
    }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== UuidFieldBuilder ====================

class UuidFieldBuilder<
  TS = string,
  // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
  Mods extends FieldModifiers = {},
  ZB extends z.ZodTypeAny = z.ZodTypeAny,
> extends BaseFieldBuilder<TS, Mods, ZB> {
  readonly kind = 'uuid' as const

  get zodBase(): ZB {
    let schema: z.ZodTypeAny = zLib.string().uuid()

    if (this.modifiers.min !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).min(this.modifiers.min)
    }
    if (this.modifiers.max !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).max(this.modifiers.max)
    }

    // biome-ignore lint/suspicious/noExplicitAny: Return type cast for generic ZB parameter
    return this.applyModifiersToZod(schema) as any
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
    if (
      this.modifiers.primary === true &&
      this.modifiers.policy === 'readOnly' &&
      !this.modifiers.hasDefault
    ) {
      col = col.$defaultFn(() => crypto.randomUUID())
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

  serverOnly(
    this: UuidFieldBuilder<TS, Mods>,
  ): UuidFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'serverOnly' }> {
    const newMods = { ...this.modifiers, policy: 'serverOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'serverOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  writeOnly(
    this: UuidFieldBuilder<TS, Mods>,
  ): UuidFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'writeOnly' }> {
    const newMods = { ...this.modifiers, policy: 'writeOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'writeOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  readOnly(
    this: UuidFieldBuilder<TS, Mods>,
  ): UuidFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'readOnly' }> {
    const newMods = { ...this.modifiers, policy: 'readOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'readOnly'
    }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== NumberFieldBuilder ====================

class NumberFieldBuilder<
  TS = number,
  // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
  Mods extends FieldModifiers = {},
  ZB extends z.ZodTypeAny = z.ZodTypeAny,
> extends BaseFieldBuilder<TS, Mods, ZB> {
  readonly kind = 'number' as const

  get zodBase(): ZB {
    let schema: z.ZodTypeAny = zLib.number()

    if (this.modifiers.min !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).min(this.modifiers.min)
    }
    if (this.modifiers.max !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).max(this.modifiers.max)
    }

    // biome-ignore lint/suspicious/noExplicitAny: Return type cast for generic ZB parameter
    return this.applyModifiersToZod(schema) as any
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

  serverOnly(
    this: NumberFieldBuilder<TS, Mods>,
  ): NumberFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'serverOnly' }> {
    const newMods = { ...this.modifiers, policy: 'serverOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'serverOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  writeOnly(
    this: NumberFieldBuilder<TS, Mods>,
  ): NumberFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'writeOnly' }> {
    const newMods = { ...this.modifiers, policy: 'writeOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'writeOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  readOnly(
    this: NumberFieldBuilder<TS, Mods>,
  ): NumberFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'readOnly' }> {
    const newMods = { ...this.modifiers, policy: 'readOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'readOnly'
    }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== IntegerFieldBuilder ====================

class IntegerFieldBuilder<
  TS = number,
  // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
  Mods extends FieldModifiers = {},
  ZB extends z.ZodTypeAny = z.ZodTypeAny,
> extends BaseFieldBuilder<TS, Mods, ZB> {
  readonly kind = 'integer' as const

  get zodBase(): ZB {
    let schema: z.ZodTypeAny = zLib.number().int()

    if (this.modifiers.min !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).min(this.modifiers.min)
    }
    if (this.modifiers.max !== undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: Chaining Zod methods
      schema = (schema as any).max(this.modifiers.max)
    }

    // biome-ignore lint/suspicious/noExplicitAny: Return type cast for generic ZB parameter
    return this.applyModifiersToZod(schema) as any
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

  serverOnly(
    this: IntegerFieldBuilder<TS, Mods>,
  ): IntegerFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'serverOnly' }> {
    const newMods = { ...this.modifiers, policy: 'serverOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'serverOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  writeOnly(
    this: IntegerFieldBuilder<TS, Mods>,
  ): IntegerFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'writeOnly' }> {
    const newMods = { ...this.modifiers, policy: 'writeOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'writeOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  readOnly(
    this: IntegerFieldBuilder<TS, Mods>,
  ): IntegerFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'readOnly' }> {
    const newMods = { ...this.modifiers, policy: 'readOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'readOnly'
    }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== BooleanFieldBuilder ====================

class BooleanFieldBuilder<
  TS = boolean,
  // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
  Mods extends FieldModifiers = {},
  ZB extends z.ZodTypeAny = z.ZodTypeAny,
> extends BaseFieldBuilder<TS, Mods, ZB> {
  readonly kind = 'boolean' as const

  get zodBase(): ZB {
    return this.applyModifiersToZod(zLib.boolean()) as ZB
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

  serverOnly(
    this: BooleanFieldBuilder<TS, Mods>,
  ): BooleanFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'serverOnly' }> {
    const newMods = { ...this.modifiers, policy: 'serverOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'serverOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  writeOnly(
    this: BooleanFieldBuilder<TS, Mods>,
  ): BooleanFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'writeOnly' }> {
    const newMods = { ...this.modifiers, policy: 'writeOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'writeOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  readOnly(
    this: BooleanFieldBuilder<TS, Mods>,
  ): BooleanFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'readOnly' }> {
    const newMods = { ...this.modifiers, policy: 'readOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'readOnly'
    }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== TimestampFieldBuilder ====================

class TimestampFieldBuilder<
  TS = Date,
  // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
  Mods extends FieldModifiers = {},
  ZB extends z.ZodTypeAny = z.ZodTypeAny,
> extends BaseFieldBuilder<TS, Mods, ZB> {
  readonly kind = 'timestamp' as const

  get zodBase(): ZB {
    return this.applyModifiersToZod(zLib.coerce.date()) as ZB
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

  serverOnly(
    this: TimestampFieldBuilder<TS, Mods>,
  ): TimestampFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'serverOnly' }> {
    const newMods = { ...this.modifiers, policy: 'serverOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'serverOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  writeOnly(
    this: TimestampFieldBuilder<TS, Mods>,
  ): TimestampFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'writeOnly' }> {
    const newMods = { ...this.modifiers, policy: 'writeOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'writeOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  readOnly(
    this: TimestampFieldBuilder<TS, Mods>,
  ): TimestampFieldBuilder<TS, Omit<Mods, 'policy'> & { policy: 'readOnly' }> {
    const newMods = { ...this.modifiers, policy: 'readOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'readOnly'
    }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== JsonFieldBuilder ====================

/**
 * JSON フィールドビルダー。
 *
 * `t.json(zodSchema)` 形式で Zod スキーマを渡すと runtime 検証が走る。
 * スキーマ省略時は `z.unknown()` で後方互換を維持する。
 */
class JsonFieldBuilder<
  T = unknown,
  TS = T,
  // biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
  Mods extends FieldModifiers = {},
  ZB extends z.ZodTypeAny = z.ZodTypeAny,
> extends BaseFieldBuilder<TS, Mods, ZB> {
  readonly kind = 'json' as const
  private readonly _zodSchema: z.ZodTypeAny | undefined

  constructor(modifiers?: Mods, zodSchema?: z.ZodTypeAny) {
    super(modifiers)
    this._zodSchema = zodSchema
  }

  get zodBase(): ZB {
    return this.applyModifiersToZod(this._zodSchema ?? zLib.unknown()) as ZB
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
    return new JsonFieldBuilder<T, TS, NewMods>(mods, this._zodSchema)
  }

  /**
   * Marks this field as optional (allows undefined / null).
   */
  optional(
    this: JsonFieldBuilder<T, TS, Mods>,
  ): JsonFieldBuilder<T, TS | undefined, Mods & { optional: true }> {
    const newMods = { ...this.modifiers, optional: true } as Mods & { optional: true }
    return new JsonFieldBuilder<T, TS | undefined, Mods & { optional: true }>(
      newMods,
      this._zodSchema,
    )
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

  serverOnly(
    this: JsonFieldBuilder<T, TS, Mods>,
  ): JsonFieldBuilder<T, TS, Omit<Mods, 'policy'> & { policy: 'serverOnly' }> {
    const newMods = { ...this.modifiers, policy: 'serverOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'serverOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  writeOnly(
    this: JsonFieldBuilder<T, TS, Mods>,
  ): JsonFieldBuilder<T, TS, Omit<Mods, 'policy'> & { policy: 'writeOnly' }> {
    const newMods = { ...this.modifiers, policy: 'writeOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'writeOnly'
    }
    return this.cloneWithModifiers(newMods)
  }

  readOnly(
    this: JsonFieldBuilder<T, TS, Mods>,
  ): JsonFieldBuilder<T, TS, Omit<Mods, 'policy'> & { policy: 'readOnly' }> {
    const newMods = { ...this.modifiers, policy: 'readOnly' as const } as Omit<Mods, 'policy'> & {
      policy: 'readOnly'
    }
    return this.cloneWithModifiers(newMods)
  }
}

// ==================== Factory ====================

// biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
function jsonField<S extends z.ZodTypeAny>(schema: S): JsonFieldBuilder<z.infer<S>, z.infer<S>, {}>
// biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
function jsonField<T = unknown>(): JsonFieldBuilder<T, T, {}>
// biome-ignore lint/complexity/noBannedTypes: {} is used intentionally for the default empty modifiers
function jsonField<T = unknown>(schema?: z.ZodTypeAny): JsonFieldBuilder<T, T, {}> {
  return new JsonFieldBuilder<T, T, {}>(undefined, schema)
}

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
 * const dataField2 = t.json(z.object({ foo: z.string() }))  // runtime validation
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

  /**
   * JSON フィールド。
   *
   * `t.json(zodSchema)` 形式で Zod スキーマを渡すと runtime 検証が走る。
   * スキーマ省略時は `z.unknown()` で後方互換を維持する。
   *
   * `t.json(z.object({ foo: z.string() }))` でオブジェクト形状の runtime 検証が可能。
   *
   * @note codegen (`nanoka generate`) は `t.json(zodSchema)` を渡しても `$type<unknown>()` のまま出力する。
   * Drizzle 型が欲しい場合は生成後に手動で書き換えるか `as` を使うこと。
   */
  json: jsonField,
}
