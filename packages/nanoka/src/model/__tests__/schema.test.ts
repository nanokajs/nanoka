import { describe, expect, it } from 'vitest'
import { t } from '../../field'
import { defineModel } from '../define'

const validUuid = '550e8400-e29b-41d4-a716-446655440000'

describe('Model: schema() runtime behavior', () => {
  const User = defineModel('users', {
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

    it('preserves user omit when pick is also specified', () => {
      const schema = User.schema({ pick: ['id', 'name', 'email'], omit: ['email'] })
      const result = schema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john@example.com',
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
      })
      expect(result.data).not.toHaveProperty('email')
    })

    it('combines multiple omit constraints with pick', () => {
      const schema = User.schema({
        pick: ['id', 'name', 'passwordHash'],
        omit: ['passwordHash'],
      })
      const result = schema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: 'secret123',
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
      })
      expect(result.data).not.toHaveProperty('passwordHash')
    })
  })
})

describe('Model: inputSchema / outputSchema / toResponse', () => {
  const PolicyUser = defineModel('users', {
    id: t.uuid().primary().readOnly(),
    name: t.string(),
    email: t.string().email(),
    passwordHash: t.string().serverOnly(),
    createdAt: t
      .timestamp()
      .readOnly()
      .default(() => new Date()),
  })

  describe('inputSchema("create")', () => {
    it('excludes serverOnly fields', () => {
      const schema = PolicyUser.inputSchema('create')
      const result = schema.safeParse({
        name: 'Alice',
        email: 'alice@example.com',
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('passwordHash')
    })

    it('excludes readOnly fields', () => {
      const schema = PolicyUser.inputSchema('create')
      const result = schema.safeParse({
        name: 'Alice',
        email: 'alice@example.com',
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('id')
      expect(result.data).not.toHaveProperty('createdAt')
    })

    it('rejects missing required fields', () => {
      const schema = PolicyUser.inputSchema('create')
      const result = schema.safeParse({ name: 'Alice' })
      expect(result.success).toBe(false)
    })

    it('strips serverOnly/readOnly fields from input even if provided', () => {
      const schema = PolicyUser.inputSchema('create')
      const result = schema.safeParse({
        id: validUuid,
        name: 'Alice',
        email: 'alice@example.com',
        passwordHash: 'injected',
        createdAt: new Date(),
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('id')
      expect(result.data).not.toHaveProperty('passwordHash')
      expect(result.data).not.toHaveProperty('createdAt')
    })

    it('user omit works with pick in inputSchema("create")', () => {
      const schema = PolicyUser.inputSchema('create', {
        pick: ['name', 'email'],
        omit: ['email'],
      })
      const result = schema.safeParse({
        name: 'Alice',
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'Alice',
      })
      expect(result.data).not.toHaveProperty('email')
    })
  })

  describe('inputSchema("update")', () => {
    it('excludes serverOnly and readOnly fields', () => {
      const schema = PolicyUser.inputSchema('update')
      const result = schema.safeParse({ name: 'Bob' })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('passwordHash')
      expect(result.data).not.toHaveProperty('id')
      expect(result.data).not.toHaveProperty('createdAt')
    })

    it('makes all remaining fields optional (partial)', () => {
      const schema = PolicyUser.inputSchema('update')
      const emptyResult = schema.safeParse({})
      expect(emptyResult.success).toBe(true)
    })

    it('validates present fields normally', () => {
      const schema = PolicyUser.inputSchema('update')
      const invalid = schema.safeParse({ email: 'not-an-email' })
      expect(invalid.success).toBe(false)
    })

    it('user omit works with pick and partial in inputSchema("update")', () => {
      const schema = PolicyUser.inputSchema('update', {
        pick: ['name', 'email'],
        omit: ['email'],
      })
      const result = schema.safeParse({
        name: 'Alice',
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'Alice',
      })
      expect(result.data).not.toHaveProperty('email')
    })
  })

  describe('outputSchema()', () => {
    it('excludes serverOnly fields', () => {
      const schema = PolicyUser.outputSchema()
      const result = schema.safeParse({
        id: validUuid,
        name: 'Alice',
        email: 'alice@example.com',
        createdAt: new Date(),
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('passwordHash')
    })

    it('keeps readOnly fields in output', () => {
      const schema = PolicyUser.outputSchema()
      const result = schema.safeParse({
        id: validUuid,
        name: 'Alice',
        email: 'alice@example.com',
        createdAt: new Date(),
      })
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('id')
      expect(result.data).toHaveProperty('createdAt')
    })

    it('user omit combines with policy omit', () => {
      const schema = PolicyUser.outputSchema({ omit: ['email'] })
      const result = schema.safeParse({
        id: validUuid,
        name: 'Alice',
        createdAt: new Date(),
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('email')
      expect(result.data).not.toHaveProperty('passwordHash')
    })

    it('serverOnly fields are stripped even when explicitly picked', () => {
      const schema = PolicyUser.outputSchema({ pick: ['name', 'passwordHash'] })
      const result = schema.safeParse({
        name: 'Alice',
        passwordHash: 'hash',
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('passwordHash')
      expect(result.data).toHaveProperty('name')
    })

    it('readOnly fields can be included via pick', () => {
      const schema = PolicyUser.outputSchema({ pick: ['id', 'name'] })
      const result = schema.safeParse({
        id: validUuid,
        name: 'Alice',
      })
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('id')
      expect(result.data).toHaveProperty('name')
    })

    it('user omit works independently with pick in outputSchema', () => {
      const schema = PolicyUser.outputSchema({
        pick: ['id', 'name', 'email'],
        omit: ['email'],
      })
      const result = schema.safeParse({
        id: validUuid,
        name: 'Alice',
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        id: validUuid,
        name: 'Alice',
      })
      expect(result.data).not.toHaveProperty('email')
    })

    it('serverOnly and user omit both apply with pick', () => {
      const schema = PolicyUser.outputSchema({
        pick: ['id', 'name', 'email', 'passwordHash'],
        omit: ['email'],
      })
      const result = schema.safeParse({
        id: validUuid,
        name: 'Alice',
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('passwordHash')
      expect(result.data).not.toHaveProperty('email')
      expect(result.data).toHaveProperty('id')
      expect(result.data).toHaveProperty('name')
    })
  })

  describe('writeOnly field in outputSchema', () => {
    const WriteOnlyModel = defineModel('items', {
      id: t.uuid().primary().readOnly(),
      name: t.string(),
      secret: t.string().writeOnly(),
    })

    it('excludes writeOnly fields from output', () => {
      const schema = WriteOnlyModel.outputSchema()
      const result = schema.safeParse({
        id: validUuid,
        name: 'Item A',
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('secret')
    })

    it('includes writeOnly fields in inputSchema("create")', () => {
      const schema = WriteOnlyModel.inputSchema('create')
      const result = schema.safeParse({
        name: 'Item A',
        secret: 'my-secret',
      })
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('secret')
    })
  })

  describe('toResponse()', () => {
    it('strips serverOnly fields from a DB row', () => {
      const row = {
        id: validUuid,
        name: 'Alice',
        email: 'alice@example.com',
        passwordHash: 'hashed123',
        createdAt: new Date(),
      }
      const result = PolicyUser.toResponse(row) as Record<string, unknown>
      expect(result).not.toHaveProperty('passwordHash')
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('email')
      expect(result).toHaveProperty('createdAt')
    })
  })

  describe('serverOnly invariant: always stripped regardless of pick/omit', () => {
    it('inputSchema("create") strips serverOnly even when explicitly picked', () => {
      const schema = PolicyUser.inputSchema('create', { pick: ['name', 'email', 'passwordHash'] })
      const result = schema.safeParse({
        name: 'Alice',
        email: 'alice@example.com',
        passwordHash: 'injected',
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('passwordHash')
    })

    it('inputSchema("update") strips serverOnly even when explicitly picked', () => {
      const schema = PolicyUser.inputSchema('update', { pick: ['name', 'passwordHash'] })
      const result = schema.safeParse({
        name: 'Alice',
        passwordHash: 'injected',
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('passwordHash')
    })

    it('outputSchema strips serverOnly even when explicitly picked', () => {
      const schema = PolicyUser.outputSchema({ pick: ['id', 'name', 'email', 'passwordHash'] })
      const result = schema.safeParse({
        id: validUuid,
        name: 'Alice',
        email: 'alice@example.com',
        passwordHash: 'hash',
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('passwordHash')
    })

    it('outputSchema strips serverOnly even when omit is explicitly empty', () => {
      const schema = PolicyUser.outputSchema({ omit: [] })
      const result = schema.safeParse({
        id: validUuid,
        name: 'Alice',
        email: 'alice@example.com',
        passwordHash: 'hash',
        createdAt: new Date(),
      })
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('passwordHash')
    })
  })
})
