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
    expect(properties.age).toEqual({ type: 'integer', minimum: 0, maximum: 150 })
    expect(properties.score).toEqual({ type: 'number', minimum: 0, maximum: 1 })
    expect(properties.active).toEqual({ type: 'boolean' })
    expect(properties.metadata).toEqual({})
    expect(properties.profile).toEqual({
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
})
