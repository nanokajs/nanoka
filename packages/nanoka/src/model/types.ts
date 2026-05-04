import type { Hook } from '@hono/zod-validator'
import type { SQL } from 'drizzle-orm'
import type { AnySQLiteColumn, SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import type { Env, MiddlewareHandler, ValidationTargets } from 'hono'
import type { z } from 'zod'
import type { Adapter } from '../adapter/types'
import type { Field, FieldPolicy, InferFieldType } from '../field/types'
import type { OpenAPIModelComponent, OpenAPISchemaObject, OpenAPIUsage } from '../openapi/types'

/**
 * Options for findMany query.
 * `limit` is required (no default).
 * `offset` defaults to 0 if omitted.
 * `orderBy` is optional for column ordering.
 * `where` accepts either an equality object or a Drizzle SQL expression.
 */
export interface FindManyOptions<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
> {
  readonly limit: number
  readonly offset?: number
  readonly orderBy?: OrderBy<Fields>
  readonly where?: Where<Fields> | SQL
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
  [K in keyof Fields]: InferFieldType<Fields[K]>
}

/**
 * Drizzle table type with columns typed to match the model's Fields.
 * Allows type-safe column access via Model.table.fieldName.
 */
// biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
export type ModelTable<Fields extends Record<string, Field<any, any, any>>> =
  SQLiteTableWithColumns<{
    name: string
    schema: undefined
    columns: { [K in keyof Fields]: AnySQLiteColumn }
    dialect: 'sqlite'
  }>

/**
 * @internal
 * Extracts the policy from a Field's modifiers.
 *
 * Uses `Field<any, { policy: infer P }, any>` rather than a two-step
 * `infer M` + `M extends { policy: infer P }` pattern.
 * The two-step pattern is broken when TypeScript widens `M` to the constraint
 * `FieldModifiers` (which has `policy?: FieldPolicy` as optional), causing
 * `M extends { policy: infer P }` to be true for ALL fields regardless of their
 * actual policy value. Directly matching `{ policy: infer P }` avoids this.
 */
type PolicyOf<F> =
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  F extends Field<any, { policy: infer P extends FieldPolicy }, any> ? P : never

/**
 * @internal
 * Computes which field keys should be omitted based on policy and usage.
 * Mirrors the runtime logic in derivePolicyOptions() in schema.ts.
 *
 * NOTE: `[PolicyOf<Fields[K]>] extends [never]` (non-distributive form) is used to
 * short-circuit fields with no policy to `never` (do not omit). Without this guard,
 * `never extends 'serverOnly'` evaluates to `true` (vacuously), causing every field
 * without a policy to be incorrectly included in the omit set.
 */
export type PolicyOmitKeys<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
  Usage extends 'input-create' | 'input-update' | 'output',
> = {
  [K in keyof Fields]: [PolicyOf<Fields[K]>] extends [never]
    ? never
    : PolicyOf<Fields[K]> extends 'serverOnly'
      ? K
      : Usage extends 'output'
        ? PolicyOf<Fields[K]> extends 'writeOnly'
          ? K
          : never
        : Usage extends 'input-create' | 'input-update'
          ? PolicyOf<Fields[K]> extends 'readOnly'
            ? K
            : never
          : never
}[keyof Fields]

/**
 * @internal
 * Computes which field keys have the serverOnly policy.
 * serverOnly fields are completely excluded from CreateInput
 * (cannot be passed even from library internals — they are server-side only).
 *
 * Uses `[PolicyOf<Fields[K]>] extends [never]` (non-distributive form) to short-circuit
 * fields with no policy to `never`. Without this guard, `never extends 'serverOnly'`
 * evaluates to `true` (vacuously), causing every field without a policy to be included.
 */
type ServerOnlyKeys<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
> = {
  [K in keyof Fields]: [PolicyOf<Fields[K]>] extends [never]
    ? never
    : PolicyOf<Fields[K]> extends 'serverOnly'
      ? K
      : never
}[keyof Fields]

/**
 * @internal
 * Determines if a field is required for create input.
 * A field is optional if it has a default, is optional, or is readOnly.
 *
 * Uses direct shape matching (`Field<any, { hasDefault: true }, any>`) to avoid
 * the TypeScript infer-widening issue where `infer M` resolves to `FieldModifiers`
 * (the constraint bound) instead of the concrete Mods type, causing `M extends
 * { policy: 'readOnly' }` to be false even for readOnly fields.
 */
// biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
type IsRequired<F extends Field<any, any, any>> =
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  F extends Field<any, { hasDefault: true }, any>
    ? false
    : // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
      F extends Field<any, { optional: true }, any>
      ? false
      : // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
        F extends Field<any, { policy: 'readOnly' }, any>
        ? false
        : true

/**
 * Create input with precise types:
 * - `readOnly` fields are optional (library internals can pass them; API callers
 *   are excluded via inputSchema — but CreateInput itself keeps them as optional
 *   so handlers can supply generated values like `id` or `createdAt`)
 * - fields with `default` are optional
 * - fields marked `optional` are optional
 * - all other fields are required
 * - `serverOnly` fields are completely excluded (cannot be passed even internally)
 * - `writeOnly` fields are included as required (they are input fields by design)
 */
export type CreateInput<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
> = {
  [K in keyof Fields as IsRequired<Fields[K]> extends true
    ? K extends ServerOnlyKeys<Fields>
      ? never
      : K
    : never]: InferFieldType<Fields[K]>
} & {
  [K in keyof Fields as IsRequired<Fields[K]> extends true
    ? never
    : K extends ServerOnlyKeys<Fields>
      ? never
      : K]?: InferFieldType<Fields[K]>
}

export type FieldAccessor<K extends string> = { readonly [Key in K]: Key }

export interface SchemaOptions<K extends string = string> {
  readonly pick?: readonly K[] | ((f: FieldAccessor<K>) => readonly K[])
  readonly omit?: readonly K[] | ((f: FieldAccessor<K>) => readonly K[])
  readonly partial?: boolean
}

/**
 * @internal
 * Resolves pick/omit option to string array using the accessor when it's a function.
 */
export function resolveSchemaOptionKeys<K extends string>(
  opt: readonly K[] | ((f: FieldAccessor<K>) => readonly K[]) | undefined,
  accessor: FieldAccessor<K>,
): readonly K[] | undefined {
  if (opt === undefined) return undefined
  if (typeof opt === 'function') return opt(accessor)
  return opt
}

/**
 * @internal
 * Builds a frozen field accessor object for use in schema/validator options.
 * Each key maps to itself, providing typo detection at type level.
 */
export function buildFieldAccessor<Fields extends Record<string, unknown>>(
  fields: Fields,
): { readonly [K in keyof Fields]: K } {
  const acc: Record<string, string> = {}
  for (const k of Object.keys(fields)) acc[k] = k
  return Object.freeze(acc) as { readonly [K in keyof Fields]: K }
}

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
  [K in keyof Fields]: Fields[K]['zodBase']
}

