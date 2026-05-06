import { and, asc, desc, eq, inArray, SQL } from 'drizzle-orm'
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import { HTTPException } from 'hono/http-exception'
import type { Adapter } from '../adapter/types'
import type { Field, RelationDef, RelationTargetLike } from '../field/types'
import { buildTable } from './table'
import type {
  CreateInput,
  FindAllOptions,
  FindOneOptions,
  IdOrWhere,
  OrderBy,
  RowType,
  Where,
  WithOptions,
  WithResult,
} from './types'

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

function resolveRelationTarget(field: RelationDef): RelationTargetLike {
  return typeof field.target === 'function' ? field.target() : field.target
}

function getTargetTable(target: RelationTargetLike): SQLiteTableWithColumns<any> {
  if (Object.hasOwn(target, 'table')) {
    return (target as unknown as { table: SQLiteTableWithColumns<any> }).table
  }
  return buildTable(target.tableName, target.fields as Record<string, Field<any, any, any>>)
}

function validateWithOptions(
  fields: Record<string, Field<any, any, any>>,
  withOptions: Record<string, unknown>,
): void {
  if (withOptions === null || typeof withOptions !== 'object' || Array.isArray(withOptions)) {
    throw new HTTPException(400, { message: 'invalid with option' })
  }

  for (const [key, value] of Object.entries(withOptions)) {
    if (value !== true) {
      throw new HTTPException(400, { message: 'nested with is not supported' })
    }
    if (!Object.hasOwn(fields, key) || fields[key]?.kind !== 'relation') {
      throw new HTTPException(400, { message: 'invalid relation in with option' })
    }
  }
}

const relationCycleCache = new WeakMap<object, Error | null>()

function assertNoRelationCycle(
  fields: Record<string, Field<any, any, any>>,
  rootName = 'root',
): void {
  const cached = relationCycleCache.get(fields)
  if (cached !== undefined) {
    if (cached !== null) throw cached
    return
  }

  const visiting = new Set<object>()
  const visited = new Set<object>()

  const visit = (
    currentFields: Record<string, Field<any, any, any>>,
    path: readonly string[],
  ): Error | null => {
    if (visiting.has(currentFields)) {
      return new HTTPException(500, { message: 'relation cycle detected' })
    }
    if (visited.has(currentFields)) {
      return null
    }

    visiting.add(currentFields)
    for (const field of Object.values(currentFields)) {
      if (field.kind !== 'relation') continue

      const target = resolveRelationTarget(field as RelationDef)
      const targetFields = target.fields as Record<string, Field<any, any, any>>
      const error = visit(targetFields, [...path, target.tableName])
      if (error !== null) {
        return error
      }
    }
    visiting.delete(currentFields)
    visited.add(currentFields)
    return null
  }

  const error = visit(fields, [rootName])
  relationCycleCache.set(fields, error)
  if (error !== null) {
    throw error
  }
}

async function loadRelations<
  Fields extends Record<string, Field<any, any, any>>,
  With extends WithOptions<Fields>,
