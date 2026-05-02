import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { MiddlewareHandler, ValidationTargets } from 'hono'
import type { z } from 'zod'
import type { Adapter } from '../adapter/types'
import type { Field, InferFieldType } from '../field/types'

/**
 * Options for findMany query.
 * `limit` is required (no default).
 * `offset` defaults to 0 if omitted.
 * `orderBy` is optional for column ordering.
 */
export interface FindManyOptions<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
> {
  readonly limit: number
  readonly offset?: number
  readonly orderBy?: OrderBy<Fields>
}

/**
 * Order-by specification: single field, or field with direction, or array of multiple.
 */
export type OrderBy<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
> =
  | (keyof Fields & string)
  | { readonly column: keyof Fields & string; readonly direction?: 'asc' | 'desc' }
  | ReadonlyArray<
      | (keyof Fields & string)
      | { readonly column: keyof Fields & string; readonly direction?: 'asc' | 'desc' }
    >

/**
 * Where clause object: each key is a field name, each value is the desired equality.
 */
export type Where<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
> = {
  readonly [K in keyof Fields]?: InferFieldType<Fields[K]>
}

/**
 * Identifier or Where clause: can be a primary key value or a Where object.
 */
export type IdOrWhere<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
> = string | number | Where<Fields>

/**
 * Row type: full record type from fields.
 */
export type RowType<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
> = {
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  [K in keyof Fields]: InferFieldType<Fields[K]>
}

/**
 * Create input: partial row (most fields optional for insert).
 * Phase 1 では `Partial<RowType>` のままとし、必須/任意フィールドの型区別は Phase 2 で扱う。
 */
export type CreateInput<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
> = Partial<RowType<Fields>>

export interface SchemaOptions<K extends string = string> {
  readonly pick?: readonly K[]
  readonly omit?: readonly K[]
  readonly partial?: boolean
}

const validationTargets = {
  json: true,
  query: true,
  param: true,
  header: true,
  cookie: true,
  form: true,
} as const

/**
 * @internal
 * Extracts a Zod shape from fields for the Apply type.
 * Each field's zodBase becomes a property in the shape.
 * Indexed access ensures concrete Zod types are preserved (not `any`).
 */
export type FieldsToZodShape<
  Fields extends Record<
    string,
    // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
    Field<any, any, any>
  >,
> = {
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field type checking
  [K in keyof Fields]: Fields[K]['zodBase']
}

/**
 * @internal
 * Utility to narrow array literal types to union of strings.
 */
type ArrayKeys<A> = A extends readonly (infer U)[] ? U : never

/**
 * @internal
 * Apply pick transformation to a shape.
 */
type ApplyPickToShape<Shape extends z.ZodRawShape, PickKeys> = PickKeys extends readonly string[]
  ? Pick<Shape, ArrayKeys<PickKeys> & keyof Shape>
  : Shape

/**
 * @internal
 * Apply omit transformation to a shape.
 */
type ApplyOmitToShape<Shape extends z.ZodRawShape, OmitKeys> = OmitKeys extends readonly string[]
  ? Omit<Shape, ArrayKeys<OmitKeys> & keyof Shape>
  : Shape

/**
 * @internal
 * Apply partial transformation to a shape.
 */
type ApplyPartialToShape<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: z.ZodOptional<Shape[K]>
}

/**
 * @internal
 * Apply pick/omit/partial transformations to a Zod raw shape.
 * Order: pick → omit → partial
 */
type ApplyShape<
  Shape extends z.ZodRawShape,
  Opts extends SchemaOptions | undefined,
> = Opts extends undefined
  ? Shape
  : Opts extends { pick: readonly string[] }
    ? Opts extends { omit: readonly string[] }
      ? Opts extends { partial: true }
        ? ApplyPartialToShape<ApplyOmitToShape<ApplyPickToShape<Shape, Opts['pick']>, Opts['omit']>>
        : ApplyOmitToShape<ApplyPickToShape<Shape, Opts['pick']>, Opts['omit']>
      : Opts extends { partial: true }
        ? ApplyPartialToShape<ApplyPickToShape<Shape, Opts['pick']>>
        : ApplyPickToShape<Shape, Opts['pick']>
    : Opts extends { omit: readonly string[] }
      ? Opts extends { partial: true }
        ? ApplyPartialToShape<ApplyOmitToShape<Shape, Opts['omit']>>
        : ApplyOmitToShape<Shape, Opts['omit']>
      : Opts extends { partial: true }
        ? ApplyPartialToShape<Shape>
        : Shape

/**
 * @internal
 * Returns the correct Zod object type after applying pick/omit/partial transformations.
 */
export type Apply<
  Shape extends z.ZodRawShape,
  Opts extends SchemaOptions | undefined,
> = z.ZodObject<ApplyShape<Shape, Opts>>

