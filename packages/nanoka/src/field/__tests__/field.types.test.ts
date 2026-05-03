import { describe, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import { t } from '../factories'
import type { Field, InferFieldType } from '../types'

describe('Field: type inference', () => {
  describe('precise tsType inference', () => {
    it('t.string() infers tsType as string', () => {
      expectTypeOf(t.string().tsType).toEqualTypeOf<string>()
    })

    it('t.string().optional() infers tsType as string | undefined', () => {
      expectTypeOf(t.string().optional().tsType).toEqualTypeOf<string | undefined>()
    })

    it('t.uuid().primary() infers tsType as string', () => {
      expectTypeOf(t.uuid().primary().tsType).toEqualTypeOf<string>()
    })

    it('t.integer().min(0).max(10) infers tsType as number', () => {
      expectTypeOf(t.integer().min(0).max(10).tsType).toEqualTypeOf<number>()
    })

    it('t.integer().optional() infers tsType as number | undefined', () => {
      expectTypeOf(t.integer().optional().tsType).toEqualTypeOf<number | undefined>()
    })

    it('t.timestamp() infers tsType as Date', () => {
      expectTypeOf(t.timestamp().tsType).toEqualTypeOf<Date>()
    })

    it('t.timestamp().optional() infers tsType as Date | undefined', () => {
      expectTypeOf(t.timestamp().optional().tsType).toEqualTypeOf<Date | undefined>()
    })

    it('t.json<{ a: number }>() infers tsType as { a: number }', () => {
      expectTypeOf(t.json<{ a: number }>().tsType).toEqualTypeOf<{ a: number }>()
    })

    it('t.string().email().optional() infers tsType as string | undefined', () => {
      expectTypeOf(t.string().email().optional().tsType).toEqualTypeOf<string | undefined>()
    })

    it('t.boolean().optional() infers tsType as boolean | undefined', () => {
      expectTypeOf(t.boolean().optional().tsType).toEqualTypeOf<boolean | undefined>()
    })

    it('t.uuid().optional() infers tsType as string | undefined', () => {
      expectTypeOf(t.uuid().optional().tsType).toEqualTypeOf<string | undefined>()
    })

    it('t.json<{ a: number }>().optional() infers tsType as { a: number } | undefined', () => {
      expectTypeOf(t.json<{ a: number }>().optional().tsType).toEqualTypeOf<
        { a: number } | undefined
      >()
    })

    it('chaining preserves tsType union: t.string().optional().default reverts to string when default given', () => {
      expectTypeOf(t.string().optional().default('x').tsType).toEqualTypeOf<string | undefined>()
    })
  })

  describe('t.json(zodSchema) type inference', () => {
    it('t.json(z.object({...})) infers tsType from zod schema', () => {
      const field = t.json(z.object({ foo: z.string() }))
      expectTypeOf<InferFieldType<typeof field>>().toEqualTypeOf<{ foo: string }>()
    })

    it('t.json() without args infers tsType as unknown', () => {
      const field = t.json()
      expectTypeOf<InferFieldType<typeof field>>().toEqualTypeOf<unknown>()
    })

    it('t.json(zodSchema).optional() infers tsType as T | undefined', () => {
      const field = t.json(z.object({ foo: z.string() })).optional()
      expectTypeOf<InferFieldType<typeof field>>().toEqualTypeOf<{ foo: string } | undefined>()
    })
  })

  describe('basic type inference', () => {
    it('string field implements Field interface', () => {
      const f = t.string()
      expectTypeOf(f).toMatchTypeOf<Field<string>>()
    })

    it('uuid field implements Field interface', () => {
      const f = t.uuid()
      expectTypeOf(f).toMatchTypeOf<Field<string>>()
    })

    it('number field implements Field interface', () => {
      const f = t.number()
      expectTypeOf(f).toMatchTypeOf<Field<number>>()
    })

    it('integer field implements Field interface', () => {
      const f = t.integer()
      expectTypeOf(f).toMatchTypeOf<Field<number>>()
    })

    it('boolean field implements Field interface', () => {
      const f = t.boolean()
      expectTypeOf(f).toMatchTypeOf<Field<boolean>>()
    })

    it('timestamp field implements Field interface', () => {
      const f = t.timestamp()
      expectTypeOf(f).toMatchTypeOf<Field<Date>>()
    })

    it('json field has Field interface', () => {
      const f = t.json()
      expectTypeOf(f).toMatchTypeOf<Field<unknown>>()
    })

    it('json field with generic type parameter', () => {
      const f = t.json<{ foo: string }>()
      expectTypeOf(f).toMatchTypeOf<Field<{ foo: string }>>()
    })
  })

  describe('optional modifier', () => {
    it('optional() returns a Field', () => {
      const f = t.string().optional()
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('optional with uuid returns Field', () => {
      const f = t.uuid().optional()
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('optional with number returns Field', () => {
      const f = t.number().optional()
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('optional with integer returns Field', () => {
      const f = t.integer().optional()
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('optional with boolean returns Field', () => {
      const f = t.boolean().optional()
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('optional with timestamp returns Field', () => {
      const f = t.timestamp().optional()
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('optional with json returns Field', () => {
      const f = t.json<{ foo: string }>().optional()
      expectTypeOf(f).toMatchTypeOf<Field>()
    })
  })

  describe('modifier return types', () => {
    it('primary() returns a Field', () => {
      const f = t.string().primary()
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('unique() returns a Field', () => {
      const f = t.string().unique()
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('default() returns a Field', () => {
      const f = t.string().default('default')
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('email() returns a Field', () => {
      const f = t.string().email()
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('min() returns a Field', () => {
      const f = t.string().min(1)
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('max() returns a Field', () => {
      const f = t.string().max(100)
      expectTypeOf(f).toMatchTypeOf<Field>()
    })
  })

  describe('policy last-wins at type level', () => {
    it('t.string().serverOnly().readOnly() Mods contains { policy: "readOnly" }', () => {
      const f = t.string().serverOnly().readOnly()
      expectTypeOf(f.modifiers).toMatchTypeOf<{ policy: 'readOnly' }>()
    })

    it('t.string().readOnly().serverOnly() Mods contains { policy: "serverOnly" }', () => {
      const f = t.string().readOnly().serverOnly()
      expectTypeOf(f.modifiers).toMatchTypeOf<{ policy: 'serverOnly' }>()
    })

    it('t.string().serverOnly().writeOnly() Mods does not contain serverOnly', () => {
      const f = t.string().serverOnly().writeOnly()
      expectTypeOf(f.modifiers).toMatchTypeOf<{ policy: 'writeOnly' }>()
    })
  })

  describe('chaining modifier combinations', () => {
    it('email then optional returns Field', () => {
      const f = t.string().email().optional()
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('optional then default returns Field', () => {
      const f = t.string().optional().default('fallback')
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('primary then unique then optional returns Field', () => {
      const f = t.string().primary().unique().optional()
      expectTypeOf(f).toMatchTypeOf<Field>()
    })

    it('timestamp with default returns Field', () => {
      const f = t.timestamp().default(() => new Date())
      expectTypeOf(f).toMatchTypeOf<Field>()
    })
  })

  describe('type-level negative cases', () => {
    // 各 it ブロックは type-only テストで、runtime の expect は持たない。
    // 実際の `@ts-expect-error` アサーションは末尾の `_typeGuards` オブジェクトに集約してあり、
    // `it` 名と `_typeGuards` のキー名が 1:1 対応する。
    // 例: 'uuid does not have .email()' の `@ts-expect-error` は `_typeGuards.uuid_email` に存在。
    it('uuid does not have .email()', () => {
      // type-only test; runtime body empty to avoid TypeError
    })

    it('integer does not have .email()', () => {
      // type-only test; runtime body empty to avoid TypeError
    })

    it('number does not have .email()', () => {
      // type-only test; runtime body empty to avoid TypeError
    })

    it('boolean does not have .min()', () => {
      // type-only test; runtime body empty to avoid TypeError
    })

    it('boolean does not have .max()', () => {
      // type-only test; runtime body empty to avoid TypeError
    })

    it('timestamp does not have .min()', () => {
      // type-only test; runtime body empty to avoid TypeError
    })

    it('json does not have .email()', () => {
      // type-only test; runtime body empty to avoid TypeError
    })

    it('uuid().primary() chain still rejects .email()', () => {
      // type-only test; runtime body empty to avoid TypeError
    })

    it('uuid().optional() chain still rejects .email()', () => {
      // type-only test; runtime body empty to avoid TypeError
    })

    it('uuid().unique() chain still rejects .email()', () => {
      // type-only test; runtime body empty to avoid TypeError
    })

    it('integer().min(0) chain still rejects .email()', () => {
      // type-only test; runtime body empty to avoid TypeError
    })

    it('boolean().optional() chain still rejects .min()', () => {
      // type-only test; runtime body empty to avoid TypeError
    })

    it('integer().primary().optional() chain still rejects .email()', () => {
      // type-only test; runtime body empty to avoid TypeError
    })
  })
})

// === Type-level negative assertions (compile-time only) ===
// These assertions are evaluated at type-check time only, not at runtime.
// Each @ts-expect-error on the next line requires a type error on that line.
// If the type error doesn't occur, TypeScript will report that the directive is unused.
type _TypeGuardNegatives = {
  uuid_email: () => void
  integer_email: () => void
  number_email: () => void
  boolean_min: () => void
  boolean_max: () => void
  timestamp_min: () => void
  json_email: () => void
  uuid_primary_email: () => void
  uuid_optional_email: () => void
  uuid_unique_email: () => void
  integer_min_email: () => void
  boolean_optional_min: () => void
  integer_primary_optional_email: () => void
}

// Type-level checks (these don't execute, but TypeScript validates them)
const _typeGuards: _TypeGuardNegatives = {
  uuid_email: () => {
    // @ts-expect-error
    t.uuid().email()
  },
  integer_email: () => {
    // @ts-expect-error
    t.integer().email()
  },
  number_email: () => {
    // @ts-expect-error
    t.number().email()
  },
  boolean_min: () => {
    // @ts-expect-error
    t.boolean().min(0)
  },
  boolean_max: () => {
    // @ts-expect-error
    t.boolean().max(10)
  },
  timestamp_min: () => {
    // @ts-expect-error
    t.timestamp().min(0)
  },
  json_email: () => {
    // @ts-expect-error
    t.json().email()
  },
  uuid_primary_email: () => {
    // @ts-expect-error
    t.uuid().primary().email()
  },
  uuid_optional_email: () => {
    // @ts-expect-error
    t.uuid().optional().email()
  },
  uuid_unique_email: () => {
    // @ts-expect-error
    t.uuid().unique().email()
  },
  integer_min_email: () => {
    // @ts-expect-error
    t.integer().min(0).email()
  },
  boolean_optional_min: () => {
    // @ts-expect-error
    t.boolean().optional().min(0)
  },
  integer_primary_optional_email: () => {
    // @ts-expect-error
    t.integer().primary().optional().email()
  },
}
