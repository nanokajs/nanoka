# Changelog

All notable changes to `@nanokajs/core` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-07-18

### Changed

- **BREAKING**: `engines.node` を `>= 20` から `>= 22` に引き上げ（`@nanokajs/core` / `@nanokajs/auth` / `create-nanoka-app` の全パッケージ）。開発ツールチェーン（wrangler 4 / vite 8）が既に Node 22+ を要求しており、宣言を実態に合わせた。ランタイム（Cloudflare Workers）への影響はなし。Node 20 環境でのローカル開発は非サポートとなる。

## [1.13.1] — 2026-07-15

### Changed

- テスト/開発ツールチェーンを一括更新: `wrangler` 3.114 → 4.111、`vitest` 2.1 → 4.1、`@cloudflare/vitest-pool-workers` 0.5 → 0.18（Vite プラグイン方式 `cloudflareTest()` へ移行）。ライブラリ本体（`dist` / 公開 API / peerDependencies）に変更なし。
- monorepo ルートの `pnpm.overrides` から `wrangler <4` / `undici <6` の固定を解除（undici 7 / ws 8.21 / vite 8 / esbuild 0.28 系に更新され、vitest-pool-workers 経由の transitive advisory を解消）。
- monorepo ルートの `pnpm.overrides` に `esbuild >= 0.25.0` を追加（`drizzle-kit` → `esbuild` 0.19.12 / `@esbuild-kit/core-utils` → `esbuild` 0.18.20 が GHSA-67mh-4wv8-2f99 の対象範囲 `<= 0.24.2` に残るため。`drizzle-kit` 0.31 でも `@esbuild-kit` 経由の 0.18.20 は残るので override で恒久解消）。
- `create-nanoka-app` テンプレートの `wrangler` を `^3.80.0` → `^4.111.0` に更新。
- **開発ツールチェーンに Node.js 22 以上が必要**（`wrangler` 4 は `engines.node >= 22`、`vite` 8 は `>= 22.12`）。`create-nanoka-app` のテンプレートに `"engines": { "node": ">=22" }` を追加。`@nanokajs/core` 自体の `engines` は `>= 20` のまま（ランタイムは Cloudflare Workers であり、ライブラリ本体に変更はないため。`>= 22` への引き上げは major 判断として別途検討）。

## [1.13.0] — 2026-07-15

### Changed

- `@libsql/client`（optional peer）の対応範囲を `^0.14.0` から `>=0.14.0 <0.18.0` に拡張。0.17 系（libsql core 0.5 系）で Turso adapter（`createClient` / `execute` / `batch` / CRUD round-trip）の動作をテストで確認済み。既存の 0.14 系ユーザーは peer warning なしでそのまま利用可能。新規利用時の推奨は `@libsql/client@^0.17.4`。開発用 devDependency も `^0.17.4` に更新。

## [1.12.2] — 2026-07-15

### Changed

- `drizzle-kit` の推奨バージョンを 0.31 系に更新（`create-nanoka-app` テンプレートの devDependency を `^0.28.0` → `^0.31.10`、`examples/basic` も `^0.31.10` に追従）。example スキーマで 0.28.1 と 0.31.10 の `drizzle-kit generate` 出力（SQL）がバイト一致すること、および 0.28 世代の既存 journal / snapshot を 0.31 がそのまま読めること（spurious diff なし）を確認済み。`drizzle-orm` は `^0.45.2` のまま変更なし。

## [1.12.1] — 2026-07-02

### Fixed

- リリース CI 修正のための再公開。`1.10.0`〜`1.12.0` は publish ワークフローの `publish-core` ジョブが `examples/basic` の typecheck 前に `@nanokajs/auth` をビルドしておらず、`TS2307 (Cannot find module '@nanokajs/auth')` で publish が中断し npm 未公開だった。ライブラリ本体のコード変更はなく、`1.12.0` と機能的に同一。

## [1.12.0] — 2026-06-06

### Added

- `findOne` / `update` / `delete` の `idOrWhere` に Drizzle `SQL` 式を渡せるよう対称化（`findMany` / `findAll` の `where: SQL` と同等）。`Session.delete(inArray(Session.table.id, chunk))` のように D1 バインド上限（100）回避の `inArray` チャンク分割が Model API で書けるようになった。
- `Where` 値型に最小 `{ in: [...] }` 演算子を追加（`WhereValue<T>` 型として export）。`findMany` / `findAll` / `findOne` / `update` / `delete` 全 where 経路で一貫して使える。空配列 `{ in: [] }` は 0 行マッチ。json フィールドの値が `{ in: [...] }` 形でも型上は演算子と区別できないが、ランタイムでは json フィールドは常に等値比較される。
- `WhereValue<T>` 型を `@nanokajs/core` から export。

