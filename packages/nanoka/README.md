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

**Stable (1.0.0).** Core API-boundary surface — field policies, `inputSchema` / `outputSchema`, validator presets, `t.json(zodSchema)`, field accessor API, Zod 3 / 4 support, OpenAPI component seed — is stable under SemVer.

## Stable API surface (1.0)

The following APIs are stable. Breaking changes require a major version bump.

- **Field DSL**: `t.string()` / `t.uuid()` / `t.integer()` / `t.number()` / `t.boolean()` / `t.timestamp()` / `t.json(zodSchema?)`
- **Field modifiers**: `.primary()` / `.unique()` / `.optional()` / `.default(fn)` / `.min(n)` / `.max(n)` / `.email()`
- **Field policies**: `.serverOnly()` / `.writeOnly()` / `.readOnly()` — `t.uuid().primary().readOnly()` implicitly generates a UUID via `crypto.randomUUID()` when no `.default()` is provided
- **Schema derivation**: `Model.schema(opts?)` / `Model.inputSchema('create' | 'update', opts?)` / `Model.outputSchema(opts?)`
- **Validator**: `Model.validator(target, opts | preset, hook?)` — presets: `'create'`, `'update'`
- **Response shaping**: `Model.toResponse(row)`
- **Field accessor** (typo-safe): `Model.schema({ pick: f => [f.fieldName] })`
- **CRUD**: `Model.findMany({ limit, offset?, orderBy? })` / `Model.findOne` / `Model.create` / `Model.update` / `Model.delete`
- **Escape hatch**: `app.db` (raw Drizzle) / `app.batch(...)` (D1 batch)
- **OpenAPI seed**: `Model.toOpenAPIComponent()` / `Model.toOpenAPISchema(usage)`
- **Router**: `nanoka<E extends Env = BlankEnv>(adapter)`
- **Adapter**: `d1Adapter(env.DB)` / `Adapter` interface

## Install

Nanoka assumes a Hono + Cloudflare Workers project. The standard starting point is `pnpm create hono@latest` (Cloudflare Workers template), which scaffolds `wrangler` and `hono` but **not** TypeScript, `@cloudflare/workers-types`, or `drizzle-kit`. From a fresh scaffold, add Nanoka and the missing pieces:

