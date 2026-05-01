import type { MiddlewareHandler } from 'hono'
import type { z } from 'zod'
import type { Field } from '../field/types'

export interface SchemaOptions<K extends string = string> {
  readonly pick?: readonly K[]
  readonly omit?: readonly K[]
  readonly partial?: boolean
}

/**
 * Extracts a Zod shape from fields for the Apply type.
 * Each field's zodBase becomes a property in the shape.
 */
export type FieldsToZodShape<
  Fields extends Record<
    string,
    // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
    Field<any, any>
  >,
> = {
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field type checking
  [K in keyof Fields]: Fields[K] extends Field<any, any> ? Fields[K]['zodBase'] : never
}

/**
 * Utility to narrow array literal types to union of strings.
 */
type ArrayKeys<A> = A extends readonly (infer U)[] ? U : never

/**
 * Apply pick transformation to a shape.
 */
type ApplyPickToShape<Shape extends z.ZodRawShape, PickKeys> = PickKeys extends readonly string[]
  ? Pick<Shape, ArrayKeys<PickKeys> & keyof Shape>
  : Shape

/**
 * Apply omit transformation to a shape.
 */
type ApplyOmitToShape<Shape extends z.ZodRawShape, OmitKeys> = OmitKeys extends readonly string[]
  ? Omit<Shape, ArrayKeys<OmitKeys> & keyof Shape>
  : Shape

/**
 * Apply partial transformation to a shape.
 */
type ApplyPartialToShape<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: z.ZodOptional<Shape[K]>
}

/**
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
 * Returns the correct Zod object type after applying pick/omit/partial transformations.
 */
export type Apply<
  Shape extends z.ZodRawShape,
  Opts extends SchemaOptions | undefined,
> = z.ZodObject<ApplyShape<Shape, Opts>>

/**
 * Represents a database model with type-safe schema derivation.
 */
// biome-ignore lint/suspicious/noExplicitAny: any is necessary for the generic Field constraint
export interface Model<Fields extends Record<string, Field<any, any>>> {
  readonly fields: Fields

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
    Target extends 'json' | 'query' | 'param' | 'header' | 'cookie' | 'form',
    Opts extends SchemaOptions<keyof Fields & string> | undefined = undefined,
  >(
    target: Target,
    opts?: Opts,
    // biome-ignore lint/suspicious/noExplicitAny: Hono context types are not available at this scope
  ): MiddlewareHandler<any, any, any>
}
