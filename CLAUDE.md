# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

The M0 scaffold is in place: pnpm workspace with `packages/nanoka` (library) and `examples/basic` (example app), TypeScript / tsup / vitest-pool-workers / Biome configured. The library `src/` is still essentially empty — implementation begins at M1. Read `docs/nanoka.md` for the design and `docs/phase1-plan.md` for milestone progress before adding code; the design constrains many choices that look like free decisions.

## Phase 1 progress tracking

`docs/phase1-plan.md` is the source of truth for Phase 1 implementation progress. It contains confirmed design decisions and milestone checkboxes (M0–M8).

- **At session start**: read `docs/phase1-plan.md` to see what's done and what's next. Resume from the first unchecked item.
- **As work completes**: tick the corresponding checkbox in `docs/phase1-plan.md` the moment a sub-task is done — don't batch updates to end-of-session. A tick means the item meets the milestone's "完了基準" (completion criteria), so verify before checking.
- **If scope or design shifts**: update the plan file (decisions, milestones, or out-of-scope list) in the same change as the code, so the plan never drifts from reality.

## What Nanoka is

A thin wrapper over **Hono + Drizzle + Zod** targeting **Cloudflare Workers + D1**. The thesis: a single model definition is the source of truth for DB schema, TypeScript types, and *base* validation — but API validation is a deliberate derivation, not an automatic mirror, because DB shape and API shape diverge (e.g. `passwordHash` exists in the DB but must not appear in responses).

The phrase the design uses is **"80% automatic, 20% explicit"**. When in doubt, prefer making the 20% obvious in the route handler over hiding it in the framework.

## Load-bearing architectural rules

These are non-obvious commitments from `docs/nanoka.md` that future code must respect. Violating them would contradict the project's positioning, not just its style.

1. **No custom migration engine.** `nanoka generate` produces Drizzle schema files; diff/SQL generation and application stay with `drizzle-kit` and `wrangler d1 migrations`. Do not write a diff engine, do not auto-apply migrations.
2. **Hono is *internalized*, not coexisting.** The router is Hono-compatible and examples follow Hono idioms (`c.req.valid('json')`, `HTTPException` for errors). Do not invent a parallel error type or a non-Hono validator interface.
3. **Adapter layer from day one.** D1 is first-class but the DB layer must be behind an adapter so Turso/libSQL remain reachable later. Don't bake `D1Database` types into the core query path.
4. **Escape hatch always open.** `app.db` exposes raw Drizzle (`app.db.select().from(User.table)...`). Never close this off in pursuit of a cleaner abstraction.
5. **`schema()` and `validator()` are separate concerns.** `User.schema(opts)` returns a Zod schema usable standalone; `User.validator(target, opts)` returns a Hono validator. Keep them as two methods so the validation library stays swappable later.
6. **`findMany` must be safe by default.** `limit` is required (default 20 in examples); calling `findMany` without a limit should be a type error, not a runtime footgun. Pagination shape is `{ limit, offset, orderBy }`.
7. **Transactions = D1 batch.** Expose D1's batch API directly. No bespoke transaction abstraction.

## Phase boundaries — do not pull Phase 2 work into Phase 1

The design explicitly defers several features. If a task seems to require one of these, confirm scope before implementing — pulling them forward is the project's main scope-creep risk.

- **Relations** (`t.hasMany()`, `t.belongsTo()`): Phase 2. In Phase 1, users write joins in raw Drizzle.
- **Field-accessor API** (`{ pick: f => [f.name] }`, `User.where(f => eq(f.email, x))`): Phase 2. Phase 1 uses string arrays and object-form `where`. When Phase 2 lands, the `f` object must be `as const`, not a Proxy — runtime cost is required to be zero.
- **OpenAPI generation, Turso/libSQL adapters, CLI scaffolder**: Phase 2/3.
- **Auth, full-stack React, complex query DSL**: explicitly out of scope at every phase.

## Commands

Run from repo root unless otherwise noted.

- `pnpm install` — install all workspace dependencies
- `pnpm build` — build all packages (currently just `packages/nanoka`)
- `pnpm -C packages/nanoka build` — build the library only (tsup, ESM + dts)
- `pnpm -C packages/nanoka test` — run vitest under @cloudflare/vitest-pool-workers
- `pnpm -C packages/nanoka typecheck` — `tsc --noEmit` against the library
- `pnpm lint` — Biome check across the repo
- `pnpm format` — Biome format-write across the repo

Cloudflare flow (used from M7 onward, not yet wired):
- `pnpm -C examples/basic dev` — `wrangler dev` for the example app
- `pnpm -C examples/basic exec drizzle-kit generate` — schema diff → SQL (after M6)
- `pnpm -C examples/basic exec wrangler d1 migrations apply <DB> --local` — apply migrations
