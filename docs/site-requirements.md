# Nanoka ドキュメントサイト 要件定義

## 目的

Nanoka (`@nanokajs/core`) の公式ドキュメントサイト。
インストール手順・API リファレンス・ガイドを提供する。

## 技術スタック

- **ランタイム**: Cloudflare Workers
- **フレームワーク**: Hono
- **デプロイ**: Cloudflare Workers (Static Assets + Hono)

---

## ページ構成

### トップレベル

| パス | タイトル | 概要 |
|------|----------|------|
| `/` | Introduction | Nanoka とは何か・コンセプト・ポジショニング |
| `/getting-started` | Getting Started | インストール・初期設定・最小動作例（5ステップ） |
| `/concepts` | Core Concepts | 80%自動/20%明示・モデル中心設計・フィールドポリシーの考え方 |
| `/cli` | CLI Reference | `nanoka generate` コマンドリファレンス |

### API Reference (`/api/*`)

| パス | タイトル | 概要 |
|------|----------|------|
| `/api/field-types` | Field Types | `t.string()` など全フィールド型・モディファイア一覧 |
| `/api/field-policies` | Field Policies | `serverOnly` / `writeOnly` / `readOnly` の意味と使い分け |
| `/api/schema-validator` | Schema & Validator | `schema()` vs `validator()` の違い・オプション詳細 |
| `/api/crud` | CRUD Methods | `findMany` / `findAll` / `findOne` / `create` / `update` / `delete` |
| `/api/response-shaping` | Response Shaping | `toResponse` / `toResponseMany` / `outputSchema` |
| `/api/openapi` | OpenAPI | モデルコンポーネント生成・ルートメタデータ・Swagger UI |
| `/api/escape-hatch` | Escape Hatch | `app.db`（生 Drizzle）・`app.batch()` |
| `/api/adapters` | Adapters | `d1Adapter` / `tursoAdapter` |

### Guides (`/guides/*`)

| パス | タイトル | 概要 |
|------|----------|------|
| `/guides/migration` | Migration Workflow | `nanoka generate` → `drizzle-kit` → `wrangler` パイプライン全体 |
| `/guides/error-handling` | Error Handling | `HTTPException`・Zod バリデーションエラーの本番向け対策 |
| `/guides/turso` | Using with Turso | `tursoAdapter` を使った Turso / libSQL 構成 |

---

## ナビゲーション構造

```
Introduction
Getting Started
Core Concepts
─ API Reference
  ├ Field Types
  ├ Field Policies
  ├ Schema & Validator
  ├ CRUD Methods
  ├ Response Shaping
  ├ OpenAPI
  ├ Escape Hatch
  └ Adapters
─ Guides
  ├ Migration Workflow
  ├ Error Handling
  └ Using with Turso
CLI Reference
```

サイドバー固定、現在ページをハイライト表示。

---

## 各ページの必須コンテンツ

### Introduction (`/`)

- Nanoka の一言説明（"Thin wrapper over Hono + Drizzle + Zod"）
- コアコンセプトを示すコードスニペット（モデル定義 + 基本ルート）
- 「なぜ Nanoka か」（従来の Hono + Drizzle + Zod 手動接続との比較）
- ポジショニング表（Hono / Drizzle / Nanoka の比較）
- 競合比較（Nanoka / RedwoodSDK / Prisma）
- バージョン・ステータス表記（Stable 1.0.0）

### Getting Started (`/getting-started`)

1. 前提条件（`create hono` Cloudflare Workers テンプレート）
2. インストールコマンド
3. `tsconfig.json` の `types` 設定
4. モデル定義（`src/models/user.ts` の作成例）
5. `nanoka.config.ts` の作成
6. `nanoka generate` 実行
7. `drizzle.config.ts` の作成
8. マイグレーション適用（unified pipeline / step-by-step 両方）
9. `src/index.ts` の最小実装例
10. `wrangler.jsonc` への D1 バインディング追加
11. ローカル起動 (`pnpm dev`)
12. `create-nanoka-app` による全自動スキャフォールドへの案内

### Core Concepts (`/concepts`)

- 80% 自動 / 20% 明示 の意味（`passwordHash` の例）
- モデルが中心となるデータフロー図
- フィールドポリシー早見表（DB / create input / update input / output の ✅❌表）
- `schema()` と `validator()` の分離理由
- Hono を内包する設計（Hono エコシステムがそのまま使える）
- Drizzle escape hatch の存在意義
- マイグレーションを自前で持たない理由
- `findMany` の `limit` 必須化の意図

### Field Types (`/api/field-types`)

- 各型 (`t.string()` / `t.uuid()` / `t.integer()` / `t.number()` / `t.boolean()` / `t.timestamp()` / `t.json()`) のコード例
- `t.uuid().primary().readOnly()` の自動 UUID 生成の特記
- `t.json(zodSchema)` の runtime 検証と codegen の注意点
- モディファイア一覧表（`.primary()` / `.unique()` / `.optional()` / `.default()` / `.min()` / `.max()` / `.email()` / `.serverOnly()` / `.writeOnly()` / `.readOnly()`）

### Field Policies (`/api/field-policies`)

- ポリシー早見表（DB / create input / update input / output）
- `readOnly()` の詳細（auto UUID・createdAt パターン）
- `writeOnly()` の詳細と注意点（平文パスワードは別途 `extend()` で対応）
- `serverOnly()` の詳細（`passwordHash` パターン・`create()` への直接渡し）
- `extend()` で `serverOnly` フィールドを再注入してはいけないことの警告
- `pick` / `omit` との組み合わせ例（フィールドアクセサの typo 検出）

