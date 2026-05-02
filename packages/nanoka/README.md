<p align="center">
  <img src="https://raw.githubusercontent.com/nanokajs/nanoka/main/assets/images/nanoka-logo.png" alt="nanoka" width="200" />
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

The v1.0 line will be cut when Nanoka's core API-boundary model is stable: field policies (`serverOnly` / `writeOnly` / `readOnly`), purpose-specific schemas (`inputSchema` / `outputSchema`), validator presets, typed JSON fields, Zod 4 support, and OpenAPI component generation. Relations, route-level OpenAPI, scaffolding, and editor tooling are not v1.0 blockers.

## Install

Nanoka assumes a Hono + Cloudflare Workers project. The standard starting point is `pnpm create hono@latest` (Cloudflare Workers template), which scaffolds `wrangler` and `hono` but **not** TypeScript, `@cloudflare/workers-types`, or `drizzle-kit`. From a fresh scaffold, add Nanoka and the missing pieces:

```bash
pnpm add @nanokajs/core drizzle-orm zod@^3.23.0
pnpm add -D typescript drizzle-kit @cloudflare/workers-types
```

Then add a `types` entry to `tsconfig.json` so `D1Database`, `Request`, `ExecutionContext`, and `crypto` resolve as ambient globals (no per-file imports needed):

```jsonc
{
  "compilerOptions": {
    // ... existing options from create-hono ...
    "types": ["@cloudflare/workers-types"]
  }
}
```

Without `types`, you would have to `import { D1Database, Request, ... } from '@cloudflare/workers-types'` in every file — which works for types but is misleading because the package has no runtime exports, and importing `Request` shadows the global `Request` constructor.

After this, the [Minimal example](#minimal-example-model--1-route) below works as written.

> **Zod 4 is not yet supported.** Zod 4 reorders the `ZodType` generics, which collapses Nanoka's field type inference (`RowType`, `CreateInput`) to `never`. Pin `zod@^3.23.0` until Phase 2 ships Zod 4 support. Without the pin, `pnpm add zod` will install the latest 4.x and `User.create({...})` will fail to type-check.

`drizzle-kit` is required at install time (not a peer dep) because `npx drizzle-kit generate` is the supported migration step — see Quickstart step 3.

### Adding to a project that wasn't scaffolded by create-hono

If you're integrating into an existing TypeScript project (no `create hono`), `hono` itself is also a peer dep — add it to the runtime install:

```bash
pnpm add @nanokajs/core hono drizzle-orm zod@^3.23.0
pnpm add -D typescript drizzle-kit @cloudflare/workers-types
```

The tsconfig `types` entry above still applies if you're targeting Cloudflare Workers.

Peer dependency ranges: `hono ^4.0.0`, `drizzle-orm ^0.45.0`, `zod ^3.23.0`, `@cloudflare/workers-types ^4.20240925.0`.

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

3. **Generate SQL migrations and apply them**

   Create `drizzle.config.ts` in your project root (this is read by `drizzle-kit`, not by Nanoka):
   ```ts
   import { defineConfig } from 'drizzle-kit'

   export default defineConfig({
     schema: './drizzle/schema.ts',
     out: './drizzle/migrations',
     dialect: 'sqlite',
     driver: 'd1-http',
   })
   ```

   Then:
   ```bash
   npx drizzle-kit generate
   npx wrangler d1 migrations apply <DATABASE> --local
   ```

   ✓ SQL migrations generated from Drizzle schema. Ready to deploy.

   The `nanoka.config.ts` (step 2) and `drizzle.config.ts` (step 3) are deliberately separate: Nanoka generates Drizzle schema code, then `drizzle-kit` diffs and emits SQL. Nanoka does not generate SQL or apply migrations — see [How it fits with drizzle-kit and wrangler](#how-it-fits-with-drizzle-kit-and-wrangler) below.

### Minimal example (model + 1 route)

`src/index.ts`:
```ts
import { d1Adapter, nanoka } from '@nanokajs/core'
import { userFields, userTableName } from './models/user'

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
        const created = await User.create({
          ...body,
          id: crypto.randomUUID(),
          passwordHash: 'hashed_value_here', // use bcrypt, argon2, etc. in production
          createdAt: new Date(),
        })
        const user = User.schema({ omit: ['passwordHash'] }).parse(created)
        return c.json(user, 201)
      }
    )

    return app.fetch(req, env, ctx)
  },
}
```

### Full working example

Complete CRUD with curl tests, deployment steps, and troubleshooting:
[examples/basic/README.md](https://github.com/nanokajs/nanoka/blob/main/examples/basic/README.md)

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

- **Field policies** (`serverOnly()`, `writeOnly()`, `readOnly()`) — Phase 2. These will reduce repeated `omit` boilerplate for API input/output boundaries while keeping response shaping explicit.
- **Purpose-specific schemas** (`inputSchema('create')`, `inputSchema('update')`, `outputSchema()`) — Phase 2. Phase 1 uses `schema({ pick, omit, partial })` directly.
- **Typed JSON fields** (`t.json(zodSchema)`) — Phase 2. Phase 1 `t.json()` uses `z.unknown()`.
- **Field accessor API** (`User.schema({ pick: f => [f.name, f.email] })`) — Phase 2. Phase 1 uses string arrays. When Phase 2 lands, the `f` object will be `as const`, with zero runtime cost.
- **Zod 4 support** — Phase 2. Zod 4 changed `ZodType<Output, Def, Input>` (v3) to `ZodType<Output, Input, Internals>` (v4); Nanoka's field type derivation depends on the v3 generic order, so installing Zod 4 collapses `InferFieldType` to `never`. Pin `zod@^3.23.0` for now.
- **OpenAPI component generation** — Phase 2 seed. Route-level OpenAPI, route auto-discovery, and Swagger UI are Phase 3.
- **Relations** (`hasMany()`, `belongsTo()`, lazy loading) — Phase 2 later or Phase 3. Use raw Drizzle for joins.
- **Turso / libSQL adapters** — Phase 2 later or Phase 3. Nanoka is designed adapter-first; additional adapters will follow.
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

   Note: External links use absolute GitHub URLs (https://github.com/nanokajs/nanoka/...) so they resolve on both GitHub and the npm registry page.

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
