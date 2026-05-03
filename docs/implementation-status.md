# Implementation Status

2026-05-03 時点の実装整理。Claude Code の作業により Phase 2 後半と Phase 3 の一部が混ざって実装されたため、本ファイルを入口にして現状を把握する。

## 正本

- Phase 1 履歴: `docs/phase1-plan.md`
- Phase 1.5 履歴: `docs/phase1.5-plan.md`
- Phase 2 前半 / 1.0.0 中心 API: `docs/phase2-plan.md`
- Phase 2 後半 / Phase 3 混在実装の履歴: `docs/phase2後半-plan.md`
- 今後の未実装候補: `docs/backlog.md`

## 実装済み

### 1.0.0 中心 API

- Field policy: `serverOnly()` / `writeOnly()` / `readOnly()`
- API boundary schema: `inputSchema('create' | 'update')` / `outputSchema()`
- Validator preset: `validator(target, 'create' | 'update')`
- Response helper: `toResponse(row)`
- `t.json(zodSchema)` runtime validation
- Schema / validator 用 field accessor: `{ pick: f => [f.name] }` / `{ omit: f => [f.passwordHash] }`
- Zod 3 / 4 peer dependency support
- Model-level OpenAPI component generation

### 1.x として追加済み

- Route-level OpenAPI metadata: `app.openapi(metadata)`
- OpenAPI document generation: `app.generateOpenAPISpec(options)`
- Swagger UI middleware: `swaggerUI({ url, title? })`
- Turso/libSQL adapter: `tursoAdapter(client)` from `@nanokajs/core/turso`
- CLI scaffolder package: `create-nanoka-app`

## 未実装として残す

- Relations: `t.hasMany()` / `t.belongsTo()`
- Typed query helper: `User.where(f => eq(f.email, x)).limit(10)` など
- VSCode extension
- Codex / Claude Code plugin
- Auth / full-stack React / Drizzle replacement DSL は引き続き全 Phase 外

## 注意

route-level OpenAPI は documentation / spec generation 用。runtime validation の source of truth は引き続き Zod schema (`inputSchema()` / `outputSchema()`) と Hono validator。
