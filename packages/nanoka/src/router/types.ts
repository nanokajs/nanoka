import type { Hook } from '@hono/zod-validator'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { Hono, MiddlewareHandler } from 'hono'
import type { BlankEnv, Env } from 'hono/types'
import type { z } from 'zod'
import type { Adapter } from '../adapter/types'
import type { Field } from '../field/types'
import type {
  Apply,
  CreateInput,
  FieldsToZodShape,
  FindManyOptions,
  IdOrWhere,
  ModelValidatorReturn,
  PolicyOmitKeys,
  RowType,
  SchemaOptions,
  ValidatorInput,
} from '../model/types'
import type { OpenAPIModelComponent, OpenAPISchemaObject, OpenAPIUsage } from '../openapi/types'

/**
 * A model registered in a Nanoka application.
 * Wraps Model<Fields> with adapter binding, so CRUD methods do not require
 * passing the adapter each time.
 *
 * @template Fields - The field definitions of this model
 */
// biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field generic constraint
export interface NanokaModel<Fields extends Record<string, Field<any, any, any>>> {
  readonly fields: Fields
  readonly tableName: string
  readonly table: SQLiteTable

  /**
   * Returns a Zod schema derived from this model's fields.
   * Supports pick, omit, and partial transformations.
   */
  schema<Opts extends SchemaOptions<keyof Fields & string> | undefined = undefined>(
    opts?: Opts,
  ): Apply<FieldsToZodShape<Fields>, Opts>

  /**
   * Returns a Hono middleware validator for this model.
   * The optional `hook` argument is passed through to @hono/zod-validator.
   * Accepts a preset ('create' | 'update') as second argument to use inputSchema.
   */
  validator<
    Target extends keyof import('hono').ValidationTargets,
    E extends Env = Env,
    P extends string = string,
  >(
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
  validator<
    Target extends keyof import('hono').ValidationTargets,
    E extends Env = Env,
    P extends string = string,
  >(
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
    Target extends keyof import('hono').ValidationTargets,
    Opts extends SchemaOptions<keyof Fields & string> | undefined = undefined,
    E extends Env = Env,
    P extends string = string,
  >(
    target: Target,
    opts?: Opts,
    hook?: Hook<z.output<Apply<FieldsToZodShape<Fields>, Opts>>, E, P, Target>,
  ): ModelValidatorReturn<Fields, Target, Opts>

  /**
   * Returns a Zod schema for API input, with policy-based field exclusions applied.
   */
  inputSchema(
    usage: 'create' | 'update',
    opts?: SchemaOptions<keyof Fields & string>,
  ): z.ZodObject<z.ZodRawShape>

  /**
   * Returns a Zod schema for API output, with policy-based field exclusions applied.
   */
  outputSchema(opts?: SchemaOptions<keyof Fields & string>): z.ZodObject<z.ZodRawShape>

  /**
   * Parses a DB row through outputSchema and returns the safe response object.
   */
  toResponse(row: RowType<Fields>): unknown

  toOpenAPIComponent(): OpenAPIModelComponent

  toOpenAPISchema(usage: OpenAPIUsage): OpenAPISchemaObject

  /**
   * Fetches multiple rows with pagination and optional ordering.
   * `limit` is required (no default) to prevent accidental unbounded queries.
   */
  findMany(options: FindManyOptions<Fields>): Promise<RowType<Fields>[]>

  /**
   * Fetches a single row by primary key or where clause.
   * Returns null if not found.
   */
  findOne(idOrWhere: IdOrWhere<Fields>): Promise<RowType<Fields> | null>

  /**
   * Creates a new row and returns the created record.
   */
  create(data: CreateInput<Fields>): Promise<RowType<Fields>>

  /**
   * Updates rows matching the given id or where clause.
   * Returns the updated row, or null if no rows matched.
   */
  update(
    idOrWhere: IdOrWhere<Fields>,
    data: Partial<RowType<Fields>>,
  ): Promise<RowType<Fields> | null>

  /**
   * Deletes rows matching the given id or where clause.
   * Returns the number of deleted rows.
   */
  delete(idOrWhere: IdOrWhere<Fields>): Promise<{ readonly deleted: number }>
}

/**
 * Nanoka application: a Hono instance extended with model registration,
 * adapter binding, and escape hatches for raw Drizzle and batch operations.
 */
export interface Nanoka<E extends Env = BlankEnv> extends Hono<E> {
  /**
   * Raw Drizzle database instance (escape hatch per rule #4).
   * Exposes the full Drizzle API for advanced queries.
   */
  readonly db: Adapter['drizzle']

  /**
   * Batch execution API (transactions = D1 batch, per rule #7).
   * Executes multiple queries in a single D1 batch request.
   * No bespoke transaction abstraction is provided; batch is a first-class API.
   */
  batch: Adapter['batch']

  /**
   * Registers a new model in this application with adapter binding.
   * Returns a NanokaModel<Fields> with CRUD methods pre-bound to the adapter.
   *
   * @example
   * const app = nanoka(d1Adapter(env.DB))
   * const User = app.model('users', { id, name, email, passwordHash })
   * const users = await User.findMany({ limit: 20 })
   */
  model<Fields extends Record<string, Field<any, any, any>>>(
    name: string,
    fields: Fields,
  ): NanokaModel<Fields>
}