/**
 * @internal
 * Utility to narrow array literal types to union of strings.
 */
type ArrayKeys<A> = A extends readonly (infer U)[] ? U : never

/**
 * @internal
 * Resolves pick/omit option type to the array type.
 * Handles both array form and accessor function form.
 */
type ResolveOptKeys<Opt> = Opt extends readonly string[]
  ? Opt
  : Opt extends (f: FieldAccessor<infer _K>) => readonly (infer R)[]
    ? readonly R[]
    : never

/**
 * @internal
 * Apply pick transformation to a shape.
 */
type ApplyPickToShape<Shape extends z.ZodRawShape, PickOpt> =
  ResolveOptKeys<PickOpt> extends readonly string[]
    ? Pick<Shape, ArrayKeys<ResolveOptKeys<PickOpt>> & keyof Shape>
    : Shape

/**
 * @internal
 * Apply omit transformation to a shape.
 */
type ApplyOmitToShape<Shape extends z.ZodRawShape, OmitOpt> =
  ResolveOptKeys<OmitOpt> extends readonly string[]
    ? Omit<Shape, ArrayKeys<ResolveOptKeys<OmitOpt>> & keyof Shape>
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
 * Checks if an option value (array or function) is present (i.e. not undefined and not never).
 * Uses distributive conditional to handle union types like `T | undefined`.
 */
