import {
  type AnySQLiteColumn,
  type SQLiteTableWithColumns,
  sqliteTable,
} from 'drizzle-orm/sqlite-core'
import type { Field } from '../field/types'
import type { NonRelationKeys } from './types'

// biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
type ModelTable<Fields extends Record<string, Field<any, any, any>>> = SQLiteTableWithColumns<{
  name: string
  schema: undefined
  columns: { [K in NonRelationKeys<Fields>]: AnySQLiteColumn }
  dialect: 'sqlite'
}>

/**
 * Constructs a Drizzle SQLiteTable from a tableName and fields.
 * Each field is converted to a Drizzle column via field.drizzleColumn(key).
 * @internal
 */
// biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
export function buildTable<Fields extends Record<string, Field<any, any, any>>>(
  tableName: string,
  fields: Fields,
): ModelTable<Fields> {
  const columns: Record<string, any> = {}
  for (const [key, field] of Object.entries(fields)) {
    if (field.kind === 'relation') continue
    columns[key] = field.drizzleColumn(key)
  }
  return sqliteTable(tableName, columns) as unknown as ModelTable<Fields>
}
