import type { Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import type { Adapter } from './types'

/**
 * Turso/libSQL adapter factory. Wraps a libSQL Client in the generic Adapter
 * abstraction, making it a drop-in replacement for d1Adapter.
 *
 * `@libsql/client` is an optional peer dependency; callers are responsible
 * for installing it separately.
 */
export function tursoAdapter<TSchema extends Record<string, unknown> = Record<string, never>>(
  client: Client,
): Adapter<TSchema> {
  // biome-ignore lint/suspicious/noExplicitAny: intentional - Drizzle returns complex union type
  const db = drizzle(client) as any

  return {
    drizzle: db,
    batch: (queries) => db.batch(queries),
  }
}
