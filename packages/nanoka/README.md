<p align="center">
  <img src="https://raw.githubusercontent.com/A-1ro/nanoka/main/assets/images/nanoka-logo.png" alt="nanoka" width="200" />
</p>

# nanoka

> Thin wrapper over Hono + Drizzle + Zod for Cloudflare Workers + D1.
> 80% automatic, 20% explicit.

## What is this

Nanoka is a lightweight framework that bridges model definition with DB schema, TypeScript types, and validation. It places the model at the center and derives schema, types, and base validation from it—but keeps API validation as an intentional, explicit adaptation layer, because DB shape and API shape diverge (e.g., `passwordHash` exists in the DB but must not appear in responses).

The core idea: stop gluing together Hono + Drizzle + Zod manually. Define a model once, get DB schema, types, and validators automatically. Then customize API behavior explicitly for each route.

Targets **Cloudflare Workers + D1 (SQLite)** as first-class. Hono-compatible routing, escape hatch to raw Drizzle, zero magic.

## Status

Phase 1 (MVP). Experimental. Expect breaking changes until v1.0.

## Install

```bash
pnpm add @nanokajs/core hono drizzle-orm zod
```

Peer dependencies: `hono ^4.0.0`, `drizzle-orm ^0.45.0`, `zod ^3.23.0`, `@cloudflare/workers-types ^4.20240925.0` (for Workers).

## Quickstart

### 3 commands to a working API

1. **Define your model**

   `src/models/user.ts`:
   ```ts
   import { t } from '@nanokajs/core'

   export const userTableName = 'users'
   export const userFields = {
     id: t.uuid().primary(),
     name: t.string(),
     email: t.string().email(),
     passwordHash: t.string(),
     createdAt: t.timestamp().default(() => new Date()),
   }
   ```

2. **Generate Drizzle schema**

   Create `nanoka.config.ts` in your project root:
   ```ts
   import { defineConfig } from '@nanokajs/core/config'
   import { userTableName, userFields } from './src/models/user'

   export default defineConfig({
     models: [
       { name: userTableName, fields: userFields },
     ],
     output: './drizzle/schema.ts',
   })
   ```

   Then:
   ```bash
   npx nanoka generate
   ```

   ✓ Creates `drizzle/schema.ts` from your models.

3. **Apply migrations and deploy**

   ```bash
   npx drizzle-kit generate
   npx wrangler d1 migrations apply <DATABASE> --local
   ```

   ✓ SQL migrations generated from Drizzle schema. Ready to deploy.

### Minimal example (model + 1 route)

`src/index.ts`:
```ts
import { d1Adapter, nanoka } from '@nanokajs/core'
import { userFields, userTableName } from './src/models/user'

export interface Env {
  DB: D1Database
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const app = nanoka(d1Adapter(env.DB))
    const User = app.model(userTableName, userFields)

    app.get('/users/:id', async (c) => {
      const id = c.req.param('id')
      const user = await User.findOne(id)
      if (!user) return c.notFound()
      return c.json(user)
    })

    app.post(
      '/users',
      User.validator('json', { omit: ['id', 'passwordHash', 'createdAt'] }),
      async (c) => {
        const body = c.req.valid('json')
        const user = await User.create({
          ...body,
          id: crypto.randomUUID(),
          passwordHash: 'hashed_value_here', // use bcrypt, argon2, etc. in production
          createdAt: new Date(),
        })
        return c.json(user, 201)
      }
    )

    return app.fetch(req, env, ctx)
  },
}
```

### Full working example

Complete CRUD with curl tests, deployment steps, and troubleshooting:
[examples/basic/README.md](../../examples/basic/README.md)

## How it fits with drizzle-kit and wrangler

### Migration flow

```
User model definition
 (userFields + userTableName)
        |
        v
   nanoka generate
        |
        v
drizzle/schema.ts (Drizzle schema code)
        |
        v
drizzle-kit generate
        |
        v
drizzle/migrations/*.sql (SQL migrations)
        |
        v
wrangler d1 migrations apply
        |
        v
    D1 Database
```

**Nanoka generates Drizzle schema code only.** Nanoka does NOT generate SQL, does not compute diffs, does not apply migrations. That responsibility stays with `drizzle-kit` (diff + SQL) and `wrangler` (apply).

