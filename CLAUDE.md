# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository. Keep it semantically aligned with `AGENTS.md`.

## Repository state

Nanoka is past the Phase 1 / Phase 1.5 / Phase 2 implementation plans. The repo is a pnpm workspace with:

- `packages/nanoka` — `@nanokajs/core`
- `packages/create-nanoka-app` — scaffold CLI
- `examples/basic` — D1 example app with OpenAPI docs

Before adding code, read:

- `docs/implementation-status.md` for the current shipped / pending split.
- `docs/nanoka.md` for the product and architecture design.
- GitHub Issues for remaining candidates, accepted risks, and operational follow-ups.

The old phase plan and backlog files were historical records, not "resume from first unchecked item" task queues. Current work starts from `docs/implementation-status.md` and the issue being addressed.

## Progress tracking

- At session start, read `docs/implementation-status.md` unless the user asks for a specific file or task.
- If work changes shipped API surface, roadmap, or scope classification, update `docs/implementation-status.md` in the same change as the code.
- If a task completes a tracked follow-up, close or update the matching GitHub Issue when the completion criteria are actually met.
- Do not re-open Phase 1 / Phase 2 checkboxes as active work unless the user explicitly asks to revise history.

## What Nanoka is

Nanoka is a thin wrapper over Hono + Drizzle + Zod targeting Cloudflare Workers + D1, with Turso/libSQL available through the adapter interface.

The core thesis: a single model definition is the source of truth for DB schema, TypeScript types, and base validation, but API validation is a deliberate derivation, not an automatic mirror. DB shape and API shape can diverge, for example `passwordHash` may exist in the DB but must not appear in responses.

The design phrase is "80% automatic, 20% explicit". When in doubt, prefer making the explicit 20% obvious in the route handler instead of hiding it in the framework.

## Load-bearing architectural rules

These are non-obvious commitments from `docs/nanoka.md`. Do not violate them unless the user explicitly changes the project direction.

1. No custom migration engine. `nanoka generate` produces Drizzle schema files; diff/SQL generation and application stay with `drizzle-kit`, `wrangler d1 migrations`, or the relevant libSQL migration flow.
2. Hono is internalized, not coexisting. The router is Hono-compatible and examples follow Hono idioms such as `c.req.valid('json')` and `HTTPException`.
3. Adapter layer stays central. D1 is first-class and Turso/libSQL is supported through `tursoAdapter(client)`. Keep DB access behind the adapter interface; do not bake `D1Database` types into the core query path.
4. Escape hatch always open. `app.db` exposes raw Drizzle, for example `app.db.select().from(User.table)`.
5. `schema()` and `validator()` are separate concerns. `User.schema(opts)` returns a standalone Zod schema; `User.validator(target, opts)` returns a Hono validator.
6. `findMany` must be safe by default. `limit` is required; calling `findMany` without a limit should be a type error. Pagination shape is `{ limit, offset, orderBy }`.
7. Batch stays explicit. Nanoka exposes the adapter batch API directly; do not create a bespoke transaction abstraction.
8. OpenAPI output is documentation/spec generation. Runtime validation source of truth remains Zod (`inputSchema()` / `outputSchema()`) plus Hono validators.

## Phase boundaries and remaining scope

Phase 2後半 and Phase 3 became partially mixed during implementation. Treat these as already shipped 1.x features:

- Route-level OpenAPI: `app.openapi(metadata)` / `app.generateOpenAPISpec(options)`
- Swagger UI: `swaggerUI({ url, title? })`
- Turso/libSQL adapter: `@nanokajs/core/turso`
- CLI scaffolder: `create-nanoka-app`

These remain unimplemented or intentionally out of scope. If a task appears to require one of them, confirm scope before expanding the public API:

