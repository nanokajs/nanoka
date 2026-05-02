<p align="center">
  <img src="https://raw.githubusercontent.com/nanokajs/nanoka/main/assets/images/nanoka-logo.png" alt="nanoka" width="200" />
</p>

# nanoka

A thin wrapper over Hono + Drizzle + Zod for Cloudflare Workers + D1.

## What is this

Nanoka solves the repetitive wiring of Hono routing, Drizzle ORM, and Zod validation in Cloudflare Workers projects. Define a model once, and nanoka derives the DB schema, TypeScript types, and request validators from it. The remaining 20% — what your API exposes versus what the DB stores — stays explicit in each route handler.

The design thesis is **"80% automatic, 20% explicit"**: automated derivation handles the common case, while intentional escape hatches keep the framework thin and auditable. `passwordHash` in the DB, for example, is excluded from responses by a deliberate `omit` in the validator call, not by hidden framework magic.

Nanoka targets Cloudflare Workers + D1 (SQLite) as first-class. It wraps Hono, so any Hono middleware and idiom works directly. Raw Drizzle is always accessible via `app.db` when the typed API is not enough.

## Repository structure

```
packages/nanoka/          # The library (published to npm as "@nanokajs/core")
examples/basic/           # Example Cloudflare Workers app demonstrating end-to-end usage
assets/                   # Repository assets (logo, etc.)
docs/                     # Design documents and implementation plan
```

## Documentation

- [Library README](packages/nanoka/README.md) — install, quickstart, full API reference
- [Design document](docs/nanoka.md) — architecture decisions and design rationale
- [Phase 1 plan](docs/phase1-plan.md) — milestone progress (M0–M8)
- [Example app](examples/basic/README.md) — complete CRUD example with deployment steps

## Development

```bash
# Install all workspace dependencies
pnpm install

# Build the library (ESM + type declarations)
pnpm build

# Run all tests
pnpm -C packages/nanoka test

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
