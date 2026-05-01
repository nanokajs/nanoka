import { describe, it } from 'vitest'
import type { z } from 'zod'
import { t } from '../../field'
import { defineModel } from '../define'

describe('Model: schema() type inference', () => {
  const User = defineModel({
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
})