This design keeps Nanoka thin and lets the stable Drizzle ecosystem handle migration machinery. You own the SQL files; migrations are human-reviewable and version-controlled.

## Core API

### Model definition with `t`

Fields are built with the `t` builder:

```ts
import { t } from '@nanokajs/core'

const fields = {
  id: t.uuid().primary(),
  name: t.string(),
  email: t.string().email(),
  passwordHash: t.string(),
  active: t.boolean().default(() => true),
  age: t.integer().min(0).max(150),
  metadata: t.json(), // { key: string, value: unknown }[]
  createdAt: t.timestamp().default(() => new Date()),
  updatedAt: t.timestamp().default(() => new Date()),
}
```

Supported field types:
- `t.string()` / `t.uuid()`
- `t.integer()` / `t.number()`
- `t.boolean()`
- `t.timestamp()`
- `t.json()`

Modifiers:
- `.primary()` — primary key (required, one per model)
- `.unique()` — unique constraint
- `.optional()` — nullable
- `.default(fn)` — default value (function or constant)
- `.min(n)` / `.max(n)` — numeric / string length bounds
- `.email()` — email validation (string modifier: `t.string().email()`)

### `schema()` vs `validator()` (two methods, not one)

This intentional separation keeps validation library swappable for Phase 2.

**`schema(opts)` — pure Zod schema, standalone**

```ts
const CreateSchema = User.schema({ omit: ['id', 'passwordHash', 'createdAt'] })
const parsed = CreateSchema.parse(data)  // use anywhere Zod is needed
```

**`validator(target, opts, hook?)` — Hono validator**

```ts
app.post('/users', User.validator('json', { omit: ['id', 'passwordHash'] }), handler)
// or with error hook:
app.post('/users', User.validator('json', opts, (result, c) => {
  if (!result.success) return c.json({ error: 'Invalid request' }, 400)
}), handler)
```

The `hook` parameter is optional. If you omit it, `@hono/zod-validator` returns issues in the response (see Error handling section for hardening).

Options apply to both:
- `pick: ['name', 'email']` — include only these fields
- `omit: ['passwordHash']` — exclude these fields
- `partial: true` — all fields optional (good for PATCH)

### `findMany` requires `limit` (type-safe pagination)

`limit` is a required parameter—omitting it is a **compile error**:

```ts
// @ts-expect-error Missing required property 'limit'
const users = await User.findMany()

// OK
const users = await User.findMany({ limit: 20 })
const users = await User.findMany({ limit: 20, offset: 10 })
const users = await User.findMany({ limit: 20, orderBy: 'id' })
```

This prevents accidental unbounded queries. Pagination shape: `{ limit, offset?, orderBy? }`.

## Escape hatch: raw Drizzle and D1 batch

### `app.db` — use raw Drizzle when needed

When the typed API doesn't fit, drop down to `app.db` (raw Drizzle):

```ts
import { eq } from 'drizzle-orm'

// Raw select with explicit types
const users = await app.db
  .select()
  .from(User.table)
  .where(eq(User.table.email, 'alice@example.com'))

// Complex joins, subqueries, raw SQL
const result = await app.db
  .select()
  .from(User.table)
  .innerJoin(Post.table, eq(User.table.id, Post.table.userId))
```

`User.table` is the underlying Drizzle table. Combine with `eq()`, `lt()`, `and()`, `or()` from `drizzle-orm` for complex conditions. SQL injection is prevented by Drizzle's parametrized bindings.

### `app.batch()` — D1 batch API directly

