import { type SQLiteTableWithColumns, sqliteTable } from 'drizzle-orm/sqlite-core'
import type { Field } from '../field/types'

/**
 * Constructs a Drizzle SQLiteTable from a tableName and fields.
 * Each field is converted to a Drizzle column via field.drizzleColumn(key).
 * @internal
 */
export function buildTable(
  tableName: string,
  fields: Record<string, Field<any, any, any>>,
): SQLiteTableWithColumns<any> {
  const columns: Record<string, any> = {}
  for (const [key, field] of Object.entries(fields)) {
    columns[key] = field.drizzleColumn(key)
  }
  return sqliteTable(tableName, columns)
}
