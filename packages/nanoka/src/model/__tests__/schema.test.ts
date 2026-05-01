import { describe, expect, it } from 'vitest'
import { t } from '../../field'
import { defineModel } from '../define'

describe('Model: schema() runtime behavior', () => {
  const User = defineModel({
    id: t.uuid().primary(),
    name: t.string(),
    email: t.string().email(),
    passwordHash: t.string(),
  })

  describe('schema() without options', () => {
    it('returns a ZodObject with all fields required', () => {
      const schema = User.schema()
      const result = schema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: 'hashed123',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing required fields', () => {
      const schema = User.schema()
      const result = schema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        // email is missing
        passwordHash: 'hashed123',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid email format', () => {
      const schema = User.schema()
      const result = schema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'invalid-email',
        passwordHash: 'hashed123',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('schema({ omit })', () => {
    it('removes fields from the schema', () => {
      const schema = User.schema({ omit: ['passwordHash'] })
      const result = schema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john@example.com',
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('passwordHash')
    })

    it('strips omitted fields in input', () => {
      const schema = User.schema({ omit: ['passwordHash'] })
      const result = schema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: 'hashed123', // should be stripped
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('passwordHash')
    })

    it('omit multiple fields', () => {
      const schema = User.schema({ omit: ['passwordHash', 'email'] })
      const result = schema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
      })
    })

    it('omit results in empty schema when all fields omitted', () => {
      const schema = User.schema({ omit: ['id', 'name', 'email', 'passwordHash'] })
      const result = schema.safeParse({})
      expect(result.success).toBe(true)
      expect(result.data).toEqual({})
    })
  })

  describe('schema({ pick })', () => {
    it('includes only specified fields', () => {
      const schema = User.schema({ pick: ['id', 'name'] })
      const result = schema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
      })
    })

    it('rejects missing picked fields', () => {
      const schema = User.schema({ pick: ['id', 'name'] })
      const result = schema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        // name is missing
      })
      expect(result.success).toBe(false)
    })

    it('strips non-picked fields', () => {
      const schema = User.schema({ pick: ['id', 'name'] })
      const result = schema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: 'hashed123',
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
      })
    })
  })

  describe('schema({ partial: true })', () => {
    it('makes all fields optional', () => {
      const schema = User.schema({ partial: true })
      const result = schema.safeParse({})
      expect(result.success).toBe(true)
      expect(result.data).toEqual({})
    })

    it('allows partial data', () => {
      const schema = User.schema({ partial: true })
      const result = schema.safeParse({
        name: 'John Doe',
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'John Doe',
      })
    })

    it('validates present fields normally', () => {
      const schema = User.schema({ partial: true })
      const result = schema.safeParse({
        email: 'invalid-email', // invalid even if optional
      })
      expect(result.success).toBe(false)
    })
  })

  describe('schema({ partial: true, pick })', () => {
    it('makes picked fields optional', () => {
      const schema = User.schema({ partial: true, pick: ['name', 'email'] })
      const result = schema.safeParse({})
      expect(result.success).toBe(true)
      expect(result.data).toEqual({})
    })

    it('allows partial data with picked fields', () => {
      const schema = User.schema({ partial: true, pick: ['name', 'email'] })
      const result = schema.safeParse({
        name: 'John Doe',
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'John Doe',
      })
    })

    it('validates present picked fields normally', () => {
      const schema = User.schema({ partial: true, pick: ['name', 'email'] })
      const result = schema.safeParse({
        email: 'john@example.com',
      })
      expect(result.success).toBe(true)

      const invalid = schema.safeParse({
        email: 'invalid-email',
      })
      expect(invalid.success).toBe(false)
    })

    it('strips non-picked fields', () => {
      const schema = User.schema({ partial: true, pick: ['name', 'email'] })
      const result = schema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        id: '550e8400-e29b-41d4-a716-446655440000',
        passwordHash: 'hashed123',
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
      })
    })
  })

  describe('schema({ partial: true, omit })', () => {
    it('makes remaining fields optional after omit', () => {
      const schema = User.schema({ partial: true, omit: ['passwordHash'] })
      const result = schema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('allows partial data after omit', () => {
      const schema = User.schema({ partial: true, omit: ['passwordHash'] })
      const result = schema.safeParse({
        name: 'John Doe',
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'John Doe',
      })
    })
  })

  describe('schema({ pick, omit })', () => {
    it('applies pick before omit', () => {
      const schema = User.schema({ pick: ['id', 'name', 'email'], omit: ['email'] })
      const result = schema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
      })
    })
  })
})