/**
 * @internal
 * Mirrors @hono/zod-validator's middleware Input type.
 * Aligned with @hono/zod-validator@0.4.x; revisit on version bump.
 */
type HasUndefined<T> = undefined extends T ? true : false

export type ValidatorInput<
  Target extends keyof ValidationTargets,
  Schema extends z.ZodType<any, z.ZodTypeDef, any>,
  In = z.input<Schema>,
  Out = z.output<Schema>,
> = {
  in: HasUndefined<In> extends true
    ? {
        [K in Target]?:
          | (In extends ValidationTargets[K]
              ? In
              : { [K2 in keyof In]?: ValidationTargets[K][K2] | undefined })
          | undefined
      }
    : {
        [K in Target]: In extends ValidationTargets[K]
          ? In
          : { [K2 in keyof In]: ValidationTargets[K][K2] }
      }
  out: { [K in Target]: Out }
}

/**
 * @internal
 * Type-safe Hono middleware handler return for Model.validator().
 * Provides proper type narrowing for c.req.valid(target).
 */
export type ModelValidatorReturn<
  Fields extends Record<string, Field<any, any, any>>,
  Target extends keyof ValidationTargets,
  Opts extends SchemaOptions<keyof Fields & string> | undefined,
> = MiddlewareHandler<any, string, ValidatorInput<Target, Apply<FieldsToZodShape<Fields>, Opts>>>

/**
 * Represents a database model with type-safe schema derivation and CRUD operations.
 */
// biome-ignore lint/suspicious/noExplicitAny: any is necessary for the generic Field constraint
export interface Model<Fields extends Record<string, Field<any, any, any>>> {
  readonly fields: Fields
  readonly tableName: string
  readonly table: SQLiteTable

  /**
   * Returns a Zod schema derived from this model's fields.
   * Supports pick, omit, and partial transformations.
   *
   * @example
   * const CreateSchema = User.schema({ omit: ['passwordHash'] })
   * const UpdateSchema = User.schema({ partial: true, pick: ['name', 'email'] })
   */
  schema<Opts extends SchemaOptions<keyof Fields & string> | undefined = undefined>(
    opts?: Opts,
  ): Apply<FieldsToZodShape<Fields>, Opts>

  /**
   * Returns a Hono middleware validator derived from this model's schema.
   * Integrates with @hono/zod-validator to validate request inputs.
   *
   * @example
   * app.post('/users', User.validator('json', { omit: ['passwordHash'] }), c => {
   *   const body = c.req.valid('json')
   * })
   */
  validator<
    Target extends keyof ValidationTargets,
    Opts extends SchemaOptions<keyof Fields & string> | undefined = undefined,
  >(target: Target, opts?: Opts): ModelValidatorReturn<Fields, Target, Opts>

  /**
   * Fetches multiple rows with pagination and optional ordering.
   * `limit` is required (no default) to prevent accidental unbounded queries.
   * Offset defaults to 0 if omitted.
   *
   * @example
   * const users = await User.findMany(adapter, { limit: 20 })
   * const page2 = await User.findMany(adapter, { limit: 20, offset: 20 })
   * const sorted = await User.findMany(adapter, { limit: 10, orderBy: 'name' })
   */
  findMany(adapter: Adapter, options: FindManyOptions<Fields>): Promise<RowType<Fields>[]>

  /**
   * Fetches a single row by primary key or where clause.
   * Returns null if not found.
   *
   * @example
   * const user = await User.findOne(adapter, id)
   * const byEmail = await User.findOne(adapter, { email: 'john@example.com' })
   */
  findOne(adapter: Adapter, idOrWhere: IdOrWhere<Fields>): Promise<RowType<Fields> | null>

  /**
   * Creates a new row and returns the created record.
   *
   * @example
   * const user = await User.create(adapter, { name: 'John', email: 'john@example.com' })
   */
  create(adapter: Adapter, data: CreateInput<Fields>): Promise<RowType<Fields>>

  /**
   * Updates rows matching the given id or where clause.
   * Returns the updated row(s), or null if no rows matched.
   *
   * @example
   * const updated = await User.update(adapter, id, { name: 'Jane' })
   * const byEmail = await User.update(adapter, { email: '...' }, { name: 'Jane' })
   */
  update(
    adapter: Adapter,
    idOrWhere: IdOrWhere<Fields>,
    data: Partial<RowType<Fields>>,
  ): Promise<RowType<Fields> | null>

  /**
   * Deletes rows matching the given id or where clause.
   * Returns the number of deleted rows.
   *
   * @example
   * const result = await User.delete(adapter, id)
   * console.log(result.deleted) // number
   */
  delete(adapter: Adapter, idOrWhere: IdOrWhere<Fields>): Promise<{ readonly deleted: number }>
}