type HasOpt<Opt> = undefined extends Opt ? false : [Opt] extends [never] ? false : true

/**
 * @internal
 * Apply pick/omit/partial transformations to a Zod raw shape.
 * Order: pick → omit → partial
 * Handles both array form and accessor function form for pick/omit.
 */
type ApplyShape<
  Shape extends z.ZodRawShape,
  Opts extends SchemaOptions | undefined,
> = Opts extends SchemaOptions
  ? HasOpt<Opts['pick']> extends true
    ? HasOpt<Opts['omit']> extends true
      ? Opts extends { partial: true }
        ? ApplyPartialToShape<ApplyOmitToShape<ApplyPickToShape<Shape, Opts['pick']>, Opts['omit']>>
        : ApplyOmitToShape<ApplyPickToShape<Shape, Opts['pick']>, Opts['omit']>
      : Opts extends { partial: true }
        ? ApplyPartialToShape<ApplyPickToShape<Shape, Opts['pick']>>
        : ApplyPickToShape<Shape, Opts['pick']>
    : HasOpt<Opts['omit']> extends true
      ? Opts extends { partial: true }
        ? ApplyPartialToShape<ApplyOmitToShape<Shape, Opts['omit']>>
        : ApplyOmitToShape<Shape, Opts['omit']>
      : Opts extends { partial: true }
        ? ApplyPartialToShape<Shape>
        : Shape
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
 * Apply pick transformation to a TS record type.
 */
type ApplyPickToRecord<R, PickOpt> =
  ResolveOptKeys<PickOpt> extends readonly string[]
    ? Pick<R, ArrayKeys<ResolveOptKeys<PickOpt>> & keyof R>
    : R

/**
 * @internal
 * Apply omit transformation to a TS record type.
 */
type ApplyOmitToRecord<R, OmitOpt> =
  ResolveOptKeys<OmitOpt> extends readonly string[]
    ? Omit<R, ArrayKeys<ResolveOptKeys<OmitOpt>> & keyof R>
    : R

/**
 * @internal
 * Apply pick/omit/partial transformations to a TypeScript record type.
 * Mirrors ApplyShape but operates on TS types directly, not Zod shapes.
 * Used for Zod v3/v4 compatible middleware input/output type computation.
 */
type ApplyToRecord<R, Opts extends SchemaOptions | undefined> = Opts extends SchemaOptions
  ? HasOpt<Opts['pick']> extends true
    ? HasOpt<Opts['omit']> extends true
      ? Opts extends { partial: true }
        ? Partial<ApplyOmitToRecord<ApplyPickToRecord<R, Opts['pick']>, Opts['omit']>>
        : ApplyOmitToRecord<ApplyPickToRecord<R, Opts['pick']>, Opts['omit']>
      : Opts extends { partial: true }
        ? Partial<ApplyPickToRecord<R, Opts['pick']>>
        : ApplyPickToRecord<R, Opts['pick']>
    : HasOpt<Opts['omit']> extends true
      ? Opts extends { partial: true }
        ? Partial<ApplyOmitToRecord<R, Opts['omit']>>
        : ApplyOmitToRecord<R, Opts['omit']>
      : Opts extends { partial: true }
        ? Partial<R>
        : R
  : R

/**
 * @internal
 * Mirrors @hono/zod-validator's middleware Input type.
 * Aligned with @hono/zod-validator@0.4.x; revisit on version bump.
 */