```bash
pnpm add @nanokajs/core drizzle-orm zod
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

Zod 3 and 4 are both supported (`peerDependencies.zod: ^3.23.0 || ^4.0.0`).

`drizzle-kit` is required at install time (not a peer dep) because `npx drizzle-kit generate` is the supported migration step — see Quickstart step 3.

### Adding to a project that wasn't scaffolded by create-hono

If you're integrating into an existing TypeScript project (no `create hono`), `hono` itself is also a peer dep — add it to the runtime install:

```bash
pnpm add @nanokajs/core hono drizzle-orm zod
pnpm add -D typescript drizzle-kit @cloudflare/workers-types
```

The tsconfig `types` entry above still applies if you're targeting Cloudflare Workers.

Peer dependency ranges: `hono ^4.0.0`, `drizzle-orm ^0.45.0`, `zod ^3.23.0 || ^4.0.0`, `@cloudflare/workers-types ^4.20240925.0`.

## Quickstart

### 3 commands to a working API

1. **Define your model**

   `src/models/posts.ts`:
   ```ts
   import { t } from '@nanokajs/core'

   export const postTableName = 'posts'
   export const postFields = {
     id: t.uuid().primary(),
     title: t.string().min(1).max(200),
     body: t.string().min(1),
     published: t.boolean().default(false),
     createdAt: t.timestamp().default(() => new Date()),
   }
   ```

2. **Generate Drizzle schema**

   Create `nanoka.config.ts` in your project root:
   ```ts
   import { defineConfig } from '@nanokajs/core/config'
   import { postTableName, postFields } from './src/models/posts'

   export default defineConfig({
     models: [
       { name: postTableName, fields: postFields },
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

   **Option A: unified pipeline (recommended)**
   ```bash
   npx nanoka generate --apply --db <DATABASE>
   ```
   When `drizzle.config.ts` is present, `nanoka generate` automatically runs `drizzle-kit generate`. Adding `--apply --db <DATABASE>` also runs `wrangler d1 migrations apply --local`.

   **Option B: step by step**
   ```bash
   npx nanoka generate           # schema generation + drizzle-kit generate (auto when drizzle.config.ts exists)
   npx wrangler d1 migrations apply <DATABASE> --local
   ```

   **Option C: schema generation only**
   ```bash
   npx nanoka generate --no-migrate   # skips drizzle-kit
   npx drizzle-kit generate
   npx wrangler d1 migrations apply <DATABASE> --local
   ```

   ✓ SQL migrations generated from Drizzle schema. Ready to deploy.

   The `nanoka.config.ts` (step 2) and `drizzle.config.ts` (step 3) are deliberately separate: Nanoka generates Drizzle schema code, then `drizzle-kit` diffs and emits SQL. Nanoka does not generate SQL or apply migrations — see [How it fits with drizzle-kit and wrangler](#how-it-fits-with-drizzle-kit-and-wrangler) below.

### Minimal example (model + 1 route)

`src/index.ts`:
```ts
import { d1Adapter, nanoka } from '@nanokajs/core'
import { postFields, postTableName } from './models/posts'

export interface Env {
  DB: D1Database
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const app = nanoka(d1Adapter(env.DB))
    const Post = app.model(postTableName, postFields)

    app.get('/posts/:id', async (c) => {
      const id = c.req.param('id')
      const post = await Post.findOne(id)
      if (!post) return c.notFound()
      return c.json(post)
    })

    app.post(
      '/posts',
      Post.validator('json', { omit: ['id', 'createdAt'] }),
      async (c) => {
        const body = c.req.valid('json')
        const created = await Post.create({ ...body, id: crypto.randomUUID() })
        return c.json(created, 201)
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
Your model definition
 (e.g., postFields + postTableName)
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

For relations and N+1 prevention, use `app.db` with Drizzle's `innerJoin` / `leftJoin` directly — this is the recommended long-term approach.

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

## OpenAPI scope

`Model.toOpenAPIComponent()` and `Model.toOpenAPISchema(usage)` generate **documentation / component seed** output from a representative subset of Zod types. They are not intended as the enforcement source for API gateways, client-side validators, or route-level request validators.

The runtime source of truth for validation remains the Zod schema returned by `inputSchema()` / `outputSchema()`.

Route-level OpenAPI is available via explicit route metadata: `app.openapi(metadata)` registers operation details, and `app.generateOpenAPISpec(options)` builds the OpenAPI 3.1 document. Swagger UI is available through `swaggerUI({ url, title? })`.

For complex joins, use raw Drizzle via `app.db`. The escape hatch is always open.

## AI coding support (llms.txt)

Nanoka publishes [`llms.txt`](https://raw.githubusercontent.com/nanokajs/nanoka/main/llms.txt) and [`llms-full.txt`](https://raw.githubusercontent.com/nanokajs/nanoka/main/llms-full.txt) at the repository root following the [llmstxt.org](https://llmstxt.org/) convention. AI coding agents (Claude Code, Cursor, Copilot, etc.) can read these to understand the API surface, conventions, and anti-patterns.

To make your AI agent aware of Nanoka, reference one of these URLs from your project's agent instructions file (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, etc.):

~~~markdown
## Project uses Nanoka

When working with Nanoka APIs, follow the conventions in:
https://raw.githubusercontent.com/nanokajs/nanoka/main/llms-full.txt
~~~

`llms.txt` is a compact index pointing at all docs. `llms-full.txt` is the self-contained reference suitable for direct context injection.

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

examples/basic/           # Cloudflare Workers example (includes field policy demos)
  src/models/
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
