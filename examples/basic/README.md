# Nanoka Basic Example

A minimal Cloudflare Workers application using Nanoka, demonstrating complete CRUD operations on a User model with database schema generation, migrations, and TypeScript validation.

## Prerequisites

- **pnpm** (Node package manager, v9+)
- **Cloudflare Account** (for remote deployment, optional for local testing)
- **`wrangler` authentication** (run `wrangler login` if deploying)

## Quickstart (local)

This example demonstrates the full workflow from model definition to working API.

1. **Install dependencies** (from repo root)
   ```bash
   pnpm install
   ```

2. **Build the Nanoka library**
   ```bash
   pnpm -C packages/nanoka build
   ```

3. **Generate schema and apply migrations** (unified pipeline)
   ```bash
   pnpm -C examples/basic generate:all
   ```
   ✓ Runs `nanoka generate` (creates `drizzle/schema.ts`) + `drizzle-kit generate` (SQL migrations) + `wrangler d1 migrations apply --local` in sequence.

   Alternatively, run each step individually:
   ```bash
   pnpm -C examples/basic generate        # creates drizzle/schema.ts + runs drizzle-kit generate
   pnpm -C examples/basic db:migrate:local  # applies migrations to local D1
   ```

4. **Start development server**
   ```bash
   pnpm -C examples/basic dev
   ```
   ✓ Runs on `http://localhost:8787`

## Testing the API with curl

Once `pnpm -C examples/basic dev` is running in another terminal:

**Create a user (POST)**
```bash
curl -i -X POST http://localhost:8787/users \
  -H 'content-type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com"}'
```
Expected: `201 Created` with user object (note: no `passwordHash` in response)

**Attempt password hash injection**
```bash
curl -i -X POST http://localhost:8787/users \
  -H 'content-type: application/json' \
  -d '{"name":"Bob","email":"bob@example.com","passwordHash":"injected"}'
```
Expected: `201 Created`, validator omits `passwordHash` from input

**List users (GET)**
```bash
curl -i 'http://localhost:8787/users?limit=10'
```
Expected: `200 OK` with array of users (no `passwordHash` fields)

**List with invalid limit (GET)**
```bash
curl -i 'http://localhost:8787/users?limit=999'
```
Expected: `400 Bad Request` (exceeds max of 100)

**Get single user (GET)**
```bash
curl -i http://localhost:8787/users/<USER_ID>
```
Expected: `200 OK` if exists, `404 Not Found` if not

**Update user (PATCH)**
```bash
curl -i -X PATCH http://localhost:8787/users/<USER_ID> \
  -H 'content-type: application/json' \
  -d '{"name":"Alice Updated"}'
```
Expected: `200 OK` with updated user (no `passwordHash`)

**Delete user (DELETE)**
```bash
curl -i -X DELETE http://localhost:8787/users/<USER_ID>
```
Expected: `204 No Content`

## Test

Run the integrated test suite (vitest-pool-workers with local D1):

```bash
pnpm -C examples/basic test
```

7 tests verify:
1. POST creates user without exposing `passwordHash`
2. POST injection of `passwordHash` is blocked
3. GET list returns array without `passwordHash`
4. GET list with invalid `limit=999` returns 400
5. GET single user returns 200 or 404
6. PATCH updates fields without exposing `passwordHash`
7. DELETE removes user and subsequent GET returns 404

## Deploy to remote (optional)

1. **Create a D1 database**
   ```bash
   wrangler d1 create nanoka-basic
   ```
   Copy the `database_id` from output

2. **Update `wrangler.jsonc`**
   Replace the placeholder `database_id` with your actual ID

3. **Apply migrations to remote**
   ```bash
   pnpm -C examples/basic db:migrate:remote
   ```

4. **Deploy the worker**
   ```bash
   wrangler deploy --project-name nanoka-basic
   ```

## How it works: architecture

### 1. Model definition
`src/models/user.ts` defines fields (id, name, email, passwordHash, createdAt) using Nanoka's DSL.

### 2. Schema generation
`nanoka generate` reads `nanoka.config.ts` and outputs Drizzle table definitions to `drizzle/schema.ts`. This is the source of truth for the database structure.

