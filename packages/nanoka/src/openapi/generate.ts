import type { Field, RelationDef } from '../field/types'
import { applySchemaOptions, buildBaseObject, derivePolicyOptions } from '../model/schema'
import type { SchemaOptions } from '../model/types'
import type {
  OpenAPIModelComponent,
  OpenAPISchemaObject,
  OpenAPIUsage,
  WithOpenAPIOption,
} from './types'

// biome-ignore lint/suspicious/noExplicitAny: OpenAPI generation accepts any concrete field builder.
type AnyField = Field<any, any, any>
type FieldsRecord = Record<string, AnyField>

interface OpenAPIOptions {
  readonly opts?: SchemaOptions
  readonly strict?: boolean
  readonly with?: WithOpenAPIOption
}

export function toOpenAPIComponent(
  fields: FieldsRecord,
  opts?: OpenAPIOptions,
): OpenAPIModelComponent {
  return {
    create: toOpenAPISchema(fields, 'create', opts),
    update: toOpenAPISchema(fields, 'update', opts),
    output: toOpenAPISchema(fields, 'output', opts),
  }
}

export function toOpenAPISchema(
  fields: FieldsRecord,
  usage: OpenAPIUsage,
  opts?: OpenAPIOptions,
): OpenAPISchemaObject {
  const policyUsage =
    usage === 'create' ? 'input-create' : usage === 'update' ? 'input-update' : 'output'
  const merged = derivePolicyOptions(fields, policyUsage, opts?.opts)
  const schema = applySchemaOptions(buildBaseObject(fields), merged)
  const shape = getZodObjectShape(schema)
  const properties: Record<string, OpenAPISchemaObject> = {}
  const required: string[] = []

  for (const [key, zodSchema] of Object.entries(shape)) {
    const field = fields[key]
    if (field === undefined) continue
    if (field.kind === 'relation') continue

    properties[key] = fieldToOpenAPISchema(field, opts?.strict)
    if (field.modifiers.policy === 'writeOnly' && (usage === 'create' || usage === 'update')) {
      properties[key].writeOnly = true
    }
    if (field.modifiers.policy === 'readOnly' && usage === 'output') {
      properties[key].readOnly = true
    }
    if (usage !== 'update' && isRequiredZodSchema(zodSchema)) {
      required.push(key)
    }
  }

  if (usage === 'output' && opts?.with !== undefined) {
    for (const [key, field] of Object.entries(fields)) {
      if (field.kind !== 'relation') continue
      if (opts.with[key] !== true) continue
      const relationField = field as unknown as RelationDef
      const rawTarget = relationField.target
      const targetModel = typeof rawTarget === 'function' ? rawTarget() : rawTarget
      const targetSchema = toOpenAPISchema(targetModel.fields as FieldsRecord, 'output')
      if (relationField.relationKind === 'hasMany') {
        properties[key] = { type: 'array', items: targetSchema }
      } else {
        properties[key] = { ...targetSchema, nullable: true }
      }
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

function fieldToOpenAPISchema(field: AnyField, strict = false): OpenAPISchemaObject {
  const schema: OpenAPISchemaObject =
    field.kind === 'json'
      ? zodToOpenAPISchema(field.zodBase, strict)
      : field.kind === 'string'
        ? { type: 'string' }
        : field.kind === 'uuid'
          ? { type: 'string', format: 'uuid' }
          : field.kind === 'number'
            ? { type: 'number' }
            : field.kind === 'integer'
              ? { type: 'integer' }
              : field.kind === 'boolean'
                ? { type: 'boolean' }
                : field.kind === 'timestamp'
                  ? { type: 'string', format: 'date-time' }
                  : {}

  if (field.modifiers.format === 'email') {
    schema.format = 'email'
  }
  if (field.modifiers.min !== undefined) {
    if (field.kind === 'string' || field.kind === 'uuid') {
      schema.minLength = field.modifiers.min
    } else {
      schema.minimum = field.modifiers.min
    }
  }
  if (field.modifiers.max !== undefined) {
    if (field.kind === 'string' || field.kind === 'uuid') {
      schema.maxLength = field.modifiers.max
    } else {
      schema.maximum = field.modifiers.max
    }
  }

  if (field.modifiers.optional) {
    schema.nullable = true
  }

  return schema
}

function zodToOpenAPISchema(schema: unknown, strict = false): OpenAPISchemaObject {
  const def = getZodDef(schema)
  if (def === undefined) return {}

  const typeName = getZodTypeName(def)

  if (typeName === 'ZodOptional' || typeName === 'optional') {
    return zodToOpenAPISchema(def.innerType, strict)
  }
  if (typeName === 'ZodDefault' || typeName === 'default') {
    return zodToOpenAPISchema(def.innerType, strict)
  }
  if (typeName === 'ZodNullable' || typeName === 'nullable') {
    return { ...zodToOpenAPISchema(def.innerType, strict), nullable: true }
  }

  if (typeName === 'ZodObject' || typeName === 'object') {
    const shape = getZodObjectShape(schema)
    const properties: Record<string, OpenAPISchemaObject> = {}
    const required: string[] = []

    for (const [key, childSchema] of Object.entries(shape)) {
      properties[key] = zodToOpenAPISchema(childSchema, strict)
      if (isRequiredZodSchema(childSchema)) {
        required.push(key)
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    }
  }

  if (typeName === 'ZodString' || typeName === 'string') {
    return applyStringChecks({ type: 'string' }, def)
  }

  if (typeName === 'ZodNumber' || typeName === 'number') {
    return applyNumberChecks({ type: hasIntegerCheck(def) ? 'integer' : 'number' }, def)
  }

  if (typeName === 'ZodBoolean' || typeName === 'boolean') {
    return { type: 'boolean' }
  }

  if (typeName === 'ZodArray' || typeName === 'array') {
    const itemSchema = def.element ?? def.type
    return {
      type: 'array',
      items: zodToOpenAPISchema(itemSchema, strict),
    }
  }

  if (typeName === 'ZodRecord' || typeName === 'record') {
    return {
      type: 'object',
      additionalProperties: zodToOpenAPISchema(def.valueType, strict),
    }
  }

  if (typeName === 'ZodUnknown' || typeName === 'unknown') {
    return {}
  }

  if (strict) {
    throw new Error(`Unsupported Zod type for strict OpenAPI generation: ${typeName ?? 'unknown'}`)
  }
  return {
    'x-nanoka-zod-unsupported': true,
    ...(typeName ? { 'x-nanoka-zod-type': typeName } : {}),
  }
}

function getZodObjectShape(schema: unknown): Record<string, unknown> {
  if (
    typeof schema === 'object' &&
    schema !== null &&
    'shape' in schema &&
    typeof schema.shape === 'object' &&
    schema.shape !== null
  ) {
    return schema.shape as Record<string, unknown>
  }

  if (
    typeof schema === 'object' &&
    schema !== null &&
    '_def' in schema &&
    typeof schema._def === 'object' &&
    schema._def !== null &&
    'shape' in schema._def
  ) {
    const shape = schema._def.shape
    return (typeof shape === 'function' ? shape() : shape) as Record<string, unknown>
  }

  return {}
}

function isRequiredZodSchema(schema: unknown): boolean {
  const def = getZodDef(schema)
  if (def === undefined) {
    return true
  }

  const typeName = getZodTypeName(def)
  return (
    typeName !== 'ZodOptional' &&
    typeName !== 'optional' &&
    typeName !== 'ZodDefault' &&
    typeName !== 'default'
  )
}

function getZodDef(schema: unknown): Record<string, unknown> | undefined {
  if (
    typeof schema === 'object' &&
    schema !== null &&
    '_def' in schema &&
    typeof schema._def === 'object' &&
    schema._def !== null
  ) {
    return schema._def as Record<string, unknown>
  }

  return undefined
}

function getZodTypeName(def: Record<string, unknown>): string | undefined {
  return typeof def.typeName === 'string'
    ? def.typeName
    : typeof def.type === 'string'
      ? def.type
      : undefined
}

function applyStringChecks(
  schema: OpenAPISchemaObject,
  def: Record<string, unknown>,
): OpenAPISchemaObject {
  for (const check of getZodChecks(def)) {
    const checkDef = getZodCheckDef(check)
    if (checkDef.kind === 'email' || checkDef.format === 'email') {
      schema.format = 'email'
    }
    if (checkDef.kind === 'min' && typeof checkDef.value === 'number') {
      schema.minLength = checkDef.value
    }
    if (checkDef.kind === 'max' && typeof checkDef.value === 'number') {
      schema.maxLength = checkDef.value
    }
    if (checkDef.check === 'min_length' && typeof checkDef.minimum === 'number') {
      schema.minLength = checkDef.minimum
    }
    if (checkDef.check === 'max_length' && typeof checkDef.maximum === 'number') {
      schema.maxLength = checkDef.maximum
    }
  }

  return schema
}

function applyNumberChecks(
  schema: OpenAPISchemaObject,
  def: Record<string, unknown>,
): OpenAPISchemaObject {
  for (const check of getZodChecks(def)) {
    const checkDef = getZodCheckDef(check)
    if (checkDef.kind === 'min' && typeof checkDef.value === 'number') {
      schema.minimum = checkDef.value
    }
    if (checkDef.kind === 'max' && typeof checkDef.value === 'number') {
      schema.maximum = checkDef.value
    }
    if (
      (checkDef.check === 'greater_than' || checkDef.check === 'number_format') &&
      typeof checkDef.minimum === 'number'
    ) {
      schema.minimum = checkDef.minimum
    }
    if (
      (checkDef.check === 'less_than' || checkDef.check === 'number_format') &&
      typeof checkDef.maximum === 'number'
    ) {
      schema.maximum = checkDef.maximum
    }
  }

  return schema
}

function hasIntegerCheck(def: Record<string, unknown>): boolean {
  return getZodChecks(def).some((check) => {
    const checkDef = getZodCheckDef(check)
    return (
      checkDef.kind === 'int' ||
      checkDef.format === 'safeint' ||
      checkDef.format === 'int32' ||
      checkDef.format === 'int64'
    )
  })
}

function getZodChecks(def: Record<string, unknown>): readonly unknown[] {
  return Array.isArray(def.checks) ? def.checks : []
}

function getZodCheckDef(check: unknown): Record<string, unknown> {
  if (typeof check !== 'object' || check === null) {
    return {}
  }
  if (
    '_zod' in check &&
    typeof check._zod === 'object' &&
    check._zod !== null &&
    'def' in check._zod &&
    typeof check._zod.def === 'object' &&
    check._zod.def !== null
  ) {
    return check._zod.def as Record<string, unknown>
  }

  return check as Record<string, unknown>
}
