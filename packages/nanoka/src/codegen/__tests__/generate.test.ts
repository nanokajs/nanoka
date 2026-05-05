import { describe, expect, it } from 'vitest'
import { t } from '../../field'
import { generateDrizzleSchema } from '../generate'
import type { ModelDef } from '../types'

describe('generateDrizzleSchema', () => {
  it('generates schema for single model with all field types', () => {
    const models: ModelDef[] = [
      {
        name: 'users',
        fields: {
          id: t.uuid().primary(),
          name: t.string(),
          email: t.string().email().unique(),
          age: t.integer(),
          score: t.number(),
          active: t.boolean(),
          createdAt: t.timestamp(),
          metadata: t.json(),
        },
      },
    ]

    const result = generateDrizzleSchema(models)
    expect(result).toMatchSnapshot()
  })

  it('generates schema for multiple models', () => {
    const models: ModelDef[] = [
      {
        name: 'users',
        fields: {
          id: t.uuid().primary(),
          name: t.string(),
        },
      },
      {
        name: 'posts',
        fields: {
          id: t.uuid().primary(),
          title: t.string(),
          content: t.string(),
        },
      },
    ]

    const result = generateDrizzleSchema(models)
    expect(result).toMatchSnapshot()
  })

  it('handles optional fields', () => {
    const models: ModelDef[] = [
      {
        name: 'users',
        fields: {
          id: t.uuid().primary(),
          name: t.string(),
          nickname: t.string().optional(),
        },
      },
    ]

    const result = generateDrizzleSchema(models)
    expect(result).toMatchSnapshot()
  })

  it('handles default values (literal)', () => {
    const models: ModelDef[] = [
      {
        name: 'posts',
        fields: {
          id: t.uuid().primary(),
          title: t.string(),
          status: t.string().default('draft'),
          count: t.integer().default(0),
          active: t.boolean().default(true),
        },
      },
    ]

    const result = generateDrizzleSchema(models)
    expect(result).toMatchSnapshot()
  })

  it('handles function defaults with warning', () => {
    const originalWarn = console.warn
    const warnings: string[] = []
    ;(console.warn as any) = (...args: any[]) => {
      warnings.push(args.join(' '))
    }

    try {
      const models: ModelDef[] = [
        {
          name: 'posts',
          fields: {
            id: t.uuid().primary(),
            title: t.string(),
            createdAt: t.timestamp().default(() => new Date()),
          },
        },
      ]

      const result = generateDrizzleSchema(models)

      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings[0]).toContain('function default')
      expect(result).toMatchSnapshot()
    } finally {
      console.warn = originalWarn
    }
  })

  it('handles combined modifiers', () => {
    const models: ModelDef[] = [
      {
        name: 'users',
        fields: {
          id: t.uuid().primary(),
          email: t.string().email().unique(),
          phone: t.string().optional().unique(),
          status: t.string().default('active'),
        },
      },
    ]

    const result = generateDrizzleSchema(models)
    expect(result).toMatchSnapshot()
  })

  it('handles empty models array', () => {
    const models: ModelDef[] = []

    const result = generateDrizzleSchema(models)
    expect(result).toMatchSnapshot()
  })

  it('generates correct imports for used types', () => {
    const models: ModelDef[] = [
      {
        name: 'metrics',
        fields: {
          id: t.uuid().primary(),
          value: t.number(),
          timestamp: t.timestamp(),
        },
      },
    ]

    const result = generateDrizzleSchema(models)
    expect(result).toContain('import { integer, real, sqliteTable, text }')
    expect(result).toContain('export const metrics')
  })

  it('preserves field order in model', () => {
    const models: ModelDef[] = [
      {
        name: 'ordered',
        fields: {
          z: t.string(),
          a: t.string(),
          m: t.string(),
        },
      },
    ]

    const result = generateDrizzleSchema(models)
    expect(result).toMatchSnapshot()
  })

  it('handles string with min/max constraints', () => {
    const models: ModelDef[] = [
      {
        name: 'users',
        fields: {
          id: t.uuid().primary(),
          username: t.string().min(3).max(20),
        },
      },
    ]

    const result = generateDrizzleSchema(models)
    expect(result).toMatchSnapshot()
  })

  it('handles integer with min/max constraints', () => {
    const models: ModelDef[] = [
      {
        name: 'stats',
        fields: {
          id: t.uuid().primary(),
          score: t.integer().min(0).max(100),
        },
      },
    ]

    const result = generateDrizzleSchema(models)
    expect(result).toMatchSnapshot()
  })

  it('omits relation fields from generated schema', () => {
    const PostModel = { fields: { id: t.integer(), title: t.string() }, tableName: 'posts' }
    const models: ModelDef[] = [
      {
        name: 'users',
        fields: {
          id: t.uuid().primary(),
          name: t.string(),
          posts: t.hasMany(PostModel, { foreignKey: 'userId' }),
        },
      },
    ]

    const result = generateDrizzleSchema(models)
    expect(result).not.toContain('posts')
    expect(result).toContain('id')
    expect(result).toContain('name')
  })
})