### 3. SQL migration
`drizzle-kit generate` reads the Drizzle schema and produces SQL migration files (`drizzle/migrations/`). The framework **never** applies migrations directly; `wrangler d1 migrations apply` does.

### 4. API layer
`src/index.ts` uses Nanoka's router (`nanoka()`) to:
- Register the User model with the D1 adapter
- Define 5 CRUD routes (POST, GET list, GET one, PATCH, DELETE)
- Validate inputs with Zod validators
- Filter responses (omit `passwordHash`, expose only safe fields)

### 5. Query execution
All queries (create, findMany, update, delete) go through the D1 adapter to Drizzle ORM, ensuring type safety and parametrized SQL.

## Key design patterns

### Validator-based input filtering
Routes use `User.validator('json', { omit: ['passwordHash', 'createdAt', 'id'] })` to reject sensitive fields from the request body:
```typescript
app.post('/users', User.validator('json', { omit: ['passwordHash', 'createdAt', 'id'] }), async (c) => {
  const body = c.req.valid('json')  // passwordHash, createdAt, id already filtered out
  const created = await User.create({ ...body, passwordHash: 'demo-...' })  // id and createdAt auto-generated
  return c.json(User.schema({ omit: ['passwordHash'] }).parse(created), 201)
})
```

### Response filtering
Always parse responses through `User.schema({ omit: [...] })` before returning:
```typescript
const result = User.schema({ omit: ['passwordHash'] }).parse(created)
return c.json(result, 201)
```
This is **not automatic**—it's explicit per route, matching the "80% automatic, 20% explicit" philosophy.

### Error handling
Routes throw `HTTPException(404)` for not found, and the app-level `onError` handler catches them:
```typescript
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  // 500 with stack trace in dev, generic message in production
  return c.json({ error: isProd ? 'Internal Server Error' : err.message }, 500)
})
```

## Escape hatch: raw Drizzle

If you need to do something the model doesn't support, use `app.db` directly:
```typescript
const result = await app.db.select().from(users).where(eq(users.email, 'alice@example.com'))
```
This is intentional—Nanoka is a thin wrapper, not a black box.

## Troubleshooting

### Debug error responses

By default, `app.onError` returns `{ error: "Internal Server Error" }` for unhandled errors and never exposes stack traces. To see stack traces during local development, set `DEBUG = "1"` in `wrangler.jsonc`'s `[vars]` section. **Never enable `DEBUG` in production deployments.**

- **"no such table: users"**: Migrations haven't been applied. Run `pnpm -C examples/basic db:migrate:local`
- **UUID validation error (400)**: The route expects a UUID in the path, e.g. `http://localhost:8787/users/550e8400-e29b-41d4-a716-446655440000`
- **Wrangler outdated**: Run `pnpm add -D -W wrangler@latest`
- **D1 migrations stuck**: Delete `.wrangler/` and re-run `db:migrate:local`
- **Port 8787 in use**: Specify a different port with `wrangler dev --port 8788`

## Using Turso/libSQL instead of D1

Nanoka supports Turso/libSQL as a drop-in replacement for D1 via `tursoAdapter`.

**Install the libSQL client:**
```bash
pnpm add @libsql/client
```

**Replace `d1Adapter` with `tursoAdapter` in your worker entry:**
```typescript
import { createClient } from '@libsql/client'
import { tursoAdapter } from '@nanokajs/core/turso'
import { nanoka } from '@nanokajs/core'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const app = nanoka(tursoAdapter(client))
```

**Migrations with libSQL:**
Use `drizzle-kit` with the libSQL driver instead of `wrangler d1 migrations apply`:
```bash
# drizzle.config.ts: set driver: 'turso' and dbCredentials: { url, authToken }
pnpm exec drizzle-kit migrate
```

## Current scope: what this is NOT

This example does not include:
- **Relations** (hasMany, belongsTo, foreign keys) → future 1.x
- **Authentication** (JWT, OAuth, etc.) → Out of scope

The focus of this example is a working end-to-end flow: model → schema → migrations → type-safe CRUD API → OpenAPI docs.

## Next steps

Next likely additions are relation design and optional typed query ergonomics. Until then, use raw Drizzle via `app.db` for joins and advanced SQL.

## License

MIT (as part of the Nanoka project)
