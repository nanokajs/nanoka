import { describe, expect, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import * as z4 from 'zod/v4'
import { t } from '../../field'
import { defineModel } from '../../model'
import type { OpenAPIModelComponent } from '../types'

describe('OpenAPI component generation', () => {
  const User = defineModel('users', {
    id: t.uuid().primary().readOnly(),
    name: t.string().min(1).max(100),
    email: t.string().email(),
    age: t.integer().min(0).max(150).optional(),
    score: t.number().min(0).max(1).default(0),
    active: t.boolean().default(true),
    createdAt: t
      .timestamp()
      .readOnly()
      .default(() => new Date()),
    password: t.string().min(8).writeOnly(),
    passwordHash: t.string().serverOnly(),
    metadata: t.json().optional(),
    profile: t
      .json(
        z.object({
          foo: z.string(),
          count: z.number().int().optional(),
          flags: z.array(z.boolean()).default([]),
          labels: z.record(z.string()),
          note: z.string().nullable().optional(),
        }),
      )
      .optional(),
  })

  it('returns a typed model component', () => {
    expectTypeOf(User.toOpenAPIComponent()).toEqualTypeOf<OpenAPIModelComponent>()
  })

  it('generates create/update/output components with policy fields applied', () => {
    const component = User.toOpenAPIComponent()

    expect(Object.keys(component.create.properties as Record<string, unknown>)).toEqual([
      'name',
      'email',
      'age',
      'score',
      'active',
      'password',
      'metadata',
      'profile',
    ])
    expect(Object.keys(component.update.properties as Record<string, unknown>)).toEqual([
      'name',
      'email',
      'age',
      'score',
      'active',
      'password',
      'metadata',
      'profile',
    ])
    expect(Object.keys(component.output.properties as Record<string, unknown>)).toEqual([
      'id',
      'name',
      'email',
      'age',
      'score',
      'active',
      'createdAt',
      'metadata',
      'profile',
    ])
  })

  it('omits serverOnly fields from every usage', () => {
    const component = User.toOpenAPIComponent()

    expect(component.create.properties).not.toHaveProperty('passwordHash')
    expect(component.update.properties).not.toHaveProperty('passwordHash')
    expect(component.output.properties).not.toHaveProperty('passwordHash')
  })

  it('marks writeOnly fields on input schemas and omits them from output', () => {
    const component = User.toOpenAPIComponent()

    expect(
      (component.create.properties as Record<string, Record<string, unknown>>).password,
    ).toMatchObject({
      type: 'string',
      minLength: 8,
      writeOnly: true,
    })
    expect(
      (component.update.properties as Record<string, Record<string, unknown>>).password,
    ).toMatchObject({
      writeOnly: true,
    })
    expect(component.output.properties).not.toHaveProperty('password')
  })

  it('marks readOnly fields on output and omits them from input schemas', () => {
    const component = User.toOpenAPIComponent()

    expect(component.create.properties).not.toHaveProperty('id')
    expect(component.update.properties).not.toHaveProperty('id')
    expect(component.create.properties).not.toHaveProperty('createdAt')
    expect(component.update.properties).not.toHaveProperty('createdAt')
    expect(
      (component.output.properties as Record<string, Record<string, unknown>>).id,
    ).toMatchObject({
      type: 'string',
      format: 'uuid',
      readOnly: true,
    })
    expect(
      (component.output.properties as Record<string, Record<string, unknown>>).createdAt,
    ).toMatchObject({
      type: 'string',
      format: 'date-time',
      readOnly: true,
    })
  })

  it('reflects create/update required semantics', () => {
    const component = User.toOpenAPIComponent()

    expect(component.create.required).toEqual(['name', 'email', 'password'])
    expect(component.update).not.toHaveProperty('required')
    expect(component.output.required).toEqual(['id', 'name', 'email'])
  })

  it('generates a single usage schema', () => {
    expect(User.toOpenAPISchema('create')).toEqual(User.toOpenAPIComponent().create)
    expect(User.toOpenAPISchema('update')).toEqual(User.toOpenAPIComponent().update)
    expect(User.toOpenAPISchema('output')).toEqual(User.toOpenAPIComponent().output)
  })

  it('maps scalar field metadata to OpenAPI properties', () => {
    const properties = User.toOpenAPIComponent().create.properties as Record<
      string,
      Record<string, unknown>
    >

    expect(properties.name).toEqual({ type: 'string', minLength: 1, maxLength: 100 })
    expect(properties.email).toEqual({ type: 'string', format: 'email' })
    expect(properties.age).toEqual({ type: 'integer', minimum: 0, maximum: 150, nullable: true })
    expect(properties.score).toEqual({ type: 'number', minimum: 0, maximum: 1 })
    expect(properties.active).toEqual({ type: 'boolean' })
    expect(properties.metadata).toEqual({ nullable: true })
    expect(properties.profile).toEqual({
      nullable: true,
      type: 'object',
      properties: {
        foo: { type: 'string' },
        count: { type: 'integer' },
        flags: { type: 'array', items: { type: 'boolean' } },
        labels: { type: 'object', additionalProperties: { type: 'string' } },
        note: { type: 'string', nullable: true },
      },
      required: ['foo', 'labels'],
    })
  })

  it('converts a Zod 4 JSON schema subset to OpenAPI', () => {
    const Zod4Payload = defineModel('zod4_payloads', {
      payload: t.json(
        z4.object({
          title: z4.string().min(3).max(40),
          count: z4.number().int(),
          flags: z4.array(z4.boolean()),
          labels: z4.record(z4.string(), z4.string()),
          note: z4.string().nullable().optional(),
        }) as unknown as z.ZodTypeAny,
      ),
    })

    const properties = Zod4Payload.toOpenAPISchema('create').properties as Record<
      string,
      Record<string, unknown>
    >

    expect(properties.payload).toEqual({
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 3, maxLength: 40 },
        count: { type: 'integer' },
        flags: { type: 'array', items: { type: 'boolean' } },
        labels: { type: 'object', additionalProperties: { type: 'string' } },
        note: { type: 'string', nullable: true },
      },
      required: ['title', 'count', 'flags', 'labels'],
    })
  })

  it('matches snapshot', () => {
    expect(User.toOpenAPIComponent()).toMatchSnapshot()
  })

  it('omits relation fields from OpenAPI schema', () => {
    const PostModel = { fields: { id: t.integer(), title: t.string() }, tableName: 'posts' }
    const UserWithRelation = defineModel('users', {
      id: t.uuid().primary().readOnly(),
      name: t.string(),
      posts: t.hasMany(PostModel, { foreignKey: 'userId' }),
    })

    const component = UserWithRelation.toOpenAPIComponent()

    expect(component.create.properties).not.toHaveProperty('posts')
    expect(component.update.properties).not.toHaveProperty('posts')
    expect(component.output.properties).not.toHaveProperty('posts')
    expect(component.output.properties).toHaveProperty('id')
    expect(component.output.properties).toHaveProperty('name')
  })
})

