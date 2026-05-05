import { describe, expect, expectTypeOf, it } from 'vitest'
import { defineModel } from '../../model'
import { buildFieldAccessor } from '../../model/types'
import { type RelationFieldBuilder, t } from '../factories'

const PostModel = { fields: { id: t.integer(), title: t.string() }, tableName: 'posts' }
const _CommentModel = { fields: { id: t.integer(), body: t.string() }, tableName: 'comments' }

describe('t.hasMany', () => {
  it('creates a relation field with kind relation and relationKind hasMany', () => {
    const field = t.hasMany(PostModel, { foreignKey: 'userId' })
    expect(field.kind).toBe('relation')
    expect(field.relationKind).toBe('hasMany')
    expect(field.foreignKey).toBe('userId')
    expect(field.target).toBe(PostModel)
  })

  it('accepts a lazy target function', () => {
    const field = t.hasMany(() => PostModel, { foreignKey: 'userId' })
    expect(typeof field.target).toBe('function')
  })

  it('drizzleColumn throws an error', () => {
    const field = t.hasMany(PostModel, { foreignKey: 'userId' })
    expect(() => field.drizzleColumn('posts')).toThrow()
  })
})

describe('t.belongsTo', () => {
  it('creates a relation field with kind relation and relationKind belongsTo', () => {
    const field = t.belongsTo(PostModel, { foreignKey: 'postId' })
    expect(field.kind).toBe('relation')
    expect(field.relationKind).toBe('belongsTo')
    expect(field.foreignKey).toBe('postId')
  })
})

describe('type-level tests', () => {
  it('t.hasMany returns RelationFieldBuilder with hasMany kind', () => {
    const field = t.hasMany(PostModel, { foreignKey: 'userId' })
    expectTypeOf(field).toMatchTypeOf<RelationFieldBuilder<typeof PostModel, 'userId', 'hasMany'>>()
    expectTypeOf(field.relationKind).toEqualTypeOf<'hasMany'>()
  })

  it('t.belongsTo returns RelationFieldBuilder with belongsTo kind', () => {
    const field = t.belongsTo(PostModel, { foreignKey: 'postId' })
    expectTypeOf(field).toMatchTypeOf<
      RelationFieldBuilder<typeof PostModel, 'postId', 'belongsTo'>
    >()
    expectTypeOf(field.relationKind).toEqualTypeOf<'belongsTo'>()
  })

  it('buildFieldAccessor accessor does not include relation keys', () => {
    const fields = {
      id: t.integer(),
      name: t.string(),
      posts: t.hasMany(PostModel, { foreignKey: 'userId' }),
    }
    const accessor = buildFieldAccessor(fields)
    expectTypeOf(accessor).toHaveProperty('id')
    expectTypeOf(accessor).toHaveProperty('name')
    expectTypeOf<keyof typeof accessor>().not.toEqualTypeOf<'posts'>()
  })
})

describe('defineModel with relation fields', () => {
  const UserModel = defineModel('users', {
    id: t.integer().primary(),
    name: t.string(),
    posts: t.hasMany(PostModel, { foreignKey: 'userId' }),
  })

  it('User.table does not include relation keys', () => {
    const tableColumns = Object.keys(UserModel.table)
    expect(tableColumns).not.toContain('posts')
    expect(tableColumns).toContain('id')
    expect(tableColumns).toContain('name')
  })

  it('User.outputSchema().shape does not include relation keys', () => {
    const shape = UserModel.outputSchema().shape
    expect(shape).not.toHaveProperty('posts')
    expect(shape).toHaveProperty('id')
    expect(shape).toHaveProperty('name')
  })

  it('User.inputSchema("create").shape does not include relation keys', () => {
    const shape = UserModel.inputSchema('create').shape
    expect(shape).not.toHaveProperty('posts')
    expect(shape).toHaveProperty('name')
  })
})
