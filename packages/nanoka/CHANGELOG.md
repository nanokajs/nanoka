# Changelog

All notable changes to `@nanokajs/core` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-05-04

### Added

- Unified migration workflow: `nanoka generate` now automatically runs `drizzle-kit generate` when `drizzle.config.ts` (or `.js` / `.mjs`) is detected in the working directory.
- `--apply --db <name>` flag: runs the full pipeline (schema generation → `drizzle-kit generate` → `wrangler d1 migrations apply --local`) in one command.
- `--remote` flag: used with `--apply` to apply migrations remotely instead of locally.
- `--no-migrate` flag: skips `drizzle-kit generate`, running schema generation only.
- `--package-manager <pm>` flag: controls how sub-commands are invoked (`npx` default, `pnpm`, `npm`, `yarn`, `bun`).
- `NanokaConfig.migrate` field: optional config for `drizzleConfig`, `database`, and `packageManager` — can supply `--db` and `--package-manager` defaults via `nanoka.config.ts`.

## [1.0.2] — 2026-05-03

### Added

- Turso/libSQL adapter via `@nanokajs/core/turso`.
- Route-level OpenAPI metadata registration and OpenAPI 3.1 document generation.
- Swagger UI middleware.
- `create-nanoka-app` package for scaffolding minimal Nanoka projects.

### Documentation

- Reclassified the above as shipped 1.x features rather than future Phase 2/3 candidates.

## [1.0.0] — 2026-05-03

### Stable API surface

The following public APIs are now considered stable. Breaking changes to these
will require a major version bump per SemVer.

**Field DSL**
- `t.string()`, `t.uuid()`, `t.integer()`, `t.number()`, `t.boolean()`, `t.timestamp()`, `t.json(zodSchema?)`
- Modifiers: `.primary()`, `.unique()`, `.optional()`, `.default(fn)`, `.min(n)`, `.max(n)`, `.email()`
- Policies: `.serverOnly()`, `.writeOnly()`, `.readOnly()`

**Model API**
- `defineModel(name, fields)`, `app.model(name, fields)`
- Schema derivation: `Model.schema(opts?)`, `Model.inputSchema('create' | 'update', opts?)`, `Model.outputSchema(opts?)`
- Validator: `Model.validator(target, opts | preset, hook?)` — presets: `'create'`, `'update'`
- Response shaping: `Model.toResponse(row)`
- Field accessor (typo-safe): `Model.schema({ pick: f => [f.fieldName] })`, `{ omit: f => [f.fieldName] }`
- CRUD: `Model.findMany({ limit, offset?, orderBy? })` (`limit` required), `Model.findOne`, `Model.create`, `Model.update`, `Model.delete`
- Escape hatch: `app.db` (raw Drizzle), `app.batch(...)` (D1 batch)

**Adapter**
- `d1Adapter(env.DB)`, `Adapter` interface

**OpenAPI seed**
- `Model.toOpenAPIComponent()`, `Model.toOpenAPISchema(usage)`

**Router**
- `nanoka<E extends Env = BlankEnv>(adapter)` (Hono-compatible)

**CLI**
- `nanoka generate` (model → Drizzle schema codegen)

**Config**
- `defineConfig` from `@nanokajs/core/config`

### Added

- Field policies (`serverOnly`, `writeOnly`, `readOnly`) for API boundary control — Phase 2A / M1
- Purpose-specific schemas: `Model.inputSchema('create' | 'update')`, `Model.outputSchema()` — M1
- Validator presets: `Model.validator('json', 'create')`, `Model.validator('json', 'update')` — M1
- `Model.toResponse(row)` for explicit response shaping — M1
- `t.json(zodSchema)` runtime validation via Zod — M1
- Field accessor API (`{ pick: f => [...] }`) for typo-safe schema options — M2
- Zod 4 support: `peerDependencies.zod: ^3.23.0 || ^4.0.0` — M2
- Precise create/update input types: `CreateInput<Fields>` reflects `readOnly` / `default` / `optional` / `primary` — M2
- OpenAPI component generation per model: `Model.toOpenAPIComponent()` — M3

### Changed

- `peerDependencies.zod` widened from `^3.23.0` to `^3.23.0 || ^4.0.0` (not a breaking change for v3 users)
- `Nanoka` is now `Nanoka<E extends Env = BlankEnv> extends Hono<E>` (not a breaking change due to default)

### Notes

- **OpenAPI seed scope**: `toOpenAPIComponent()` / `toOpenAPISchema()` generate documentation /
  component seed output derived from a representative subset of Zod types. They are not intended
  as the enforcement source for API gateways or client-side validators. The runtime source of truth
  for validation remains the Zod schema returned by `inputSchema()` / `outputSchema()`.
- **Not in 1.0.0** (planned for 1.x): relations (`hasMany` / `belongsTo`), Turso / libSQL adapter,
  `create-nanoka-app` scaffolder, route-level OpenAPI + Swagger UI, VSCode extension.

## [0.1.x] — pre-1.0

Pre-1.0 development. See [git history](https://github.com/nanokajs/nanoka/commits/main) for details.
