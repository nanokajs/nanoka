# Implementation Status

2026-05-04 時点の実装整理。このファイルを Nanoka の shipped / pending split の入口にする。

過去の phase plan と backlog は GitHub Issues へ移管済み。これらは履歴ファイルであり、削除しても現在の作業入口としては使わない。

## 正本

- Product / architecture design: `docs/nanoka.md`
- Current shipped / pending split: this file
- Remaining work and accepted risks: [GitHub Issues](https://github.com/nanokajs/nanoka/issues)

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

## 未実装として残す（将来候補）

- Typed query helper: `User.where(f => eq(f.email, x)).limit(10)` など — [#15](https://github.com/nanokajs/nanoka/issues/15)
- VSCode extension — [#16](https://github.com/nanokajs/nanoka/issues/16)
- Codex / Claude Code plugin — [#17](https://github.com/nanokajs/nanoka/issues/17)
- `findMany` offset 上限 — [#18](https://github.com/nanokajs/nanoka/issues/18)

## Non-goal（全 Phase 外）

Relations (`t.hasMany()` / `t.belongsTo()`) / Auth / full-stack React / Drizzle replacement DSL は実装しない。

### Relations を non-goal とする根拠

- cascade / N+1 / join 型推論は Drizzle replacement DSL に最も寄りやすい領域であり、「Drizzle の複雑な query DSL を再発明しない」方針と直接抵触する
- `app.db` の `innerJoin` / `leftJoin` (escape hatch) で代替可能（README に例あり）
- field policy / inputSchema で達成した「80% automatic, 20% explicit」バランスを崩す
- 1.0.0 stable surface の必須条件に含まれていない

### 再検討トリガー（永久 non-goal ではない）

以下が同時に満たされた場合のみ新規 Issue を起票して再検討する（#14 の reopen ではなく新規）:

- ユーザーから「`app.db` 手書き Drizzle では足りない」具体的ユースケースが複数集まる
- cascade / N+1 / join 型推論を DSL 再発明なしに収めるパターンが先行 OSS で確立する

## 運用・リスク追跡

- GitHub repository setup — [#19](https://github.com/nanokajs/nanoka/issues/19)
- `CONTRIBUTING.md` — [#20](https://github.com/nanokajs/nanoka/issues/20)
- LICENSE sync check — [#21](https://github.com/nanokajs/nanoka/issues/21)
- npm README relative links — [#22](https://github.com/nanokajs/nanoka/issues/22)
- Historical docs cleanup — [#23](https://github.com/nanokajs/nanoka/issues/23)
- README onboarding parity CI — [#24](https://github.com/nanokajs/nanoka/issues/24)
- `crud.ts` Biome ignore consistency — [#25](https://github.com/nanokajs/nanoka/issues/25)
- Publish extensions — [#26](https://github.com/nanokajs/nanoka/issues/26), [#27](https://github.com/nanokajs/nanoka/issues/27), [#28](https://github.com/nanokajs/nanoka/issues/28), [#29](https://github.com/nanokajs/nanoka/issues/29)
- Accepted risk follow-ups — [#30](https://github.com/nanokajs/nanoka/issues/30), [#31](https://github.com/nanokajs/nanoka/issues/31), [#32](https://github.com/nanokajs/nanoka/issues/32)

## Phase 履歴要約

- Phase 1 completed the MVP: model DSL, schema generation, D1 adapter, CRUD, schema / validator derivation, Hono-compatible router, CLI generation, README, and Workers verification.
- Phase 1.5 completed public-library operations: env generic typing, sturdier example seeding, CI/CD, onboarding parity, publish automation, and action pinning.
- Phase 2 completed the stable 1.0.0 API boundary: field policies, input/output schemas, validator presets, response shaping, Zod 3/4 compatibility, create/update input typing, and model-level OpenAPI components.
- Phase 2後半 / Phase 3 work shipped as 1.x features: route-level OpenAPI, Swagger UI, Turso/libSQL adapter, and `create-nanoka-app`.

## 注意

route-level OpenAPI は documentation / spec generation 用。runtime validation の source of truth は引き続き Zod schema (`inputSchema()` / `outputSchema()`) と Hono validator。
