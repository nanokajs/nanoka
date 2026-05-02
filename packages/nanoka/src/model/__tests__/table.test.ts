import { describe, expect, it } from 'vitest'
import { t } from '../../field'
import { buildTable } from '../table'

describe('buildTable()', () => {
  it('constructs a SQLiteTable from tableName and fields', () => {
    const fields = {
      id: t.uuid().primary(),
      name: t.string(),
      email: t.string().email(),
    }

    const table = buildTable('users', fields)

    expect(table).toBeDefined()
    // Table object has field keys as properties
    expect('id' in table).toBe(true)
    expect('name' in table).toBe(true)
    expect('email' in table).toBe(true)
  })

  it('includes all fields as columns in the table', () => {
    const fields = {
      id: t.uuid().primary(),
      name: t.string(),
      email: t.string().email(),
      count: t.integer(),
    }

    const table = buildTable('items', fields)

    expect(table).toBeDefined()
    // Check that all keys are present in the table
    expect('id' in table).toBe(true)
    expect('name' in table).toBe(true)
    expect('email' in table).toBe(true)
    expect('count' in table).toBe(true)
  })

  it('respects field modifiers (primary, email, etc)', () => {
    const fields = {
      id: t.uuid().primary(),
      email: t.string().email(),
      optional_field: t.string().optional(),
    }

    const table = buildTable('users', fields)

    expect(table).toBeDefined()
    // Table should have all fields
    expect('id' in table).toBe(true)
    expect('email' in table).toBe(true)
    expect('optional_field' in table).toBe(true)

    // Verify primary modifier is applied to the drizzle column
    // biome-ignore lint/suspicious/noExplicitAny: accessing drizzle internal column properties
    const idColumn = (table as any).id
    expect(idColumn.primary).toBe(true)

    // Verify optional modifier is applied (NOT NULL constraint should be absent)
    // biome-ignore lint/suspicious/noExplicitAny: accessing drizzle internal column properties
    const optionalColumn = (table as any).optional_field
    expect(optionalColumn.notNull).not.toBe(true)
  })
})
