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
- Unified migration workflow: `nanoka generate --apply --db <name>` — [#41](https://github.com/nanokajs/nanoka/issues/41)
- Inline route OpenAPI: `app.post(path, { openapi: {...} }, ...handlers)` — [#38](https://github.com/nanokajs/nanoka/issues/38)
- `t.uuid().primary().readOnly()` 暗黙 UUID 自動生成 — [#42](https://github.com/nanokajs/nanoka/issues/42)
- `create-nanoka-app` テンプレートを `wrangler.jsonc` 形式に変換、`.gitignore` 生成を npm publish 対応 — [#46](https://github.com/nanokajs/nanoka/issues/46)
- `findMany` の `where` に Drizzle SQL 式を渡せるオーバーロード — [#39](https://github.com/nanokajs/nanoka/issues/39)
- `Model.toResponseMany(rows)` ヘルパ — [#39](https://github.com/nanokajs/nanoka/issues/39)
- `Model.findAll(adapter, options?)` — LIMIT なし全件取得。`findMany` の `MAX_LIMIT = 100` ランタイムキャップを廃止 — [#49](https://github.com/nanokajs/nanoka/issues/49)
- `toOpenAPISchema('output', { with })` による relations nested 展開（spec-only、runtime は Zod のまま） — [#91](https://github.com/nanokajs/nanoka/issues/91)
- `findMany` の `offset` runtime cap = 100_000 — [#18](https://github.com/nanokajs/nanoka/issues/18)

### AI coding support

- `llms.txt` / `llms-full.txt` at repo root, served via GitHub raw URL — [#17](https://github.com/nanokajs/nanoka/issues/17)

### docs-site

- プロジェクト基盤セットアップ（Cloudflare Workers + Hono scaffold） — [#56](https://github.com/nanokajs/nanoka/issues/56)
- レイアウト・ルーティング実装（HTML レイアウト / サイドバーナビ / ページレジストリ） — [#57](https://github.com/nanokajs/nanoka/issues/57)
- Markdown レンダリング・シンタックスハイライト（marked + marked-highlight + highlight.js、Atom One Dark CSS） — [#58](https://github.com/nanokajs/nanoka/issues/58)
- スタイリング・レスポンシブ対応（CSS-only ドロワー、タイポグラフィ、OGP メタタグ） — [#59](https://github.com/nanokajs/nanoka/issues/59)
- コンテンツ執筆（Introduction / Getting Started / Core Concepts）+ 言語トグル機構（EN/JA） — [#60](https://github.com/nanokajs/nanoka/issues/60)
- API Reference コンテンツ執筆（Field Types / Field Policies / Schema & Validator / CRUD Methods / Response Shaping / OpenAPI / Escape Hatch / Adapters） — [#61](https://github.com/nanokajs/nanoka/issues/61)
- Guides / CLI Reference コンテンツ執筆（Migration Workflow / Error Handling / Using with Turso / CLI Reference） — [#62](https://github.com/nanokajs/nanoka/issues/62)

## 実装中（設計確定済み）

- Relations API (`t.hasMany()` / `t.belongsTo()` / `findMany({ with })`) — [#14](https://github.com/nanokajs/nanoka/issues/14)
  - 設計仕様: `docs/nanoka.md` "Relations API" 節
  - フィールドビルダー実装 — #14-2 ✅ 完了（v1.7.0）
  - クエリ API 実装 — #83 ✅ 完了（v1.8.0）
  - depth 1 `with` で双方向 relation graph を許容 — #89 ✅ 完了（v1.8.0）
  - `toOpenAPISchema('output', { with })` による relations nested 展開（spec-only、runtime は Zod のまま） — [#91](https://github.com/nanokajs/nanoka/issues/91) ✅ 完了
  - docs-site 更新 — #14-5 / #92 ✅ 完了

## Non-goal（全 Phase 外）

Auth（コアに含めない）/ full-stack React / Drizzle replacement DSL は実装しない。Auth は `@nanokajs/auth` パッケージとして別途提供（パッケージ骨格は v1.9.0 で追加済み — Issue #74 / #75）。

`@nanokajs/auth` shipped:
- `Hasher` インターフェース（`hash` / `verify`）— Issue #76
- `pbkdf2Hasher`: `crypto.subtle` のみを使う zero-dependency PBKDF2 実装（SHA-256、310,000 iterations、タイミングセーフ比較）— Issue #76
- `sign` / `verify` ユーティリティ（HS256 / `crypto.subtle`）— Issue #77
- `authMiddleware`: Hono Bearer トークン検証ミドルウェア（ジェネリクス + Hono `Variables`）— Issue #78
  - `payload.type === 'access'` クレーム検証（refresh token を 401 で拒否する security fix）— Issue #109
- `createAuth()`: ログイン・リフレッシュ・ミドルウェアを束ねたファクトリ (`loginHandler` / `refreshHandler` / `middleware()`) — Issue #79
- cookie 送出モード（loginHandler / refreshHandler の HttpOnly cookie 対応）— Issue #100
- refresh token rotation / blacklist — Issue #99
  - `BlacklistStore` インターフェース（`add` / `has`）
  - `kvBlacklistStore`: Workers KV を使った blacklist 実装（TTL 自動失効）
  - `createAuth` に `jwt.rotation` / `blacklist` オプション追加（rotation: true + blacklist 未指定は fail-fast）
  - rotation 有効時: refresh token に `jti` 付与、再利用拒否、新 refresh token 発行
  - cookie モード対応: rotation 時に `Set-Cookie: refresh_token` も上書き
- `examples/basic` への auth 統合と E2E テスト — Issue #80 / #111
  - `/auth/register` / `/auth/login` / `/auth/refresh` / `/me` の参考実装
  - register → login → /me → refresh → /me のハッピーパス + 不正トークン 401 を Workers ランタイムで検証

### Typed query helper を non-goal とする根拠

- `findOne` / `update` / `delete` は既に `Where<Fields>`（等価 AND）を受け付けており、単純なルックアップは shipped
- `User.where(f => eq(...))` 形は `and / or / inArray / lt / gt / like` まで広がり、Drizzle replacement DSL に直結する
- 等価 AND のみの最小 API（`findMany({ where: { email } })`）は `OR` / 範囲 / `LIKE` の瞬間に `app.db` が必要になり「半端な抽象」になる
- チェーン形（`User.where(...).limit(10)`）は `limit` 呼び忘れを型で強制しづらく、`findMany` の limit 必須安全方針を弱める
- `app.db.select().from(User.table).where(eq(...)).limit(10)` は 1 行で書け、README で推奨済み（escape hatch）

### 再検討トリガー（Typed query helper — 永久 non-goal ではない）

以下が同時に満たされた場合のみ新規 Issue を起票して再検討する（#15 の reopen ではなく新規）:

- ユーザーから「`app.db` 手書き Drizzle では足りない」具体的ユースケースが複数集まる
- `findMany` の等価 AND ユースケース（管理画面の単純フィルタ等）が 1.x 利用者の主流要望として現れる
- `limit` 必須の安全方針を壊さない API 形が先行 OSS で確立する

### VSCode extension を non-goal とする根拠

- core API の価値（model DSL → schema/validator 派生・OpenAPI・adapters）は TypeScript 言語サーバと既存 Hono / Drizzle / Zod エコシステムで完結しており、editor integration なしで「80% automatic, 20% explicit」を実現できる
- VSCode 拡張の候補機能は既存ツールで代替可能: DSL 補完 → TypeScript 言語サーバ、schema generation → `nanoka generate` CLI、docs link → README / Swagger UI、diagnostics → `tsc --noEmit` と Biome
- Marketplace publish・VSCode API メジャーアップ追従・Cursor/Windsurf などの派生 IDE 対応など、維持コストが core 価値に対して大きい
- `#14`（Relations）/ `#15`（Typed query helper）と同じ「核心価値でないものを抱え込まない」方針の延長

### 再検討トリガー（VSCode extension — 永久 non-goal ではない）

以下が同時に満たされた場合のみ新規 Issue を起票して再検討する（#16 の reopen ではなく新規）:

- ユーザーから「TypeScript 言語サーバの補完では足りない」具体的ユースケースが複数集まる（例: `pick`/`omit` の field accessor が IDE 上で見えづらい等）
- Nanoka 専用の lint/diagnostic（`extend()` で `serverOnly` フィールドを再注入した場合の警告等）が ESLint plugin では実装困難であることが判明する

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