type HasUndefined<T> = undefined extends T ? true : false

/**
 * @internal
 * Hono middleware input/output type for validator middleware.
 * Aligned with @hono/zod-validator@0.4.x; revisit on version bump.
 *
 * WARNING (Zod 4): `z.input<ZodTypeAny>` resolves to `unknown` in Zod 4, making
 * `c.req.valid(target)` return `unknown` if `In`/`Out` are left as defaults.
 * When using this type directly (outside of `ModelValidatorReturn`), always pass
 * explicit `In` and `Out` type arguments — do NOT rely on the defaults.
 *
 * Internal usages in this file (ModelValidatorReturn and preset overloads) already
 * pass `In`/`Out` explicitly via `ApplyToRecord` or `Omit<RowType<Fields>, ...>`.
 */
export type ValidatorInput<
  Target extends keyof ValidationTargets,
  Schema extends z.ZodTypeAny,
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
 *
 * Uses RowType<Fields> directly for input/output type computation
 * to ensure Zod v3/v4 compatibility (z.input<ZodTypeAny> returns unknown in Zod v4).
 */
export type ModelValidatorReturn<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
  Target extends keyof ValidationTargets,
  Opts extends SchemaOptions<keyof Fields & string> | undefined,
> = MiddlewareHandler<
  any,
  string,
  ValidatorInput<
    Target,
    Apply<FieldsToZodShape<Fields>, Opts>,
    ApplyToRecord<RowType<Fields>, Opts>,
    ApplyToRecord<RowType<Fields>, Opts>
  >
>

/**
 * Hook type for Model.validator() third argument.
 * Re-exported from @hono/zod-validator for convenience.
 */
export type { Hook }

/**
 * Represents a database model with type-safe schema derivation and CRUD operations.
 */
// biome-ignore lint/suspicious/noExplicitAny: any is necessary for the generic Field constraint
export interface Model<Fields extends Record<string, Field<any, any, any>>> {
  readonly fields: Fields
  readonly tableName: string
  readonly table: ModelTable<Fields>

  /**
   * Returns a Zod schema derived from this model's fields.
   * Supports pick, omit, and partial transformations.
   *
   * @example
   * const CreateSchema = User.schema({ omit: ['passwordHash'] })
   * const UpdateSchema = User.schema({ partial: true, pick: ['name', 'email'] })
   */
  schema<Opts extends SchemaOptions<keyof Fields & string> | undefined>(
    opts?: Opts,
  ): Apply<FieldsToZodShape<Fields>, Opts>

  /**
   * Returns a Hono middleware validator derived from this model's schema.
   * Integrates with @hono/zod-validator to validate request inputs.
   * The optional `hook` argument is passed through to @hono/zod-validator.
   *
   * Accepts a preset ('create' | 'update') as second argument to use inputSchema.
   * When a preset is used, the return type is a MiddlewareHandler (loosely typed in Phase 2A).
   * Precise type narrowing for preset is deferred to Phase 2B M2.3.
   *
   * @example
   * app.post('/users', User.validator('json', 'create'), c => {
   *   const body = c.req.valid('json')
   * })
   * app.post('/users', User.validator('json', { omit: ['passwordHash'] }), c => {
   *   const body = c.req.valid('json')
   * })
   * // With hook:
   * app.post('/users', User.validator('json', opts, (result, c) => {
   *   if (!result.success) return c.json({ error: 'Invalid request' }, 400)
   * }), handler)
   */
  validator<Target extends keyof ValidationTargets, E extends Env = Env, P extends string = string>(
    target: Target,
    preset: 'create',
    hook?: Hook<
      Omit<RowType<Fields>, PolicyOmitKeys<Fields, 'input-create'> & string>,
      E,
      P,
      Target
    >,
  ): MiddlewareHandler<
    E,
    P,
    ValidatorInput<
      Target,
      z.ZodObject<z.ZodRawShape>,
      Omit<RowType<Fields>, PolicyOmitKeys<Fields, 'input-create'> & string>,
      Omit<RowType<Fields>, PolicyOmitKeys<Fields, 'input-create'> & string>
    >
  >
  validator<Target extends keyof ValidationTargets, E extends Env = Env, P extends string = string>(
    target: Target,
    preset: 'update',
    hook?: Hook<
      Partial<Omit<RowType<Fields>, PolicyOmitKeys<Fields, 'input-update'> & string>>,
      E,
      P,
      Target
    >,
  ): MiddlewareHandler<
    E,
    P,
    ValidatorInput<
      Target,
      z.ZodObject<z.ZodRawShape>,
      Partial<Omit<RowType<Fields>, PolicyOmitKeys<Fields, 'input-update'> & string>>,
      Partial<Omit<RowType<Fields>, PolicyOmitKeys<Fields, 'input-update'> & string>>
    >
  >
  validator<
    Target extends keyof ValidationTargets,
    Opts extends SchemaOptions<keyof Fields & string> | undefined,
    E extends Env = Env,
    P extends string = string,
  >(
    target: Target,
    opts?: Opts,
    hook?: Hook<z.output<Apply<FieldsToZodShape<Fields>, Opts>>, E, P, Target>,
  ): ModelValidatorReturn<Fields, Target, Opts>

