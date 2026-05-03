<p align="center">
  <img src="https://raw.githubusercontent.com/nanokajs/nanoka/main/assets/images/nanoka-logo.png" alt="nanoka" width="200" />
</p>

# nanoka

A thin wrapper over Hono + Drizzle + Zod for Cloudflare Workers + D1, with Turso/libSQL support through the adapter layer.

**Stable 1.x.** Supports Zod 3 and Zod 4.

## What is this

Nanoka solves the repetitive wiring of Hono routing, Drizzle ORM, and Zod validation in Cloudflare Workers projects. Define a model once, and nanoka derives the DB schema, TypeScript types, and request validators from it. The remaining 20% — what your API exposes versus what the DB stores — stays explicit in each route handler.

The design thesis is **"80% automatic, 20% explicit"**: automated derivation handles the common case, while intentional escape hatches keep the framework thin and auditable. Field policies (`.serverOnly()`, `.writeOnly()`, `.readOnly()`) encode DB/API boundary intent directly on the field; `inputSchema('create' | 'update')` and `outputSchema()` apply those policies automatically. `passwordHash` in the DB, for example, can be marked `.serverOnly()` so it is excluded from both input and output schemas without a manual `omit` on every route.

Nanoka targets Cloudflare Workers + D1 (SQLite) as first-class, while `tursoAdapter(client)` supports Turso/libSQL as a drop-in adapter. It wraps Hono, so any Hono middleware and idiom works directly. Raw Drizzle is always accessible via `app.db` when the typed API is not enough.

1.x also includes explicit route-level OpenAPI support: route handlers stay normal Hono routes, while `app.openapi(metadata)` records operation metadata for `app.generateOpenAPISpec(options)`. Swagger UI is available as middleware for browsable docs. OpenAPI output is documentation/spec generation; runtime validation remains Zod + Hono validator.

## Repository structure

```
packages/nanoka/          # The library (published to npm as "@nanokajs/core")
packages/create-nanoka-app/ # Scaffold CLI (published as "create-nanoka-app")
examples/basic/           # Example Cloudflare Workers app demonstrating end-to-end usage
assets/                   # Repository assets (logo, etc.)
docs/                     # Design documents, status, backlog, and phase history
```

## Documentation

- [Library README](packages/nanoka/README.md) — install, quickstart, full API reference
- [create-nanoka-app README](packages/create-nanoka-app/README.md) — scaffold CLI usage
- [Contributing](CONTRIBUTING.md) — development workflow and manual release process
- [Implementation status](docs/implementation-status.md) — current shipped / pending split
- [Design document](docs/nanoka.md) — architecture decisions and design rationale
- [Backlog](docs/backlog.md) — accepted risks, follow-ups, and remaining candidates
- [Phase 1 plan](docs/phase1-plan.md) — Phase 1 completion history (M0–M8, done)
- [Phase 1.5 plan](docs/phase1.5-plan.md) — Phase 1.5 completion history (M1–M5, done)
- [Phase 2 plan](docs/phase2-plan.md) — Phase 2 completion history (M1–M4, done)
- [Phase 2後半 plan](docs/phase2後半-plan.md) — Phase 2後半 / Phase 3 mixed implementation history
- [Example app](examples/basic/README.md) — complete CRUD example with deployment steps

## Current scope

Implemented:

- Model DSL, `nanoka generate`, D1 adapter, CRUD, schema / validator derivation
- Field policies, input/output schemas, response shaping, Zod 3/4 support
- Model-level and route-level OpenAPI generation, plus Swagger UI
- Turso/libSQL adapter
- `create-nanoka-app` scaffold CLI

Still pending or intentionally out of scope:

- Relations (`t.hasMany()` / `t.belongsTo()`)
- Typed query helper (`User.where(f => eq(f.email, x)).limit(10)`)
- VSCode extension / Codex or Claude Code plugin
- Auth, full-stack React, or a query DSL that replaces Drizzle

## Development

```bash
# Install all workspace dependencies
pnpm install

# Build the library (ESM + type declarations)
pnpm build

# Run all tests
pnpm -C packages/nanoka test

# Test the scaffolder
pnpm -C packages/create-nanoka-app test

# Test the example app
pnpm -C examples/basic test

# Type-check the library
pnpm -C packages/nanoka typecheck

# Type-check the example app
pnpm -C examples/basic typecheck

# Run Biome linter
pnpm lint

# Run Biome formatter
pnpm format
```

## License

MIT — see [LICENSE](LICENSE).