For transactions or batched queries, use `app.batch()` (D1's native batch):

```ts
const results = await app.batch([
  app.db.insert(User.table).values({ ... }),
  app.db.update(User.table).set({ ... }).where(...),
])

// D1 batch returns results in order
const [insertResult, updateResult] = results
```

No custom transaction abstraction. Nanoka exposes D1's `batch()` directly. Isolation level and rollback behavior match D1 docs.

## Error handling

### `HTTPException` (Hono standard)

Nanoka uses Hono's `HTTPException` for errors:

```ts
import { HTTPException } from 'hono/http-exception'

app.get('/users/:id', async (c) => {
  const user = await User.findOne(c.req.param('id'))
  if (!user) throw new HTTPException(404, { message: 'Not found' })
  return c.json(user)
})
```

### Hardening Zod validator errors

By default, `@hono/zod-validator` returns the full `issues[]` array in the response, which leaks your API schema shape (field names, types, constraints) to attackers during reconnaissance. Default zod-validator behavior leaks the API schema shape via `issues[]`. Replace with a fixed string in production.

**Option 1: validator hook (recommended)**

Pass a hook as the third argument to `User.validator()`. The hook receives the validation result and the Hono context. When you return a response from the hook, it replaces the default behavior:

```ts
app.post(
  '/users',
  User.validator('json', { omit: ['passwordHash'] }, (result, c) => {
    if (!result.success) return c.json({ error: 'Invalid request' }, 400)
  }),
  handler
)
```

**Option 2: `app.onError` (for non-validator paths)**

`@hono/zod-validator` does not throw on validation failure — it calls `c.json(result, 400)` directly, so `app.onError` does not receive validator failures. Use `app.onError` for cases where you call `User.schema().parse(data)` directly or write middleware that throws `ZodError`:

```ts
import { ZodError } from 'zod'

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json({ error: 'Invalid request' }, 400)
  }
  // ... handle other errors
})
```

Note: this handler will not be called for validation failures originating from `User.validator()`. Use Option 1 for those.

## Phase 1 scope: what is NOT included

Nanoka Phase 1 is intentionally minimal. These features are Phase 2 or later:

- **Relations** (`hasMany()`, `belongsTo()`, lazy loading) — Phase 2. Use raw Drizzle for joins.
- **Field accessor API** (`User.schema({ pick: f => [f.name, f.email] })`, `User.where(f => eq(f.email, x))`) — Phase 2. Phase 1 uses string arrays and object-form `where`. When Phase 2 lands, the `f` object will be `as const`, with zero runtime cost.
- **OpenAPI generation** — Phase 2 or 3.
- **Turso / libSQL adapters** — Phase 2. Nanoka is designed adapter-first; additional adapters will follow.
- **CLI scaffolder** (`create-nanoka-app`) — Phase 3.
- **Auth, full-stack React, complex query DSL** — explicitly out of scope at every phase.

For relations and complex joins in Phase 1, use raw Drizzle via `app.db`. The escape hatch is always open.

## Workspace structure (for contributors)

```
packages/nanoka/          # Library
  src/
    field/                # DSL builder (t)
    model/                # Model definition, schema(), validator()
    router/               # nanoka() router, CRUD methods
    adapter/              # Adapter interface, d1Adapter()
    cli/                  # CLI entry point, nanoka generate
    codegen/              # Schema code generator
  dist/                   # Built ESM + types (not in repo, generated by tsup)
  __tests__/              # Integration tests
  README.md               # This file
  LICENSE                 # MIT
  package.json
  tsup.config.ts
  vitest.config.ts
  vitest.node.config.ts
  tsconfig.json

examples/basic/           # Cloudflare Workers example
  src/models/user.ts
  src/index.ts
  drizzle/schema.ts       # Generated by nanoka generate
  drizzle/migrations/     # Generated by drizzle-kit generate
  README.md
  wrangler.toml
```

## Release checklist (for maintainers)

Before running `pnpm publish`:

1. **Run `pnpm publish --dry-run` and verify tarball contents**
   ```bash
   pnpm -C packages/nanoka publish --dry-run
   ```
   Expected in Tarball Contents:
   - `dist/index.js`, `dist/index.d.ts`, `dist/*.js`, `dist/*.d.ts`
   - `LICENSE`
   - `package.json`, `README.md`

   NOT included (confirm absence):
   - `src/`, `__tests__/`, `.test.ts`, `.spec.ts`
   - `tsconfig.json`, `vitest.config.ts`, `tsup.config.ts`, `scripts/`
   - `node_modules/`

   Note: `../../examples/basic` is a relative link in this README. It resolves correctly on GitHub but not on the npm registry. The link is kept for GitHub usability.

2. **Verify publish access**
   ```bash
   npm view @nanokajs/core 2>&1 | grep E404
   ```
   Confirm E404 (not yet published). Confirm that the `nanokajs` npm org has been created and you have publish rights to `@nanokajs/core`.

3. **Publish** (prepublishOnly hook will run build + test + typecheck again)
   ```bash
   pnpm -C packages/nanoka publish
   ```

## License

MIT — see LICENSE file.