  /**
   * Returns a Zod schema for API input, with policy-based field exclusions applied.
   * - 'create': serverOnly and readOnly fields are excluded
   * - 'update': same exclusions + all fields become optional (partial: true)
   *
   * The return type precisely reflects policy-derived omissions using PolicyOmitKeys.
   */
  inputSchema<Opts extends SchemaOptions<keyof Fields & string> | undefined = undefined>(
    usage: 'create',
    opts?: Opts,
  ): z.ZodObject<
    ApplyShape<
      Omit<FieldsToZodShape<Fields>, PolicyOmitKeys<Fields, 'input-create'> & string>,
      Opts
    >
  >
  inputSchema<Opts extends SchemaOptions<keyof Fields & string> | undefined = undefined>(
    usage: 'update',
    opts?: Opts,
  ): z.ZodObject<
    ApplyShape<
      Omit<FieldsToZodShape<Fields>, PolicyOmitKeys<Fields, 'input-update'> & string>,
      Opts extends undefined ? { partial: true } : Opts & { partial: true }
    >
  >
  inputSchema(
    usage: 'create' | 'update',
    opts?: SchemaOptions<keyof Fields & string>,
  ): z.ZodObject<z.ZodRawShape>

  /**
   * Returns a Zod schema for API output, with policy-based field exclusions applied.
   * - serverOnly and writeOnly fields are excluded
   * - readOnly fields remain present
   *
   * The return type precisely reflects policy-derived omissions using PolicyOmitKeys.
   */
  outputSchema<Opts extends SchemaOptions<keyof Fields & string> | undefined = undefined>(
    opts?: Opts,
  ): z.ZodObject<
    ApplyShape<Omit<FieldsToZodShape<Fields>, PolicyOmitKeys<Fields, 'output'> & string>, Opts>
  >

  /**
   * Parses a DB row through outputSchema and returns the safe response object.
   * Equivalent to `User.outputSchema().parse(row)`.
   */
  toResponse(row: RowType<Fields>): unknown

  /**
   * Parses an array of DB rows through outputSchema and returns safe response objects.
   * The outputSchema is built once and reused for all rows.
   * Equivalent to mapping `toResponse` over the array but more efficient.
   *
   * @example
   * const rows = await app.db.select().from(User.table).where(...)
   * return c.json(User.toResponseMany(rows))
   */
  toResponseMany(rows: readonly RowType<Fields>[]): unknown[]

  toOpenAPIComponent(): OpenAPIModelComponent

  toOpenAPISchema(usage: OpenAPIUsage): OpenAPISchemaObject

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