describe('toOpenAPISchema with { with } option', () => {
  const Post = defineModel('posts', {
    id: t.integer().primary().readOnly(),
    title: t.string(),
    userId: t.integer(),
  })

  const User = defineModel('users', {
    id: t.uuid().primary().readOnly(),
    name: t.string(),
    posts: t.hasMany(() => Post, { foreignKey: 'userId' }),
  })

  it('toOpenAPISchema("output") without with does not include relation', () => {
    const schema = User.toOpenAPISchema('output')
    expect(schema.properties).not.toHaveProperty('posts')
  })

  it('toOpenAPISchema("output", { with: { posts: true } }) expands hasMany as array', () => {
    const schema = User.toOpenAPISchema('output', { with: { posts: true } })
    const properties = schema.properties as Record<string, Record<string, unknown>>
    expect(properties).toHaveProperty('posts')
    const postsSchema = properties['posts']!
    expect(postsSchema.type).toBe('array')
    const items = postsSchema['items'] as Record<string, unknown>
    expect(items.type).toBe('object')
    const itemProperties = items['properties'] as Record<string, unknown>
    expect(itemProperties).toHaveProperty('id')
    expect(itemProperties).toHaveProperty('title')
    expect(itemProperties).toHaveProperty('userId')
  })

  it('toOpenAPISchema("output", { with: { author: true } }) expands belongsTo as nullable object', () => {
    const PostWithAuthor = defineModel('posts', {
      id: t.integer().primary().readOnly(),
      title: t.string(),
      userId: t.integer(),
      author: t.belongsTo(User, { foreignKey: 'userId' }),
    })

    const schema = PostWithAuthor.toOpenAPISchema('output', { with: { author: true } })
    const properties = schema.properties as Record<string, Record<string, unknown>>
    expect(properties).toHaveProperty('author')
    const authorSchema = properties['author']!
    expect(authorSchema.type).toBe('object')
    expect(authorSchema.nullable).toBe(true)
    const authorProperties = authorSchema['properties'] as Record<string, unknown>
    expect(authorProperties).toHaveProperty('id')
    expect(authorProperties).toHaveProperty('name')
  })

  it('toOpenAPISchema("create") with relation field does not include relation', () => {
    const schema = User.toOpenAPISchema('create')
    expect(schema.properties).not.toHaveProperty('posts')
  })

  it('create + with: { posts: true } does not expand relation', () => {
    // usage が 'output' 以外の場合は with オプションを渡しても relation は展開されない
    const schema = User.toOpenAPISchema('create' as any, { with: { posts: true } })
    expect(schema.properties).not.toHaveProperty('posts')
  })

  it('does not recurse infinitely with bidirectional relations (depth 1 only)', () => {
    const PostBi = defineModel('posts', {
      id: t.integer().primary().readOnly(),
      title: t.string(),
      userId: t.uuid(),
      author: t.belongsTo(User, { foreignKey: 'userId' }),
    })

    const UserBi = defineModel('users', {
      id: t.uuid().primary().readOnly(),
      name: t.string(),
      posts: t.hasMany(() => PostBi, { foreignKey: 'userId' }),
    })

    expect(() => {
      const schema = UserBi.toOpenAPISchema('output', { with: { posts: true } })
      const properties = schema.properties as Record<string, Record<string, unknown>>
      const postsSchema = properties['posts']!
      const items = postsSchema['items'] as Record<string, unknown>
      const itemProperties = items['properties'] as Record<string, unknown>
      expect(itemProperties).not.toHaveProperty('author')
    }).not.toThrow()
  })
})
