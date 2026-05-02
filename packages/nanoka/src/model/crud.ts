import { HTTPException } from 'hono/http-exception'
import { asc, desc, eq, and } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { Adapter } from '../adapter/types'
import type { Field, InferFieldType } from '../field/types'
import type { CreateInput, IdOrWhere, RowType, Where } from './types'

const MAX_LIMIT = 100

/**
 * Validates and guards limit/offset parameters.
 * @internal
 */
function guardLimit(limit: unknown): number {
  if (!Number.isInteger(limit)) {
    throw new HTTPException(400, { message: 'limit must be an integer' })
  }
  const n = limit as number
  if (n < 0) {
    throw new HTTPException(400, { message: 'limit must be >= 0' })
  }
  if (n > MAX_LIMIT) {
    throw new HTTPException(400, { message: `limit must be <= ${MAX_LIMIT}` })
  }
  return n
}

function guardOffset(offset: unknown): number {
  if (!Number.isInteger(offset)) {
    throw new HTTPException(400, { message: 'offset must be an integer' })
  }
  const n = offset as number
  if (n < 0) {
    throw new HTTPException(400, { message: 'offset must be >= 0' })
  }
  return n
}

/**
 * Finds the primary key field from fields record.
 * @internal
 */
function findPrimaryKey(
  fields: Record<string, Field<any, any, any>>,
): [string, Field<any, any, any>] | null {
  let pkCount = 0
  let pkKey: string | null = null
  let pkField: Field<any, any, any> | null = null

  for (const [key, field] of Object.entries(fields)) {
    if (field.modifiers.primary === true) {
      pkCount++
      if (pkCount === 1) {
        pkKey = key
        pkField = field
      }
    }
  }

  if (pkCount === 0) {
    return null
  }
  if (pkCount > 1) {
    throw new HTTPException(500, { message: 'model has multiple primary keys' })
  }

  return [pkKey!, pkField!]
}

/**
 * Constructs a Drizzle where clause from an object.
 * All entries are combined with AND.
 * @internal
 */
function buildWhereClause(
  table: SQLiteTable,
  fields: Record<string, Field<any, any, any>>,
  where: Where<Record<string, any>>,
): ReturnType<typeof and> | null {
  const conditions: any[] = []

  for (const [key, value] of Object.entries(where)) {
    // Multi-layered guard against identifier injection
    if (!Object.hasOwn(fields, key)) {
      throw new HTTPException(400, { message: 'invalid field in where clause' })
    }
    if (!Object.hasOwn(table, key)) {
      throw new HTTPException(400, { message: 'invalid column in table' })
    }
    // biome-ignore lint/suspicious/noExplicitAny: table column access is runtime-guarded
    const col: any = (table as any)[key]
    conditions.push(eq(col, value))
  }

  if (conditions.length === 0) {
    return null
  }
  if (conditions.length === 1) {
    return conditions[0]
  }
  return and(...conditions)
}

/**
 * Fetches multiple rows with limit, offset, and optional ordering.
 * @internal
 */
export async function findManyImpl<Fields extends Record<string, Field<any, any, any>>>(
  adapter: Adapter,
  table: SQLiteTable,
  fields: Fields,
  options: {
    limit: unknown
    offset?: unknown
    orderBy?: any
  },
): Promise<RowType<Fields>[]> {
  const limit = guardLimit(options.limit)
  const offset = options.offset !== undefined ? guardOffset(options.offset) : 0

  // biome-ignore lint/suspicious/noExplicitAny: drizzle query builder type narrowing
  let query: any = adapter.drizzle.select().from(table).limit(limit).offset(offset)

  // Apply ordering
  if (options.orderBy !== undefined) {
    const orderByList = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy]

    for (const orderByItem of orderByList) {
      let column: string
      let direction: 'asc' | 'desc' = 'asc'

      if (typeof orderByItem === 'string') {
        column = orderByItem
      } else if (
        typeof orderByItem === 'object' &&
        orderByItem !== null &&
        'column' in orderByItem
      ) {
        column = orderByItem.column
        if (orderByItem.direction) {
          direction = orderByItem.direction
        }
      } else {
        throw new HTTPException(400, { message: 'invalid orderBy format' })
      }

      // Runtime guard against identifier injection
      if (!Object.hasOwn(table, column)) {
        throw new HTTPException(400, { message: 'invalid field in orderBy' })
      }

      // biome-ignore lint/suspicious/noExplicitAny: table column access is runtime-guarded
      const col: any = (table as any)[column]
      query = query.orderBy(direction === 'asc' ? asc(col) : desc(col))
    }
  }

  const rows = await query
  return rows
}