>(
  adapter: Adapter,
  _parentTable: SQLiteTableWithColumns<any>,
  parentFields: Fields,
  parentRows: RowType<Fields>[],
  withOptions: With,
): Promise<WithResult<Fields, With>[]> {
  if (parentRows.length === 0) {
    return []
  }

  const rows = parentRows.map((row) => ({ ...row })) as WithResult<Fields, With>[]

  for (const relationKey of Object.keys(withOptions)) {
    const field = parentFields[relationKey]
    if (field?.kind !== 'relation') {
      throw new HTTPException(400, { message: 'invalid relation in with option' })
    }

    const relation = field as RelationDef
    const target = resolveRelationTarget(relation)
    const targetFields = target.fields as Record<string, Field<any, any, any>>
    const targetTable = getTargetTable(target)

    if (relation.relationKind === 'hasMany') {
      const parentPk = findPrimaryKey(parentFields)
      if (!parentPk) {
        throw new HTTPException(500, { message: 'model has no primary key' })
      }
      const parentPkKey = parentPk[0]
      const foreignKey = relation.foreignKey
      if (!Object.hasOwn(targetFields, foreignKey) || !Object.hasOwn(targetTable, foreignKey)) {
        throw new HTTPException(500, { message: 'invalid relation foreign key' })
      }

      const parentIds = Array.from(
        new Set(parentRows.map((row) => (row as Record<string, unknown>)[parentPkKey])),
      )
      const targetRows =
        parentIds.length === 0
          ? []
          : await adapter.drizzle
              .select()
              .from(targetTable)
              .where(
                inArray(
                  (targetTable as unknown as Record<string, any>)[foreignKey],
                  parentIds as any[],
                ),
              )

      const grouped = new Map<unknown, unknown[]>()
      for (const targetRow of targetRows as Record<string, unknown>[]) {
        const value = targetRow[foreignKey]
        const group = grouped.get(value)
        if (group === undefined) {
          grouped.set(value, [targetRow])
        } else {
          group.push(targetRow)
        }
      }

      for (const row of rows as Record<string, unknown>[]) {
        row[relationKey] = grouped.get(row[parentPkKey]) ?? []
      }
    } else {
      const foreignKey = relation.foreignKey
      if (!Object.hasOwn(parentFields, foreignKey) || !Object.hasOwn(_parentTable, foreignKey)) {
        throw new HTTPException(500, { message: 'invalid relation foreign key' })
      }

      const targetPk = findPrimaryKey(targetFields)
      if (!targetPk) {
        throw new HTTPException(500, { message: 'model has no primary key' })
      }
      const targetPkKey = targetPk[0]
      if (!Object.hasOwn(targetTable, targetPkKey)) {
        throw new HTTPException(500, { message: 'invalid relation primary key' })
      }

      const parentFkValues = Array.from(
        new Set(parentRows.map((row) => (row as Record<string, unknown>)[foreignKey])),
      )
      const targetRows =
        parentFkValues.length === 0
          ? []
          : await adapter.drizzle
              .select()
              .from(targetTable)
              .where(
                inArray(
                  (targetTable as unknown as Record<string, any>)[targetPkKey],
                  parentFkValues as any[],
                ),
              )

      const byPk = new Map<unknown, unknown>()
      for (const targetRow of targetRows as Record<string, unknown>[]) {
        byPk.set(targetRow[targetPkKey], targetRow)
      }

      for (const row of rows as Record<string, unknown>[]) {
        row[relationKey] = byPk.get(row[foreignKey]) ?? null
      }
    }
  }

  return rows
}

/**
 * Fetches multiple rows with limit, offset, optional ordering, and optional where clause.
 * @internal
 */
export async function findManyImpl<
  // biome-ignore lint/suspicious/noExplicitAny: any is necessary for Field constraint
  Fields extends Record<string, Field<any, any, any>>,
  With extends WithOptions<Fields> | undefined = undefined,
>(
  adapter: Adapter,
  table: SQLiteTableWithColumns<any>,
  fields: Fields,
  options: {
    limit: unknown
    offset?: unknown
    orderBy?: OrderBy<Fields>
    where?: Where<Fields> | SQL
    with?: With
  },
): Promise<RowType<Fields>[] | WithResult<Fields, NonNullable<With>>[]> {
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
  if (options.with !== undefined) {
    validateWithOptions(fields, options.with as Record<string, unknown>)
    assertNoRelationCycle(fields)
    return loadRelations(adapter, table, fields, rows, options.with as NonNullable<With>)
  }
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
  options?: FindOneOptions<Fields>,
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

  if (options?.with !== undefined) {
    validateWithOptions(fields, options.with as Record<string, unknown>)
    assertNoRelationCycle(fields)
  }

  // biome-ignore lint/suspicious/noExplicitAny: drizzle query type
  const rows = await (adapter.drizzle.select().from(table).where(whereClause).limit(1) as any)
  if (rows.length === 0) {
    return null
  }
  if (options?.with !== undefined) {
    const withRows = await loadRelations(adapter, table, fields, [rows[0]], options.with)
    return withRows[0] ?? null
  }
  return rows[0]
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