### Notes

- 後方互換。PK スカラー・等値 AND オブジェクト・空 where 400 ガード・prototype pollution ガードは従来どおり動作する。
- サポートする演算子オブジェクトは `in` のみ（escape hatch 対称化）。`and / or / lt / gt / like` はDrizzle 式か `app.db` で書く。

## [1.11.0] — 2026-06-05

### Added

- `t.timestamp().defaultNow()` — timestamp フィールドに DB の `DEFAULT` 句として現在時刻（epoch ミリ秒）を設定する糖衣。`nanoka generate` は `sql` `` `(cast((julianday('now') - 2440587.5)*86400000 as integer))` `` を `.default(...)` に出力し、`timestamp_ms` 列（epoch ms 整数）と整合する。`CURRENT_TIMESTAMP`（text を返す）は使わない。関数 default（`default(() => new Date())`）と異なり生成 SQL に `DEFAULT` 句が出力され、`nanoka generate` の警告が出ない。`inputSchema('create')` で省略可能（DB が値を埋める）。クライアントに値の設定を一切許さない場合は `readOnly()` を併用する。

### Changed

- `create-nanoka-app` のデフォルトテンプレート（`posts.ts`）の `createdAt` を `t.timestamp().defaultNow().readOnly()` に更新。

## [1.10.2] — 2026-05-23

### Security

- `hono` を 4.12.16 → 4.12.22 に更新（JSX SSR の CSS Declaration Injection / Cache Middleware の `Vary` 無視に関する moderate advisory 2 件を解消）。core では該当機能を使用していないため実害低だが defense-in-depth として bump。
- `pnpm.overrides` の `devalue` を `>=5.6.4` → `>=5.8.1`（Svelte `devalue` の sparse array deserialization DoS advisory を解消）。

### Changed

- devDep / 内部依存の lockfile を caret 範囲内の最新へ追従（`@hono/zod-validator` 0.4.0 → 0.4.3、`jiti` 2.6.1 → 2.7.0、`@cloudflare/workers-types`、`@types/node`、`tsup` 等）。peerDependencies の範囲は変更なし。

## [1.8.0] — 2026-05-06

### Added

- Depth-1 relation eager loading via `findMany(adapter, { limit, with })` and `findOne(adapter, idOrWhere, { with })`.
- Typed `WithOptions`, `WithResult`, `RelationKeys`, and `FindOneOptions` exports for relation query results.
- Runtime `with` validation for relation eager loading.
- Bidirectional relation graphs are supported for depth-1 eager loading.

### Notes

- Relation loading follows the documented parent query + relation query + JavaScript grouping strategy; nested eager loading and recursive relation graph traversal remain out of scope.

## [1.6.0] — 2026-05-05

### Added

- `Model.findAll(adapter, options?)` — fetches all rows without a LIMIT clause. Options support `offset`, `orderBy`, and `where` (plain object or Drizzle SQL expression). For batch processing / admin tooling; apply an app-level size guard when used in request handlers.
- `FindAllOptions<Fields>` type exported from `@nanokajs/core`.

### Changed

- `findMany` no longer enforces a `MAX_LIMIT = 100` runtime cap. Calling `findMany(adapter, { limit: 1000 })` now executes normally. The type-level requirement that `limit` is a required parameter is unchanged.

## [1.5.0] — 2026-05-04

### Added

- `findMany` の `where` に Drizzle SQL 式（`like`、`or`、`gt` 等）を渡せるオーバーロードを追加。plain object（等価 AND）と `SQL` 式の両方を受け付ける。
- `Model.toResponseMany(rows)` — row 配列に field policy を一括適用するヘルパ。

## [1.4.0] — 2026-05-04

### Changed

- `create-nanoka-app` のテンプレートを `wrangler.toml` から `wrangler.jsonc` 形式に変換。
- `.gitignore` の生成を npm publish 対応に修正（`node_modules` 等が正しく除外される）。

## [1.3.0] — 2026-05-04

### Added

- `t.uuid().primary().readOnly()` に暗黙 UUID 自動生成を追加。`create` 呼び出し時に id を省略すると自動的に `crypto.randomUUID()` が設定される。

## [1.2.0] — 2026-05-04

### Added

- route 定義に inline `{ openapi: {...} }` を渡せる短縮 API を追加。`app.post(path, { openapi: metadata }, ...handlers)` の形式で OpenAPI メタデータをルートと同じ場所に記述できる。

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
