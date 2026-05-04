import { like } from 'drizzle-orm'
import { describe, it } from 'vitest'
import type { Adapter } from '../../adapter/types'
import { t } from '../../field'
import { defineModel } from '../define'
import type { CreateInput, FindAllOptions, FindManyOptions, RowType } from '../types'

describe('CRUD methods: type checking', () => {
  const User = defineModel('users', {
    id: t.uuid().primary(),
    name: t.string(),
    email: t.string().email(),
  })

  describe('findMany type constraints', () => {
    it('requires limit parameter', () => {
      // @ts-expect-error - limit is required
      // biome-ignore lint/suspicious/noExplicitAny: intentional test for type constraint
      User.findMany({} as any, {})
    })

    it('rejects findMany with no options argument', () => {
      // @ts-expect-error - options argument is required
      // biome-ignore lint/suspicious/noExplicitAny: intentional test for type constraint
      User.findMany({} as any)
    })

    it('allows findMany with limit', () => {
      const opts: FindManyOptions<typeof User.fields> = { limit: 20 }
      void opts
    })

    it('allows findMany with limit and offset', () => {
      const opts: FindManyOptions<typeof User.fields> = { limit: 20, offset: 10 }
      void opts
    })

    it('allows findMany with limit and orderBy', () => {
      const opts: FindManyOptions<typeof User.fields> = { limit: 20, orderBy: 'name' }
      void opts
    })

    it('rejects orderBy with nonexistent field', () => {
      // @ts-expect-error - 'nonexistent' is not a field
      const opts: FindManyOptions<typeof User.fields> = { limit: 20, orderBy: 'nonexistent' }
      void opts
    })

    it('accepts orderBy as field object with direction', () => {
      const opts: FindManyOptions<typeof User.fields> = {
        limit: 20,
        orderBy: { column: 'name', direction: 'asc' },
      }
      void opts
    })

    it('accepts orderBy as array of fields', () => {
      const opts: FindManyOptions<typeof User.fields> = {
        limit: 20,
        orderBy: ['name', 'email'],
      }
      void opts
    })

    it('accepts mixed array of string and object orderBy', () => {
      const opts: FindManyOptions<typeof User.fields> = {
        limit: 20,
        orderBy: ['name', { column: 'email', direction: 'desc' }],
      }
      void opts
    })

    it('allows findMany with where as equality object (regression)', () => {
      const opts: FindManyOptions<typeof User.fields> = {
        limit: 20,
        where: { email: 'alice@example.com' },
      }
      void opts
    })

    it('allows findMany with where as Drizzle SQL expression', () => {
      const opts: FindManyOptions<typeof User.fields> = {
        limit: 20,
        where: like(User.table.email, '%x%'),
      }
      void opts
    })

    it('allows findMany with where omitted', () => {
      const opts: FindManyOptions<typeof User.fields> = { limit: 20 }
      void opts
    })
  })

  describe('findAll type constraints', () => {
    it('allows findAll with no options (options omitted)', () => {
      // biome-ignore lint/suspicious/noExplicitAny: intentional adapter stub
      User.findAll({} as any)
    })

    it('allows findAll with offset', () => {
      const opts: FindAllOptions<typeof User.fields> = { offset: 10 }
      void opts
    })

    it('allows findAll with orderBy as string', () => {
      const opts: FindAllOptions<typeof User.fields> = { orderBy: 'name' }
      void opts
    })

    it('rejects findAll with nonexistent orderBy field', () => {
      // @ts-expect-error - 'nonexistent' is not a field
      const opts: FindAllOptions<typeof User.fields> = { orderBy: 'nonexistent' }
      void opts
    })

    it('allows findAll with where as equality object', () => {
      const opts: FindAllOptions<typeof User.fields> = { where: { email: 'x@example.com' } }
      void opts
    })

    it('allows findAll with where as Drizzle SQL expression', () => {
      const opts: FindAllOptions<typeof User.fields> = {
        where: like(User.table.email, '%x%'),
      }
      void opts
    })

    it('rejects findAll options that include limit (limit must not be in FindAllOptions)', () => {
      // @ts-expect-error - limit is not a property of FindAllOptions
      const opts: FindAllOptions<typeof User.fields> = { limit: 20 }
      void opts
    })

    it('findAll return type is Promise<RowType<Fields>[]>', async () => {
      const result: Promise<RowType<typeof User.fields>[]> = User.findAll({} as Adapter)
      void result
    })
  })

  describe('findOne type constraints', () => {
    it('accepts id as string', () => {
      const _: Parameters<typeof User.findOne>[1] = 'some-id'
      void _
    })

    it('accepts id as number', () => {
      const _: Parameters<typeof User.findOne>[1] = 123
      void _
    })

    it('accepts where object', () => {
      const _: Parameters<typeof User.findOne>[1] = { email: 'test@example.com' }
      void _
    })

    it('rejects where object with nonexistent field', () => {
      // @ts-expect-error - 'nonexistent' is not a field
      const _: Parameters<typeof User.findOne>[1] = { nonexistent: 'value' }
      void _
    })
  })

  describe('CreateInput: writeOnly field is required', () => {
    const UserWithWriteOnly = defineModel('users', {
      id: t.uuid().primary(),
      name: t.string(),
      email: t.string().email(),
      password: t.string().writeOnly(),
    })

    it('writeOnly field is included as required in CreateInput', () => {
      type C = CreateInput<typeof UserWithWriteOnly.fields>
      const _valid: C = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Alice',
        email: 'alice@example.com',
        password: 'secret',
      }
      void _valid
    })

    it('omitting writeOnly field is a type error', () => {
      type C = CreateInput<typeof UserWithWriteOnly.fields>
      // @ts-expect-error - password (writeOnly) is required in CreateInput
      const _missing: C = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Alice',
        email: 'alice@example.com',
      }
      void _missing
    })
  })

  describe('CreateInput: readOnly field is optional', () => {
    const UserWithReadOnly = defineModel('users', {
      id: t.uuid().primary().readOnly(),
      name: t.string(),
      email: t.string().email(),
      createdAt: t.timestamp().readOnly(),
    })

    it('readOnly field can be omitted in CreateInput', () => {
      type C = CreateInput<typeof UserWithReadOnly.fields>
      const _omitted: C = {
        name: 'Alice',
        email: 'alice@example.com',
      }
      void _omitted
    })

    it('readOnly field can be provided in CreateInput', () => {
      type C = CreateInput<typeof UserWithReadOnly.fields>
      const _provided: C = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Alice',
        email: 'alice@example.com',
        createdAt: new Date('2024-01-01'),
      }
      void _provided
    })
  })

  describe('CreateInput: serverOnly field is excluded', () => {
    const UserWithServerOnly = defineModel('users', {
      id: t.uuid().primary(),
      name: t.string(),
      email: t.string().email(),
      passwordHash: t.string().serverOnly(),
    })

    it('serverOnly field is not a key of CreateInput', () => {
      type C = CreateInput<typeof UserWithServerOnly.fields>
      type HasPasswordHash = 'passwordHash' extends keyof C ? true : false
      const _: HasPasswordHash = false
      void _
    })

    it('serverOnly field absent allows valid CreateInput', () => {
      type C = CreateInput<typeof UserWithServerOnly.fields>
      const _valid: C = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Alice',
        email: 'alice@example.com',
      }
      void _valid
    })
  })

  describe('toResponseMany type constraints', () => {
    it('accepts readonly array of RowType and returns unknown[]', () => {
      const row: RowType<typeof User.fields> = {
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Alice',
        email: 'alice@example.com',
      }
      const result: unknown[] = User.toResponseMany([row])
      void result
    })

    it('accepts empty array', () => {
      const result: unknown[] = User.toResponseMany([])
      void result
    })
  })

  describe('delete type constraints', () => {
    it('requires idOrWhere parameter', () => {
      // @ts-expect-error - idOrWhere is required
      // biome-ignore lint/suspicious/noExplicitAny: intentional test for type constraint
      User.delete({} as any)
    })

    it('accepts id as string', () => {
      const _: Parameters<typeof User.delete>[1] = 'some-id'
      void _
    })

    it('accepts id as number', () => {
      const _: Parameters<typeof User.delete>[1] = 123
      void _
    })

    it('accepts where object', () => {
      const _: Parameters<typeof User.delete>[1] = { email: 'test@example.com' }
      void _
    })
  })
})
