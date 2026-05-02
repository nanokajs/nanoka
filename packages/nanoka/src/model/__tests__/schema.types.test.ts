import { describe, it } from 'vitest'
import type { z } from 'zod'
import { t } from '../../field'
import { defineModel } from '../define'

describe('Model: schema() type inference', () => {
  const User = defineModel('users', {
    id: t.uuid().primary(),
    name: t.string(),
    email: t.string().email(),
    passwordHash: t.string(),
  })

  describe('schema() without options', () => {
    it('infers all fields as required', () => {
      const schema = User.schema()
      type Output = z.infer<typeof schema>

      // Verify it has all required fields
      const _: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
        passwordHash: 'hash',
      }
    })
  })

  describe('schema({ omit })', () => {
    it('excludes omitted fields from output type', () => {
      const schema = User.schema({ omit: ['passwordHash'] })
      type Output = z.infer<typeof schema>

      const _: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
      }
    })

    it('excludes multiple fields', () => {
      const schema = User.schema({ omit: ['passwordHash', 'email'] })
      type Output = z.infer<typeof schema>

      const _: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
      }
    })
  })

  describe('schema({ pick })', () => {
    it('includes only picked fields', () => {
      const schema = User.schema({ pick: ['name', 'email'] })
      type Output = z.infer<typeof schema>

      const _: Output = {
        name: 'John',
        email: 'john@example.com',
      }
    })

    it('works with single field', () => {
      const schema = User.schema({ pick: ['id'] })
      type Output = z.infer<typeof schema>

      const _: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
      }
    })
  })

  describe('schema({ partial: true })', () => {
    it('makes all fields optional', () => {
      const schema = User.schema({ partial: true })
      type Output = z.infer<typeof schema>

      const _: Output = {}
      const __: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
        passwordHash: 'hash',
      }
    })
  })

  describe('schema({ partial: true, pick })', () => {
    it('makes picked fields optional', () => {
      const schema = User.schema({ partial: true, pick: ['name', 'email'] })
      type Output = z.infer<typeof schema>

      const _: Output = {}
      const __: Output = {
        name: 'John',
      }
      const ___: Output = {
        name: 'John',
        email: 'john@example.com',
      }
    })
  })

  describe('schema({ partial: true, omit })', () => {
    it('makes remaining fields optional after omit', () => {
      const schema = User.schema({ partial: true, omit: ['passwordHash'] })
      type Output = z.infer<typeof schema>

      const _: Output = {}
      const __: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
      }
    })
  })

  describe('schema({ pick, omit })', () => {
    it('applies pick before omit', () => {
      const schema = User.schema({ pick: ['id', 'name', 'email'], omit: ['email'] })
      type Output = z.infer<typeof schema>

      const _: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
      }
    })
  })

  describe('schema() type validation', () => {
    it('rejects typo in omit', () => {
      // @ts-expect-error - 'passwordHashh' is not a valid field name
      User.schema({ omit: ['passwordHashh'] })
    })

    it('rejects typo in pick', () => {
      // @ts-expect-error - 'emial' is not a valid field name
      User.schema({ pick: ['emial'] })
    })

    it('rejects typo in validator omit', () => {
      // @ts-expect-error - 'passwordHashh' is not a valid field name
      User.validator('json', { omit: ['passwordHashh'] })
    })

    it('omitted fields are absent from output type', () => {
      const s = User.schema({ omit: ['passwordHash'] })
      type Out = z.infer<typeof s>
      // @ts-expect-error - passwordHash should be absent
      const _check: Out = { id: '', name: '', email: '', passwordHash: '' }
      void _check
    })

    it('picked-out fields are absent from output type', () => {
      const s = User.schema({ pick: ['name', 'email'] })
      type Out = z.infer<typeof s>
      // @ts-expect-error - id should be absent
      const _check: Out = { id: '', name: '', email: '' }
      void _check
    })
  })

  describe('FieldsToZodShape concrete types', () => {
    it('preserves concrete Zod input/output types per field', () => {
      const schema = User.schema()
      type In = z.input<typeof schema>
      type Out = z.output<typeof schema>
      const _in: In = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: '',
        email: '',
        passwordHash: '',
      }
      const _out: Out = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: '',
        email: '',
        passwordHash: '',
      }
      void _in
      void _out
    })

    it('email field validation enforces string type', () => {
      const schema = User.schema()
      type In = z.input<typeof schema>
      // Valid email
      const valid: In = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: '',
        email: 'test@example.com',
        passwordHash: '',
      }
      void valid
    })
  })
})
