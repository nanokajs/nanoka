import type { BatchItem, BatchResponse } from 'drizzle-orm/batch'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

/**
 * Generic database adapter abstraction for SQLite-compatible databases.
 *
 * Permits implementations over D1, Turso/libSQL, and other SQLite-compatible backends
 * without requiring changes to core query path or router.
 *
 * The `drizzle` property deliberately exposes the raw Drizzle database instance,
 * adhering to rule #4 (escape hatch always open).
 *
 * The `TResultKind` generic is intentionally constrained to `any` to avoid
 * coupling adapter implementations to Drizzle's internal result kind type.
 */
export interface Adapter<TSchema extends Record<string, unknown> = Record<string, never>> {
  // biome-ignore lint/suspicious/noExplicitAny: intentional - runtime-determined result kind
  readonly drizzle: BaseSQLiteDatabase<'async', any, TSchema>

  /**
   * Executes multiple Drizzle queries in a single batch.
   * Returns results in the same order as the input.
   *
   * **重要**: 実装は `this` 非依存であること（`nanoka()` 内で thin wrapper として再公開されるため、
   * `this` バインディングが失われた状態で呼び出される可能性がある）。
   */
  batch<U extends BatchItem<'sqlite'>, T extends readonly [U, ...U[]]>(
    queries: T,
  ): Promise<BatchResponse<T>>
}
