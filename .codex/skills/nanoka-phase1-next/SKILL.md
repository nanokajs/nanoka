---
name: nanoka-phase1-next
description: Advance the Nanoka repository's Phase 1 plan one milestone at a time. Use when the user asks to continue Phase 1, run the next milestone, resume the implementation plan, use the migrated Claude phase1-next workflow, or coordinate Nanoka milestone work using docs/phase1-plan.md, docs/nanoka.md, AGENTS.md, and the project's tests.
---

# Nanoka Phase 1 Next

Use this skill to move Nanoka Phase 1 forward by exactly one milestone. Stop after that milestone unless the user explicitly asks to continue.

## Required context

From the repository root, read these before planning or editing:

- `AGENTS.md` for Codex-specific project instructions.
- `docs/nanoka.md` for the design.
- `docs/phase1-plan.md` for milestone status, confirmed decisions, and completion criteria.
- Relevant source and test files for the target milestone.

If `AGENTS.md` is absent, fall back to `CLAUDE.md`.

## Step 1: Select one milestone

Inspect all milestones in `docs/phase1-plan.md` from M0 through M8.

- Choose the first milestone with any unchecked `- [ ]` item.
- If the user named a milestone, use that milestone, but warn if earlier milestones are incomplete.
- If all milestones are complete, report that Phase 1 is complete and stop.
- Work on one milestone only. Do not automatically continue into the next milestone.

Before making changes, state the selected milestone, its incomplete items, and the relevant completion criteria. If the scope is ambiguous or appears to cross a Phase boundary, ask the user before editing.

## Step 2: Plan

Create a concrete implementation plan before editing when the milestone touches multiple files, changes public API, or requires design interpretation.

The plan should include:

- Goal: what must be true for this milestone to count as done.
- Constraints: relevant load-bearing rules from `AGENTS.md` / `CLAUDE.md` and Phase 1 boundaries.
- Files: expected source, test, and documentation files to change.
- Steps: implementation sequence with key symbols, types, or APIs.
- Tests: focused verification commands and what they prove.
- Completion criteria: exact `docs/phase1-plan.md` checkboxes that may be ticked.
- Deferred work: Phase 2 or out-of-scope items that must not be implemented now.

Do not expand scope for "future-proofing". If the plan conflicts with `docs/nanoka.md` or the existing code, stop and surface the conflict.

## Step 3: Implement

Implement only the selected milestone and approved/requested scope.

- Match existing TypeScript, Hono, Drizzle, Zod, Vitest, and Biome style.
- Keep Hono idioms visible: `c.req.valid('json')`, `HTTPException`, and Hono-compatible validators.
- Keep the adapter layer intact; do not bake `D1Database` into the core query path.
- Preserve raw Drizzle access through `app.db`.
- Keep `schema()` and `validator()` separate.
- Keep `findMany` safe by type: `limit` is required and pagination shape is `{ limit, offset, orderBy }`.
- Expose D1 batch directly for transaction behavior; do not invent a transaction abstraction.
- Do not implement relations, field-accessor APIs, OpenAPI generation, Turso/libSQL adapters, CLI scaffolding, auth, full-stack React, or complex query DSL unless the user explicitly changes Phase 1 scope.

Update `docs/phase1-plan.md` checkboxes as each subtask actually meets its completion criteria. A checked item means the corresponding code and tests are complete.

## Step 4: Verify

Run the narrowest useful checks first, then broader checks when the change has wider impact.

Common commands:

- `pnpm -C packages/nanoka test`
- `pnpm -C packages/nanoka typecheck`
- `pnpm -C packages/nanoka build`
- `pnpm lint`
- `pnpm build`

For M7 Cloudflare integration work, use the Cloudflare commands listed in `AGENTS.md` / `CLAUDE.md` when applicable.

If a command cannot run because dependencies, network, local services, or credentials are missing, report the exact blocker and the verification that remains undone.

## Step 5: Review gates

Do a design-conformance review before finishing:

- Check implementation against `docs/nanoka.md`.
- Check load-bearing rules from `AGENTS.md` / `CLAUDE.md`.
- Check Phase boundaries and reject accidental Phase 2 work.
- Check that `docs/phase1-plan.md` checkboxes match reality.
- Check for unplanned files or unrelated edits, especially in an already dirty worktree.

Do a security review when the milestone touches external input, validation, DB queries, adapters, D1 batch behavior, auth/secrets, CORS, redirects, logging, error messages, or new npm dependencies.

Security review focus:

- External input should go through Zod/Hono validation.
- DB access should use Drizzle parameterized queries.
- DB-only fields such as `passwordHash` must not leak into API responses.
- Secrets, stack traces, internal paths, and PII must not be exposed in responses or logs.
- Auth remains out of scope for Phase 1 unless explicitly requested.

## Step 6: Stop cleanly

Finish with a concise summary:

- Milestone completed or remaining blockers.
- Files changed.
- Checkboxes updated in `docs/phase1-plan.md`.
- Verification commands run and results.
- Next milestone, if any.

Do not start the next milestone in the same run unless the user explicitly asks.
