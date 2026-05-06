import type { Field, FieldModifiers } from '../field'

export function renderField(
  fieldName: string,
  field: Field<unknown, FieldModifiers>,
): string | null {
  if (field.kind === 'relation') return null

  const lines: string[] = []

  const kind = field.kind
  let colType: string

  if (kind === 'string' || kind === 'uuid') {
    colType = `text('${fieldName}')`
  } else if (kind === 'number') {
    colType = `real('${fieldName}')`
  } else if (kind === 'integer') {
    colType = `integer('${fieldName}')`
  } else if (kind === 'boolean') {
    colType = `integer('${fieldName}', { mode: 'boolean' })`
  } else if (kind === 'timestamp') {
    colType = `integer('${fieldName}', { mode: 'timestamp_ms' })`
  } else if (kind === 'json') {
    colType = `text('${fieldName}', { mode: 'json' }).$type<unknown>()`
  } else {
    throw new Error(`Unknown field kind: ${kind}`)
  }

  let column = colType

  if (field.modifiers.primary) {
    column += '.primaryKey()'
  }

  if (!field.modifiers.optional) {
    column += '.notNull()'
  }

  if (field.modifiers.unique) {
    column += '.unique()'
  }

  if (field.modifiers.hasDefault) {
    const defaultValue = field.modifiers.defaultValue
    if (typeof defaultValue === 'function') {
      console.warn(
        `[nanoka] Warning: field "${fieldName}" has a function default. Default clause will be omitted. ` +
          `Use Drizzle's $defaultFn() or .onUpdateCurrent() in your custom schema if needed.`,
      )
    } else {
      const serializedValue = JSON.stringify(defaultValue)
      column += `.default(${serializedValue})`
    }
  }

  lines.push(`  ${fieldName}: ${column},`)
  return lines.join('\n')
}
