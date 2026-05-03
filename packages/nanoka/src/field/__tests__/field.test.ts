import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { t } from '../factories'

describe('Field: runtime behavior', () => {
  describe('string field', () => {
    it('creates a basic string field', () => {
      const field = t.string()
      expect(field.modifiers).toEqual({})
      expect(field.zodBase).toBeDefined()
    })

    it('parses valid strings with Zod', () => {
      const field = t.string()
      const result = field.zodBase.safeParse('hello')
      expect(result.success).toBe(true)
      expect(result.data).toBe('hello')
    })

    it('email() modifier validates email format', () => {
      const field = t.string().email()
      expect(field.modifiers.format).toBe('email')

      const validEmail = field.zodBase.safeParse('test@example.com')
      expect(validEmail.success).toBe(true)

      const invalidEmail = field.zodBase.safeParse('not-an-email')
      expect(invalidEmail.success).toBe(false)
    })

    it('min() modifier sets minimum length', () => {
      const field = t.string().min(3)
      expect(field.modifiers.min).toBe(3)

      const tooShort = field.zodBase.safeParse('ab')
      expect(tooShort.success).toBe(false)

      const valid = field.zodBase.safeParse('abc')
      expect(valid.success).toBe(true)
    })

    it('max() modifier sets maximum length', () => {
      const field = t.string().max(5)
      expect(field.modifiers.max).toBe(5)

      const tooLong = field.zodBase.safeParse('abcdef')
      expect(tooLong.success).toBe(false)

      const valid = field.zodBase.safeParse('abcd')
      expect(valid.success).toBe(true)
    })

    it('chaining min and max works together', () => {
      const field = t.string().min(2).max(5)
      expect(field.modifiers.min).toBe(2)
      expect(field.modifiers.max).toBe(5)

      const tooShort = field.zodBase.safeParse('a')
      expect(tooShort.success).toBe(false)

      const valid = field.zodBase.safeParse('abc')
      expect(valid.success).toBe(true)

      const tooLong = field.zodBase.safeParse('abcdef')
      expect(tooLong.success).toBe(false)
    })

    it('optional() allows undefined', () => {
      const field = t.string().optional()
      expect(field.modifiers.optional).toBe(true)

      const undefinedResult = field.zodBase.safeParse(undefined)
      expect(undefinedResult.success).toBe(true)
      expect(undefinedResult.data).toBeUndefined()

      const validResult = field.zodBase.safeParse('hello')
      expect(validResult.success).toBe(true)
      expect(validResult.data).toBe('hello')
    })

    it('default() sets default value with literal', () => {
      const field = t.string().default('default-value')
      expect(field.modifiers.hasDefault).toBe(true)

      const undefinedResult = field.zodBase.safeParse(undefined)
      expect(undefinedResult.success).toBe(true)
      expect(undefinedResult.data).toBe('default-value')
    })

    it('default() with function', () => {
      const defaultFn = () => 'dynamic'
      const field = t.string().default(defaultFn)
      expect(field.modifiers.hasDefault).toBe(true)

      const undefinedResult = field.zodBase.safeParse(undefined)
      expect(undefinedResult.success).toBe(true)
      expect(undefinedResult.data).toBe('dynamic')
    })

    it('drizzleColumn returns a column builder', () => {
      const field = t.string()
      const col = field.drizzleColumn('name')
      expect(col).toBeDefined()
      expect(typeof col).toBe('object')
    })

    it('drizzleColumn with primary modifier', () => {
      const field = t.string().primary()
      const col = field.drizzleColumn('id')
      expect(col).toBeDefined()
    })

    it('drizzleColumn with unique modifier', () => {
      const field = t.string().unique()
      const col = field.drizzleColumn('email')
      expect(col).toBeDefined()
    })

    it('drizzleColumn with optional modifier', () => {
      const field = t.string().optional()
      const col = field.drizzleColumn('name')
      expect(col).toBeDefined()
    })

    it('drizzleColumn with default modifier', () => {
      const field = t.string().default('test')
      const col = field.drizzleColumn('name')
      expect(col).toBeDefined()
    })
  })

  describe('uuid field', () => {
    it('uuid field validates UUID format', () => {
      const field = t.uuid()
      const validUuid = field.zodBase.safeParse('550e8400-e29b-41d4-a716-446655440000')
      expect(validUuid.success).toBe(true)

      const invalid = field.zodBase.safeParse('not-a-uuid')
      expect(invalid.success).toBe(false)
    })

    it('uuid field supports min/max for string length', () => {
      const field = t.uuid().min(1)
      expect(field.modifiers.min).toBe(1)
    })

    it('uuid field does not have email method', () => {
      const field = t.uuid()
      // biome-ignore lint/suspicious/noExplicitAny: Testing that email method doesn't exist
      expect(typeof (field as any).email).toBe('undefined')
    })
  })

  describe('number field', () => {
    it('creates a basic number field', () => {
      const field = t.number()
      expect(field.zodBase).toBeDefined()
    })

    it('parses valid numbers with Zod', () => {
      const field = t.number()
      const result = field.zodBase.safeParse(42)
      expect(result.success).toBe(true)
      expect(result.data).toBe(42)
    })

    it('min() modifier sets minimum value', () => {
      const field = t.number().min(0)
      expect(field.modifiers.min).toBe(0)

      const tooSmall = field.zodBase.safeParse(-1)
      expect(tooSmall.success).toBe(false)

      const valid = field.zodBase.safeParse(0)
      expect(valid.success).toBe(true)
    })

    it('max() modifier sets maximum value', () => {
      const field = t.number().max(100)
      expect(field.modifiers.max).toBe(100)

      const tooLarge = field.zodBase.safeParse(101)
      expect(tooLarge.success).toBe(false)

      const valid = field.zodBase.safeParse(100)
      expect(valid.success).toBe(true)
    })
  })

  describe('integer field', () => {
    it('creates an integer field', () => {
      const field = t.integer()
      expect(field.zodBase).toBeDefined()
    })

    it('validates integers only', () => {
      const field = t.integer()
      const intResult = field.zodBase.safeParse(42)
      expect(intResult.success).toBe(true)

      const floatResult = field.zodBase.safeParse(42.5)
      expect(floatResult.success).toBe(false)
    })

    it('min/max work on integer field', () => {
      const field = t.integer().min(0).max(100)
      const valid = field.zodBase.safeParse(50)
      expect(valid.success).toBe(true)

      const outOfRange = field.zodBase.safeParse(150)
      expect(outOfRange.success).toBe(false)
    })

    it('drizzleColumn returns integer column', () => {
      const field = t.integer()
      const col = field.drizzleColumn('count')
      expect(col).toBeDefined()
    })
  })

  describe('boolean field', () => {
    it('creates a boolean field', () => {
      const field = t.boolean()
      expect(field.zodBase).toBeDefined()
    })

    it('parses boolean values', () => {
      const field = t.boolean()
      const trueResult = field.zodBase.safeParse(true)
      expect(trueResult.success).toBe(true)
      expect(trueResult.data).toBe(true)

      const falseResult = field.zodBase.safeParse(false)
      expect(falseResult.success).toBe(true)
      expect(falseResult.data).toBe(false)
    })

    it('drizzleColumn returns integer column with boolean mode', () => {
      const field = t.boolean()
      const col = field.drizzleColumn('isActive')
      expect(col).toBeDefined()
    })
  })

  describe('timestamp field', () => {
    it('creates a timestamp field', () => {
      const field = t.timestamp()
      expect(field.zodBase).toBeDefined()
    })

    it('parses Date objects', () => {
      const field = t.timestamp()
      const now = new Date()
      const result = field.zodBase.safeParse(now)
      expect(result.success).toBe(true)
      expect(result.data instanceof Date).toBe(true)
    })

    it('coerces ISO string to Date', () => {
      const field = t.timestamp()
      const isoString = '2026-05-01T12:00:00Z'
      const result = field.zodBase.safeParse(isoString)
      expect(result.success).toBe(true)
      expect(result.data instanceof Date).toBe(true)
    })

    it('default with function returning Date', () => {
      const field = t.timestamp().default(() => new Date())
      expect(field.modifiers.hasDefault).toBe(true)

      const undefinedResult = field.zodBase.safeParse(undefined)
      expect(undefinedResult.success).toBe(true)
      expect(undefinedResult.data instanceof Date).toBe(true)
    })

    it('drizzleColumn returns timestamp column', () => {
      const field = t.timestamp()
      const col = field.drizzleColumn('createdAt')
      expect(col).toBeDefined()
    })
  })

  describe('json field', () => {
    it('creates a json field', () => {
      const field = t.json()
      expect(field.zodBase).toBeDefined()
    })

    it('parses any JSON-serializable value', () => {
      const field = t.json()
      const result = field.zodBase.safeParse({ foo: 'bar' })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ foo: 'bar' })
    })

    it('generic type parameter is preserved', () => {
      const field = t.json<{ foo: string }>()
      expect(field).toBeDefined()
    })

    it('optional() with json field', () => {
      const field = t.json<{ foo: string }>().optional()
      expect(field.modifiers.optional).toBe(true)

      const undefinedResult = field.zodBase.safeParse(undefined)
      expect(undefinedResult.success).toBe(true)
    })

    it('drizzleColumn returns json column', () => {
      const field = t.json()
      const col = field.drizzleColumn('metadata')
      expect(col).toBeDefined()
    })
  })

  describe('t.json(zodSchema)', () => {
    it('t.json() with no args accepts any value (backward compat)', () => {
      const field = t.json()
      const result = field.zodBase.safeParse({ anything: true })
      expect(result.success).toBe(true)
    })

    it('t.json(z.object) validates shape at runtime - success', () => {
      const field = t.json(z.object({ foo: z.string() }))
      const valid = field.zodBase.safeParse({ foo: 'x' })
      expect(valid.success).toBe(true)
    })

    it('t.json(z.object) validates shape at runtime - failure on wrong type', () => {
      const field = t.json(z.object({ foo: z.string() }))
      const invalid = field.zodBase.safeParse({ foo: 1 })
      expect(invalid.success).toBe(false)
    })

    it('t.json(zodSchema) rejects wrong shape', () => {
      const field = t.json(z.object({ foo: z.string() }))
      const invalid = field.zodBase.safeParse({ bar: 'x' })
      expect(invalid.success).toBe(false)
    })

    it('t.json(zodSchema) with optional modifier', () => {
      const field = t.json(z.object({ foo: z.string() })).optional()
      expect(field.modifiers.optional).toBe(true)

      const undefinedResult = field.zodBase.safeParse(undefined)
      expect(undefinedResult.success).toBe(true)
    })

    it('t.json(zodSchema) with default modifier', () => {
      const field = t.json(z.object({ foo: z.string() })).default(() => ({ foo: 'default' }))
      expect(field.modifiers.hasDefault).toBe(true)

      const result = field.zodBase.safeParse(undefined)
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ foo: 'default' })
    })
  })

  describe('field policy', () => {
    it('t.string().serverOnly() sets policy to serverOnly', () => {
      const field = t.string().serverOnly()
      expect(field.modifiers.policy).toBe('serverOnly')
    })

    it('t.string().writeOnly() sets policy to writeOnly', () => {
      const field = t.string().writeOnly()
      expect(field.modifiers.policy).toBe('writeOnly')
    })

    it('t.string().readOnly() sets policy to readOnly', () => {
      const field = t.string().readOnly()
      expect(field.modifiers.policy).toBe('readOnly')
    })

    it('last policy wins (serverOnly then readOnly = readOnly)', () => {
      const field = t.string().serverOnly().readOnly()
      // biome-ignore lint/suspicious/noExplicitAny: TypeScript intersection makes policy: never; runtime is correct
      expect((field.modifiers as any).policy).toBe('readOnly')
    })

    it('last policy wins (readOnly then writeOnly = writeOnly)', () => {
      const field = t.string().readOnly().writeOnly()
      // biome-ignore lint/suspicious/noExplicitAny: TypeScript intersection makes policy: never; runtime is correct
      expect((field.modifiers as any).policy).toBe('writeOnly')
    })

    it('t.uuid().readOnly() works', () => {
      const field = t.uuid().readOnly()
      expect(field.modifiers.policy).toBe('readOnly')
    })

    it('t.timestamp().readOnly() works', () => {
      const field = t.timestamp().readOnly()
      expect(field.modifiers.policy).toBe('readOnly')
    })

    it('t.json(z.object({...})).readOnly() preserves zodSchema validation', () => {
      const field = t.json(z.object({ foo: z.string() })).readOnly()
      expect(field.modifiers.policy).toBe('readOnly')

      const valid = field.zodBase.safeParse({ foo: 'x' })
      expect(valid.success).toBe(true)

      const invalid = field.zodBase.safeParse({ foo: 1 })
      expect(invalid.success).toBe(false)
    })

    it('t.string().primary() does not set policy', () => {
      const field = t.string().primary()
      // biome-ignore lint/suspicious/noExplicitAny: policy is not in the primary-only Mods type
      expect((field.modifiers as any).policy).toBeUndefined()
    })
  })

  describe('modifier combinations', () => {
    it('optional + default works together', () => {
      const field = t.string().optional().default('fallback')
      expect(field.modifiers.optional).toBe(true)
      expect(field.modifiers.hasDefault).toBe(true)

      const undefinedResult = field.zodBase.safeParse(undefined)
      expect(undefinedResult.success).toBe(true)
      expect(undefinedResult.data).toBe('fallback')
    })

    it('email + min/max work together', () => {
      const field = t.string().email().min(5).max(100)
      expect(field.modifiers.format).toBe('email')
      expect(field.modifiers.min).toBe(5)
      expect(field.modifiers.max).toBe(100)

      const validEmail = field.zodBase.safeParse('a@b.co')
      expect(validEmail.success).toBe(true)

      const tooShort = field.zodBase.safeParse('a@b')
      expect(tooShort.success).toBe(false)
    })

    it('primary + unique work together', () => {
      const field = t.string().primary().unique()
      expect(field.modifiers.primary).toBe(true)
      expect(field.modifiers.unique).toBe(true)

      const col = field.drizzleColumn('id')
      expect(col).toBeDefined()
    })
  })

  describe('immutability', () => {
    it('modifiers are immutable', () => {
      const field = t.string()
      expect(() => {
        // biome-ignore lint/suspicious/noExplicitAny: Testing immutability by trying to mutate
        ;(field.modifiers as any).custom = true
      }).toThrow()
    })

    it('chaining returns new instances', () => {
      const field1 = t.string()
      const field2 = field1.optional()
      expect(field1).not.toBe(field2)
      // biome-ignore lint/suspicious/noExplicitAny: Type narrowing for runtime check
      expect((field1.modifiers as any).optional).toBeUndefined()
      // biome-ignore lint/suspicious/noExplicitAny: Type narrowing for runtime check
      expect((field2.modifiers as any).optional).toBe(true)
    })
  })

  describe('drizzle column attributes', () => {
    it('string field produces text column', () => {
      const field = t.string()
      const col = field.drizzleColumn('name')
      expect(col).toBeDefined()
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.notNull).toBe(true)
    })

    it('uuid field produces text column', () => {
      const field = t.uuid()
      const col = field.drizzleColumn('id')
      expect(col).toBeDefined()
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.notNull).toBe(true)
    })

    it('number field produces real column', () => {
      const field = t.number()
      const col = field.drizzleColumn('amount')
      expect(col).toBeDefined()
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.notNull).toBe(true)
    })

    it('integer field produces integer column', () => {
      const field = t.integer()
      const col = field.drizzleColumn('age')
      expect(col).toBeDefined()
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.notNull).toBe(true)
    })

    it('boolean field produces integer column with boolean mode', () => {
      const field = t.boolean()
      const col = field.drizzleColumn('active')
      expect(col).toBeDefined()
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.notNull).toBe(true)
    })

    it('timestamp field produces integer column with timestamp_ms mode', () => {
      const field = t.timestamp()
      const col = field.drizzleColumn('createdAt')
      expect(col).toBeDefined()
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.notNull).toBe(true)
    })

    it('json field produces text column with json mode', () => {
      const field = t.json<{ a: number }>()
      const col = field.drizzleColumn('meta')
      expect(col).toBeDefined()
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.notNull).toBe(true)
    })

    it('optional field sets notNull to false', () => {
      const field = t.string().optional()
      const col = field.drizzleColumn('name')
      expect(col).toBeDefined()
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.notNull).toBe(false)
    })

    it('primary field sets primaryKey', () => {
      const field = t.uuid().primary()
      const col = field.drizzleColumn('id')
      expect(col).toBeDefined()
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.primaryKey).toBe(true)
    })

    it('unique field sets isUnique', () => {
      const field = t.string().unique()
      const col = field.drizzleColumn('email')
      expect(col).toBeDefined()
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.isUnique).toBe(true)
    })
  })

  describe('SQL type mapping', () => {
    it('string maps to text', () => {
      const field = t.string()
      const col = field.drizzleColumn('name')
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.columnType).toBe('SQLiteText')
    })

    it('uuid maps to text', () => {
      const field = t.uuid()
      const col = field.drizzleColumn('id')
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.columnType).toBe('SQLiteText')
    })

    it('number maps to real', () => {
      const field = t.number()
      const col = field.drizzleColumn('amount')
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.columnType).toBe('SQLiteReal')
    })

    it('integer maps to integer', () => {
      const field = t.integer()
      const col = field.drizzleColumn('age')
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.columnType).toBe('SQLiteInteger')
    })

    it('boolean maps to integer (with mode boolean)', () => {
      const field = t.boolean()
      const col = field.drizzleColumn('active')
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.columnType).toBe('SQLiteBoolean')
    })

    it('timestamp maps to integer (with mode timestamp_ms)', () => {
      const field = t.timestamp()
      const col = field.drizzleColumn('createdAt')
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.columnType).toBe('SQLiteTimestamp')
    })

    it('json maps to text (with mode json)', () => {
      const field = t.json<{ a: number }>()
      const col = field.drizzleColumn('meta')
      // biome-ignore lint/suspicious/noExplicitAny: Accessing drizzle internal config
      expect((col as any).config?.columnType).toBe('SQLiteTextJson')
    })
  })
})
