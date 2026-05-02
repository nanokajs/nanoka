import { describe, it } from 'vitest'
import { t } from '../../field'
import { defineModel } from '../define'
import type { FindManyOptions } from '../types'

describe('CRUD methods: type checking', () => {
  const User = defineModel('users', {
    id: t.uuid().primary(),
    name: t.string(),
    email: t.string().email(),
  })

  describe('findMany type constraints', () => {
    it('requires limit parameter', () => {
      // @ts-expect-error - limit is required
      User.findMany({} as any, {})
    })

    it('rejects findMany with no options argument', () => {
      // @ts-expect-error - options argument is required
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

  describe('delete type constraints', () => {
    it('requires idOrWhere parameter', () => {
      // @ts-expect-error - idOrWhere is required
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