- Relations: `t.hasMany()`, `t.belongsTo()`. — Issue #14、設計確定済み・実装中（設計仕様は `docs/nanoka.md` の "Relations API" 節参照）
- Typed query helper: `User.where(f => eq(f.email, x)).limit(10)`. — non-goal, Issue #15
- Codex or Claude Code plugin.
- Auth (provided as `@nanokajs/auth` separate package — Issue #74 / #75), full-stack React, or a complex query DSL that replaces Drizzle.

The schema / validator field-accessor API already exists for `{ pick: f => [f.name] }` and `{ omit: f => [f.passwordHash] }`. Keep its `f` object `as const`, not a Proxy. Runtime cost must remain zero.

## Workflow

For normal implementation work:

1. Read `docs/implementation-status.md`, `docs/nanoka.md`, the relevant GitHub Issue, and the relevant source files.
2. Identify whether the task touches shipped API, tracked follow-ups, or historical docs.
3. Keep changes scoped to the requested task.
4. When adding or removing a CRUD method on the model API, update both layers in the same change: the raw `Model<Fields>` interface in `packages/nanoka/src/model/types.ts` and the bound `NanokaModel<Fields>` interface in `packages/nanoka/src/router/types.ts`, plus the wire-up in `packages/nanoka/src/router/nanoka.ts`. The two-layer split (adapter-first raw API vs. adapter-bound app API) is intentional, and forgetting the router layer makes the new method unreachable from `app.model(...)`.
5. Update tests alongside code when behavior or public types change.
6. Run the narrowest useful verification first, then broader checks when risk warrants it.
7. Update `docs/implementation-status.md` and/or the GitHub Issue only after the corresponding completion criteria are met.

For larger or ambiguous changes, present a short plan before editing. The plan should cover goal, affected files, implementation steps, tests, completion criteria, and deferred scope.

Do not invent new design decisions during implementation. If the docs and existing code conflict, stop and surface the conflict.

## Versioning

Any change to `packages/nanoka` or `packages/create-nanoka-app` must include a version bump in the same PR. Both packages share the same version number.

| Change type | Version segment | Examples |
|---|---|---|
| Bug fix, docs, template, test, tooling | patch `n.n.x` | Template replacement, README fix, CI config |
| New feature, new API | minor `n.x.0` | New field type, new adapter, new CLI option |
| Breaking change to stable API | major `x.0.0` | Removing or renaming a stable API listed in `packages/nanoka/README.md#stable-api-surface-10` |

When in doubt between patch and minor, use minor. When in doubt between minor and major, stop and confirm with the user — a wrong major bump is recoverable, but a missed major bump breaks users silently.

## Security review triggers

Run or request a security-focused review when a change touches:

- HTTP body, params, query, or headers.
- Zod validators or Hono validation.
- DB query construction, Drizzle escape hatches, D1/Turso adapters, or batch behavior.
- OpenAPI generation that might be treated as a validation/enforcement source.
- Auth, authorization, sessions, tokens, API keys, or secrets.
- CORS, redirects, external `fetch`, logging, or error messages.
- New npm dependencies.

Security review priorities:

- External input must pass through validation such as `c.req.valid('json')`.
- DB access should use Drizzle parameterized queries.
- Do not leak DB-only fields such as `passwordHash` in API responses.
- Do not expose `c.env` secrets, stack traces, internal paths, or PII in responses or logs.
- Do not mix external side effects into adapter batch semantics.
- Auth in `@nanokajs/core` remains out of scope. Use `@nanokajs/auth` package for authentication concerns (Issue #74 / #75).

## Commands

Run from the repo root unless otherwise noted.

- `pnpm install` — install all workspace dependencies.
- `pnpm build` — build all packages.
- `pnpm -C packages/nanoka build` — build the library only.
- `pnpm -C packages/nanoka test` — run library tests.
- `pnpm -C packages/nanoka test:workers` — run Worker-side tests.
- `pnpm -C packages/nanoka test:node` — run Node-side tests.
- `pnpm -C packages/nanoka typecheck` — run `tsc --noEmit` against the library.
- `pnpm -C packages/create-nanoka-app build` — build the scaffolder.
- `pnpm -C packages/create-nanoka-app test` — test the scaffolder.
- `pnpm -C examples/basic test` — run the example tests.
- `pnpm -C examples/basic typecheck` — typecheck the example app.
- `pnpm lint` — Biome check across the repo.
- `pnpm format` — Biome format-write across the repo.

Cloudflare / migration flow:

- `pnpm -C examples/basic dev` — `wrangler dev` for the example app.
- `pnpm -C examples/basic exec drizzle-kit generate` — schema diff to SQL.
- `pnpm -C examples/basic exec wrangler d1 migrations apply <DB> --local` — apply D1 migrations.
