import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { t } from '../../field'
import { defineModel } from '../../model'
import { toOpenAPISchema } from '../generate'

describe('zodToOpenAPISchema — unsupported Zod types', () => {
  const unsupportedCases = [
    {
      name: 'ZodEffects (refine)',
      schema: z.string().refine(() => true),
    },
    {
      name: 'ZodEffects (preprocess)',
      schema: z.preprocess((v) => v, z.string()),
    },
    {
      name: 'ZodBranded',
      schema: z.string().brand<'MyBrand'>(),
    },
    {
      name: 'ZodDiscriminatedUnion',
      schema: z.discriminatedUnion('type', [
        z.object({ type: z.literal('a') }),
        z.object({ type: z.literal('b') }),
      ]),
    },
    {
      name: 'ZodUnion',
      schema: z.union([z.string(), z.number()]),
    },
    {
      name: 'ZodTuple',
      schema: z.tuple([z.string(), z.number()]),
    },
    {
      name: 'ZodLazy',
      schema: z.lazy(() => z.string()),
    },
  ]

  for (const { name, schema } of unsupportedCases) {
    it(`default: includes x-nanoka-zod-unsupported for ${name}`, () => {
      const Model = defineModel('test_model', {
        field: t.json(schema as unknown as z.ZodTypeAny),
      })

      const result = Model.toOpenAPISchema('create')
      const properties = result.properties as Record<string, Record<string, unknown>>
      // biome-ignore lint/style/noNonNullAssertion: test assertion
      expect(properties.field!['x-nanoka-zod-unsupported']).toBe(true)
    })

    it(`strict: true throws for ${name}`, () => {
      const fields = {
        field: t.json(schema as unknown as z.ZodTypeAny),
      }

      expect(() => toOpenAPISchema(fields, 'create', { strict: true })).toThrow(
        /Unsupported Zod type for strict OpenAPI generation/,
      )
    })
  }
})
