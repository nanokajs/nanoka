import type { D1Database } from '@cloudflare/workers-types'
import { drizzle } from 'drizzle-orm/d1'
import type { Adapter } from './types'

/**
 * D1-specific adapter factory. Wraps Cloudflare D1 binding in the generic
 * Adapter abstraction, enabling the core query path and router to remain
 * implementation-agnostic.
 */
export function d1Adapter<TSchema extends Record<string, unknown> = Record<string, never>>(
  d1: D1Database,
): Adapter<TSchema> {
  // drizzle-orm/d1's drizzle() returns DrizzleD1Database which embeds D1-specific
  // result types. We cast to BaseSQLiteDatabase via the Adapter interface to keep
  // the D1 dependency local to this file (see CLAUDE.md rule #3). Consumers receive
  // the typed Adapter interface, so this `any` is intentionally local.
  //
  // Note: drizzle-orm/d1 internally stores the D1 binding in db.$client. When
  // handling multiple D1 bindings, call d1Adapter() fresh for each binding rather
  // than caching the return value across binding switches.
  // biome-ignore lint/suspicious/noExplicitAny: intentional - Drizzle returns complex union type
  const db = drizzle(d1) as any

  return {
    drizzle: db,
    batch: (queries) => db.batch(queries),
  }
}
