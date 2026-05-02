# AGENTS.md

This file provides Codex guidance for working in this repository. It is the Codex migration of the Claude Code setup in `CLAUDE.md` and `.claude/`.

## Repository state

The M0 scaffold is in place: pnpm workspace with `packages/nanoka` (library) and `examples/basic` (example app), TypeScript / tsup / vitest-pool-workers / Biome configured. The library implementation is still early Phase 1 work.

Before adding code, read:

- `docs/nanoka.md` for the design.
- `docs/phase1-plan.md` for Phase 1 progress and confirmed decisions.

The design constrains many choices that may otherwise look open-ended.

## Phase 1 progress tracking

`docs/phase1-plan.md` is the source of truth for Phase 1 implementation progress.

- At session start, read `docs/phase1-plan.md` and resume from the first unchecked item unless the user asks for something else.
- As work completes, tick the matching checkbox in `docs/phase1-plan.md` when the item actually meets its completion criteria. Do not batch all progress updates at the end.
- If scope or design shifts, update `docs/phase1-plan.md` in the same change as the code so the plan does not drift.

## What Nanoka is

Nanoka is a thin wrapper over Hono + Drizzle + Zod targeting Cloudflare Workers + D1.

The core thesis: a single model definition is the source of truth for DB schema, TypeScript types, and base validation, but API validation is a deliberate derivation, not an automatic mirror. DB shape and API shape can diverge, for example `passwordHash` may exist in the DB but must not appear in responses.

The design phrase is "80% automatic, 20% explicit". When in doubt, prefer making the explicit 20% obvious in the route handler instead of hiding it in the framework.

## Load-bearing architectural rules

These are non-obvious commitments from `docs/nanoka.md`. Do not violate them unless the user explicitly changes the project direction.

1. No custom migration engine. `nanoka generate` produces Drizzle schema files; diff/SQL generation and application stay with `drizzle-kit` and `wrangler d1 migrations`.
2. Hono is internalized, not coexisting. The router is Hono-compatible and examples follow Hono idioms such as `c.req.valid('json')` and `HTTPException`.
3. Adapter layer from day one. D1 is first-class, but the DB layer must be behind an adapter so Turso/libSQL remain reachable later. Do not bake `D1Database` types into the core query path.
4. Escape hatch always open. `app.db` exposes raw Drizzle, for example `app.db.select().from(User.table)`.
5. `schema()` and `validator()` are separate concerns. `User.schema(opts)` returns a standalone Zod schema; `User.validator(target, opts)` returns a Hono validator.
6. `findMany` must be safe by default. `limit` is required; calling `findMany` without a limit should be a type error. Pagination shape is `{ limit, offset, orderBy }`.
7. Transactions equal D1 batch. Expose D1's batch API directly; do not create a bespoke transaction abstraction.

## Phase boundaries

Do not pull Phase 2 work into Phase 1. If a task appears to require one of these, stop and confirm scope with the user:

- Relations: `t.hasMany()`, `t.belongsTo()`.
- Field-accessor API: `{ pick: f => [f.name] }`, `User.where(f => eq(f.email, x))`. Phase 1 uses string arrays and object-form `where`.
- OpenAPI generation, Turso/libSQL adapters, CLI scaffolder.
- Auth, full-stack React, complex query DSL.

When Phase 2 field accessors eventually land, the `f` object must be `as const`, not a Proxy. Runtime cost must be zero.

## Codex workflow

For normal implementation work:

1. Read `docs/nanoka.md`, `docs/phase1-plan.md`, and the relevant source files.
2. Identify the current milestone and the exact unchecked tasks involved.
3. Keep changes scoped to the requested task or current milestone.
4. Update tests alongside code when behavior or public types change.
5. Run the narrowest useful verification first, then broader checks when risk warrants it.
6. Update `docs/phase1-plan.md` checkboxes only after the corresponding completion criteria are met.

For larger or ambiguous changes, present a short plan before editing. The plan should cover goal, affected files, implementation steps, tests, completion criteria, and deferred Phase 2 items.

Codex custom sub-agents are not a one-to-one match for Claude Code custom agents. If the user explicitly asks for delegated or parallel agent work, map the old Claude roles this way:

- `planner`: use a planning pass before edits; inspect docs and produce a concrete implementation plan.
- `implementer`: use a worker-style implementation pass that follows the approved plan without expanding scope.
- `implementation-reviewer`: use a code-review pass focused on design conformance, load-bearing rules, phase boundaries, and plan drift.
- `security-reviewer`: use a security review pass for changes touching external input, DB queries, auth, secrets, Cloudflare Workers, or D1 behavior.

Do not invent Phase 1 design decisions during implementation. If the plan and existing code conflict, stop and surface the conflict.

## Security review triggers

Run or request a security-focused review when a change touches:

- HTTP body, params, query, or headers.
- Zod validators or Hono validation.
- DB query construction, Drizzle escape hatches, D1 adapters, or batch behavior.
- Auth, authorization, sessions, tokens, API keys, or secrets.
- CORS, redirects, external `fetch`, logging, or error messages.
- New npm dependencies.

Security review priorities:

- External input must pass through validation such as `c.req.valid('json')`.
- DB access should use Drizzle parameterized queries.
- Do not leak DB-only fields such as `passwordHash` in API responses.
- Do not expose `c.env` secrets, stack traces, internal paths, or PII in responses or logs.
- Do not mix external side effects into D1 batch semantics.
- Auth remains out of scope for Phase 1 unless the user explicitly changes scope.

## Commands

Run from the repo root unless otherwise noted.

- `pnpm install` - install all workspace dependencies.
- `pnpm build` - build all packages.
- `pnpm -C packages/nanoka build` - build the library only.
- `pnpm -C packages/nanoka test` - run vitest under `@cloudflare/vitest-pool-workers`.
- `pnpm -C packages/nanoka typecheck` - run `tsc --noEmit` against the library.
- `pnpm lint` - Biome check across the repo.
- `pnpm format` - Biome format-write across the repo.

Cloudflare flow, used from M7 onward:

- `pnpm -C examples/basic dev` - `wrangler dev` for the example app.
- `pnpm -C examples/basic exec drizzle-kit generate` - schema diff to SQL after M6.
- `pnpm -C examples/basic exec wrangler d1 migrations apply <DB> --local` - apply migrations.

## Migration notes from Claude Code

- `CLAUDE.md` was migrated into this Codex-readable `AGENTS.md`.
- `.claude/settings.local.json` command allow rules do not have a direct repository-local Codex equivalent. Codex command permissions are controlled by the active sandbox and approval settings.
- `.claude/agents/*` were migrated into the Codex workflow and review guidance above. Codex may use built-in agent delegation only when explicitly requested by the user.
- `.claude/skills/phase1-next/SKILL.md` was migrated into the Phase 1 progress and workflow sections above. One milestone at a time remains the intended operating mode.