### Schema & Validator (`/api/schema-validator`)

- `schema(opts?)` の使い方（standalone Zod schema）
- `validator(target, opts | preset, hook?)` の使い方（Hono middleware）
- プリセット (`'create'` / `'update'`) vs カスタムオプション (`pick` / `omit` / `partial`)
- フィールドアクセサ（関数形式 `f => [f.name]`）による typo 検出
- hook パラメータの必要性（本番での schema leak 防止）
- `inputSchema('create' | 'update', opts?)` の挙動
- `outputSchema(opts?)` の挙動
- ポリシー適用の比較表（各メソッドで何が含まれ・除外されるか）

### CRUD Methods (`/api/crud`)

- `findMany` の使い方（limit 必須・offset / orderBy / where の例）
- `where` の 2 形式（equality オブジェクト / Drizzle SQL 式）
- `findAll` の使い方と警告（LIMIT なし・本番 handler での注意）
- `findOne` の使い方（PK 指定 / where 指定・null 返り値の扱い）
- `create` の使い方（readOnly / serverOnly フィールドの扱い）
- `update` の使い方（PK 指定 / where 指定・null 返り値）
- `delete` の使い方（`{ deleted: number }` の確認）
- フル CRUD ルート実装例（list / get / create / update / delete）

### Response Shaping (`/api/response-shaping`)

- `toResponse(row)` の使い方
- `toResponseMany(rows)` の使い方と効率化の説明
- `app.db` 経由の結果に必ず `toResponseMany` を通す理由
- `outputSchema()` を直接使うパターン（配列・追加 omit）
- 「どれをいつ使うか」のフローチャート
- outputSchema が除外するフィールドの一覧表

### OpenAPI (`/api/openapi`)

- `toOpenAPIComponent()` の使い方
- `toOpenAPISchema(usage)` の 3 種 ('create' / 'update' / 'output')
- `app.openapi(metadata)` によるルートメタデータ登録
- インライン形式 `{ openapi: {...} }` の既知制限（`c.req.valid` 型推論の喪失）
- `app.generateOpenAPISpec(options)` でドキュメント生成
- `swaggerUI({ url, title? })` の設定
- OpenAPI はドキュメント用であり runtime 検証の source of truth ではない旨

### Escape Hatch (`/api/escape-hatch`)

- `app.db` の使い方（SELECT / JOIN / 集計の例）
- `User.table` でのカラム参照
- `app.db` の結果には必ず `toResponseMany` を適用する警告
- SQL インジェクション防止（`sql.raw()` を避ける）
- `app.batch()` の使い方（D1 batch）
- Relations の対処法（`innerJoin` / `leftJoin` で手書き）
- 「いつ escape hatch を使うか」のユースケース表

### Adapters (`/api/adapters`)

- `d1Adapter(env.DB)` の使い方と `wrangler.jsonc` の D1 バインディング設定
- `tursoAdapter(client)` の使い方と import パス (`@nanokajs/core/turso`)
- `createClient()` の設定例（Turso / ローカル libSQL）
- シークレットの設定方法 (`wrangler secret put`)
- D1 vs Turso の選択基準表

### Migration Workflow (`/guides/migration`)

- パイプライン全体図（model → schema.ts → SQL → D1）
- `nanoka.config.ts` の設定方法
- `drizzle.config.ts` の設定方法
- Option A: 統合パイプライン（`--apply --db`）
- Option B: ステップ別実行
- Option C: スキーマ生成のみ
- リモートデプロイ (`--remote`)
- 新しいモデルを追加する手順
- フィールドを変更する手順
- 生成される Drizzle スキーマの例
- `t.json()` と codegen の注意点（`$type<unknown>()` のまま）

### Error Handling (`/guides/error-handling`)

- `HTTPException` の基本パターン
- グローバルエラーハンドラ (`app.onError`) の実装例
- 5xx でスタックトレースを隠す理由・`DEBUG=1` の運用注意
- Zod バリデーションエラーのデフォルト動作の問題（schema leak）
- validator hook による対策（Option 1）
- `app.onError` での ZodError キャッチ（Option 2・適用範囲の注意）
- パスワードフィールドの推奨パターン（`inputSchema.extend({ password })` + hash）
- D1 / Drizzle エラーの扱い方（constraint violation の安全なレスポンス）
- 404 / 204 / 201 のパターン集

### Using with Turso (`/guides/turso`)

- `@libsql/client` のインストール
- `tursoAdapter` を使ったセットアップ全体
- シークレットの設定
- ローカル開発（`file:local.db`）
- Turso 向けマイグレーション (`drizzle.config.ts` の `dialect: 'turso'`)
- D1 から Turso への切り替え手順（差分のみ）

### CLI Reference (`/cli`)

- `nanoka generate` のオプション一覧表
- 各オプションの使用例
- `nanoka.config.ts` の全オプション
- `create-nanoka-app` の使い方と生成物一覧

---

## 非機能要件

- **検索**: 将来対応候補（MVP 外）
- **ダークモード**: デフォルト対応
- **モバイル対応**: サイドバーはモバイルで折りたたみ
- **コードハイライト**: TypeScript / bash / jsonc 対応
- **OGP / SEO**: 各ページに `<title>` と `<meta description>` を設定
- **llms.txt 連携**: `/llms.txt` と `/llms-full.txt` へのリンクをフッターに配置

## MVP 外（将来候補）

- 全文検索
- バージョン切り替え
- i18n（日本語 / 英語）
- Algolia DocSearch 連携
