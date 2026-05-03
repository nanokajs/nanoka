import { createClient } from '@libsql/client'
import { sql } from 'drizzle-orm'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { t } from '../../field'
import { nanoka } from '../../router'
import type { d1Adapter } from '../d1'
import { tursoAdapter } from '../turso'
import type { Adapter } from '../types'

describe('tursoAdapter', () => {
  it('should create an Adapter instance from libSQL client', () => {
    const client = createClient({ url: ':memory:' })
    const adapter = tursoAdapter(client)

    expect(adapter).toBeDefined()
    expect(adapter.drizzle).toBeDefined()
    expect(adapter.batch).toBeDefined()
  })

  it('should expose drizzle database with CRUD methods', () => {
    const client = createClient({ url: ':memory:' })
    const adapter = tursoAdapter(client)

    expect(typeof adapter.drizzle.select).toBe('function')
    expect(typeof adapter.drizzle.insert).toBe('function')
    expect(typeof adapter.drizzle.update).toBe('function')
    expect(typeof adapter.drizzle.delete).toBe('function')
  })

  it('should expose batch method', () => {
    const client = createClient({ url: ':memory:' })
    const adapter = tursoAdapter(client)

    expect(typeof adapter.batch).toBe('function')
  })

  it('should type as Adapter interface', () => {
    const client = createClient({ url: ':memory:' })
    const adapter = tursoAdapter(client)

    expectTypeOf(adapter).toMatchTypeOf<Adapter>()
  })

  it('CRUD round-trip: CREATE TABLE → insert → select → update → delete', async () => {
    const client = createClient({ url: ':memory:' })
    const adapter = tursoAdapter(client)

    await adapter.drizzle.run(
      sql`CREATE TABLE IF NOT EXISTS test_users (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
    )

    await adapter.drizzle.run(sql`INSERT INTO test_users (id, name) VALUES ('1', 'Alice')`)

    const rows = await adapter.drizzle.all(sql`SELECT * FROM test_users WHERE id = '1'`)
    expect(rows).toHaveLength(1)
    expect((rows[0] as { id: string; name: string }).name).toBe('Alice')

    await adapter.drizzle.run(sql`UPDATE test_users SET name = 'Bob' WHERE id = '1'`)
    const updated = await adapter.drizzle.all(sql`SELECT * FROM test_users WHERE id = '1'`)
    expect((updated[0] as { id: string; name: string }).name).toBe('Bob')

    await adapter.drizzle.run(sql`DELETE FROM test_users WHERE id = '1'`)
    const deleted = await adapter.drizzle.all(sql`SELECT * FROM test_users WHERE id = '1'`)
    expect(deleted).toHaveLength(0)
  })

  it('batch executes multiple queries', async () => {
    const client = createClient({ url: ':memory:' })
    const adapter = tursoAdapter(client)

    await adapter.drizzle.run(
      sql`CREATE TABLE IF NOT EXISTS batch_test (id TEXT PRIMARY KEY, val TEXT)`,
    )

    const result = await adapter.batch([
      adapter.drizzle.run(sql`INSERT INTO batch_test (id, val) VALUES ('a', 'foo')`),
      adapter.drizzle.run(sql`INSERT INTO batch_test (id, val) VALUES ('b', 'bar')`),
    ])

    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)

    const rows = await adapter.drizzle.all(sql`SELECT * FROM batch_test ORDER BY id`)
    expect(rows).toHaveLength(2)
  })

  it('tursoAdapter is assignable to same Adapter type as d1Adapter', () => {
    const turso = tursoAdapter(createClient({ url: ':memory:' }))
    const fn = (_a: Adapter) => {}
    fn(turso)
    expectTypeOf<ReturnType<typeof tursoAdapter>>().toEqualTypeOf<ReturnType<typeof d1Adapter>>()
  })
})

describe('tursoAdapter — nanoka() integration', () => {
  it('create → findMany → update → findOne → delete round-trip', async () => {
    const client = createClient({ url: ':memory:' })
    const adapter = tursoAdapter(client)

    await adapter.drizzle.run(
      sql`CREATE TABLE IF NOT EXISTS integration_users (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL
      )`,
    )

    const app = nanoka(adapter)
    const User = app.model('integration_users', {
      id: t.uuid().primary(),
      name: t.string(),
      email: t.string().email(),
    })

    const created = await User.create({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'Alice',
      email: 'alice@example.com',
    })
    expect(created.id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(created.name).toBe('Alice')
    expect(created.email).toBe('alice@example.com')

    const list = await User.findMany({ limit: 10 })
    expect(list).toHaveLength(1)
    expect(list[0]?.name).toBe('Alice')

    const updated = await User.update('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', { name: 'Bob' })
    expect(updated).not.toBeNull()
    expect(updated?.name).toBe('Bob')

    const found = await User.findOne('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(found).not.toBeNull()
    expect(found?.name).toBe('Bob')
    expect(found?.email).toBe('alice@example.com')

    const deleted = await User.delete('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(deleted.deleted).toBe(1)

    const afterDelete = await User.findOne('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(afterDelete).toBeNull()
  })
})