/**
 * Fetches a single row by primary key or where clause.
 * @internal
 */
export async function findOneImpl<Fields extends Record<string, Field<any, any, any>>>(
  adapter: Adapter,
  table: SQLiteTable,
  fields: Fields,
  idOrWhere: IdOrWhere<Fields>,
): Promise<RowType<Fields> | null> {
  let where: Where<Fields> | null = null

  if (typeof idOrWhere === 'string' || typeof idOrWhere === 'number') {
    // PK mode
    const pk = findPrimaryKey(fields)
    if (!pk) {
      throw new HTTPException(500, { message: 'model has no primary key' })
    }
    where = { [pk[0]]: idOrWhere } as Where<Fields>
  } else {
    where = idOrWhere as Where<Fields>
  }

  const whereClause = buildWhereClause(table, fields, where)
  if (!whereClause) {
    throw new HTTPException(400, { message: 'where clause must not be empty' })
  }

  // biome-ignore lint/suspicious/noExplicitAny: drizzle query type
  const rows = await (adapter.drizzle.select().from(table).where(whereClause).limit(1) as any)
  return rows.length > 0 ? rows[0] : null
}

/**
 * Creates a new row and returns the created record.
 * @internal
 */
export async function createImpl<Fields extends Record<string, Field<any, any, any>>>(
  adapter: Adapter,
  table: SQLiteTable,
  data: CreateInput<Fields>,
): Promise<RowType<Fields>> {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle query type
  const rows = await (adapter.drizzle
    .insert(table)
    .values(data as any)
    .returning() as any)
  return rows[0]
}

/**
 * Updates rows matching the given id or where clause.
 * @internal
 */
export async function updateImpl<Fields extends Record<string, Field<any, any, any>>>(
  adapter: Adapter,
  table: SQLiteTable,
  fields: Fields,
  idOrWhere: IdOrWhere<Fields>,
  data: Partial<RowType<Fields>>,
): Promise<RowType<Fields> | null> {
  let where: Where<Fields> | null = null

  if (typeof idOrWhere === 'string' || typeof idOrWhere === 'number') {
    // PK mode
    const pk = findPrimaryKey(fields)
    if (!pk) {
      throw new HTTPException(500, { message: 'model has no primary key' })
    }
    where = { [pk[0]]: idOrWhere } as Where<Fields>
  } else {
    where = idOrWhere as Where<Fields>
  }

  const whereClause = buildWhereClause(table, fields, where)
  if (!whereClause) {
    throw new HTTPException(400, { message: 'where clause must not be empty' })
  }

  // biome-ignore lint/suspicious/noExplicitAny: drizzle query type
  const rows = await (adapter.drizzle
    .update(table)
    .set(data as any)
    .where(whereClause)
    .returning() as any)
  return rows.length > 0 ? rows[0] : null
}

/**
 * Deletes rows matching the given id or where clause.
 * @internal
 */
export async function deleteImpl<Fields extends Record<string, Field<any, any, any>>>(
  adapter: Adapter,
  table: SQLiteTable,
  fields: Fields,
  idOrWhere: IdOrWhere<Fields>,
): Promise<{ readonly deleted: number }> {
  let where: Where<Fields> | null = null

  if (typeof idOrWhere === 'string' || typeof idOrWhere === 'number') {
    // PK mode
    const pk = findPrimaryKey(fields)
    if (!pk) {
      throw new HTTPException(500, { message: 'model has no primary key' })
    }
    where = { [pk[0]]: idOrWhere } as Where<Fields>
  } else {
    where = idOrWhere as Where<Fields>
  }

  const whereClause = buildWhereClause(table, fields, where)
  if (!whereClause) {
    throw new HTTPException(400, { message: 'where clause must not be empty' })
  }

  const result = await adapter.drizzle.delete(table).where(whereClause).returning()
  return { deleted: result.length }
}
