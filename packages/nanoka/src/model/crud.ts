import { and, asc, desc, eq, SQL } from 'drizzle-orm'
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import { HTTPException } from 'hono/http-exception'
import type { Adapter } from '../adapter/types'
import type { Field } from '../field/types'
import type { CreateInput, FindAllOptions, IdOrWhere, OrderBy, RowType, Where } from './types'

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
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  fields: Record<string, Field<any, any, any>>,
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
): [string, Field<any, any, any>] | null {
  let pkKey: string | undefined
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  let pkField: Field<any, any, any> | undefined
  let pkCount = 0

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
  if (pkKey === undefined || pkField === undefined) {
    return null
  }

  return [pkKey, pkField]
}

/**
 * Constructs a Drizzle where clause from an object.
 * All entries are combined with AND.
 * @internal
 */
function buildWhereClause(
  table: SQLiteTableWithColumns<any>,
  fields: Record<string, Field<any, any, any>>,
  where: Where<Record<string, any>>,
): ReturnType<typeof and> | null {
  const conditions: ReturnType<typeof eq>[] = []

  for (const [key, value] of Object.entries(where)) {
    // Multi-layered guard against identifier injection
    if (!Object.hasOwn(fields, key)) {
      throw new HTTPException(400, { message: 'invalid field in where clause' })
    }
    if (!Object.hasOwn(table, key)) {
      throw new HTTPException(400, { message: 'invalid column in table' })
    }
    // biome-ignore lint/suspicious/noExplicitAny: table column access is runtime-guarded by hasOwn
    const col = (table as unknown as Record<string, any>)[key]
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
 * Fetches multiple rows with limit, offset, optional ordering, and optional where clause.
 * @internal
 */
export async function findManyImpl<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
>(
  adapter: Adapter,
  table: SQLiteTableWithColumns<any>,
  fields: Fields,
  options: {
    limit: unknown
    offset?: unknown
    orderBy?: OrderBy<Fields>
    where?: Where<Fields> | SQL
  },
): Promise<RowType<Fields>[]> {
  const limit = guardLimit(options.limit)
  const offset = options.offset !== undefined ? guardOffset(options.offset) : 0

  // biome-ignore lint/suspicious/noExplicitAny: drizzle query builder type narrowing
  let query: any = adapter.drizzle.select().from(table).limit(limit).offset(offset)

  // Apply where clause
  if (options.where !== undefined) {
    if (options.where instanceof SQL) {
      query = query.where(options.where)
    } else {
      const whereClause = buildWhereClause(
        table,
        fields,
        options.where as Where<Record<string, any>>,
      )
      if (whereClause !== null) {
        query = query.where(whereClause)
      }
    }
  }

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

      // Runtime guard against identifier injection (both fields and table to match where-clause guard)
      if (!Object.hasOwn(fields, column) || !Object.hasOwn(table, column)) {
        throw new HTTPException(400, { message: 'invalid field in orderBy' })
      }

      // biome-ignore lint/suspicious/noExplicitAny: table column access is runtime-guarded by hasOwn
      const col = (table as unknown as Record<string, any>)[column]
      query = query.orderBy(direction === 'asc' ? asc(col) : desc(col))
    }
  }

  const rows = await query
  return rows
}

/**
 * Fetches all rows without a LIMIT clause.
 * For batch processing / admin tooling. Apply an app-level size guard when used in request handlers.
 * @internal
 */
export async function findAllImpl<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
>(
  adapter: Adapter,
  table: SQLiteTableWithColumns<any>,
  fields: Fields,
  options?: FindAllOptions<Fields>,
): Promise<RowType<Fields>[]> {
  const offset = options?.offset !== undefined ? guardOffset(options.offset) : undefined

  // SQLite requires LIMIT when OFFSET is used.
  // Number.MAX_SAFE_INTEGER is used as a sentinel "no practical limit" value when offset is specified.
  // biome-ignore lint/suspicious/noExplicitAny: drizzle query builder type narrowing
  let query: any =
    offset !== undefined
      ? adapter.drizzle.select().from(table).limit(Number.MAX_SAFE_INTEGER).offset(offset)
      : adapter.drizzle.select().from(table)

  // Apply where clause
  if (options?.where !== undefined) {
    if (options.where instanceof SQL) {
      query = query.where(options.where)
    } else {
      const whereClause = buildWhereClause(
        table,
        fields,
        options.where as Where<Record<string, any>>,
      )
      if (whereClause !== null) {
        query = query.where(whereClause)
      }
    }
  }

  // Apply ordering
  if (options?.orderBy !== undefined) {
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

      // Runtime guard against identifier injection (both fields and table to match where-clause guard)
      if (!Object.hasOwn(fields, column) || !Object.hasOwn(table, column)) {
        throw new HTTPException(400, { message: 'invalid field in orderBy' })
      }

      // biome-ignore lint/suspicious/noExplicitAny: table column access is runtime-guarded by hasOwn
      const col = (table as unknown as Record<string, any>)[column]
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
  table: SQLiteTableWithColumns<any>,
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
  table: SQLiteTableWithColumns<any>,
  data: CreateInput<Fields>,
): Promise<RowType<Fields>> {
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
  table: SQLiteTableWithColumns<any>,
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
  table: SQLiteTableWithColumns<any>,
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
