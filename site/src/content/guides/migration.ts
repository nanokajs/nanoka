export const contentEn = `\
# Migration Workflow

Nanoka uses a three-stage pipeline to get your model definitions into a running database. This page explains each stage and the options available at each step.

## Pipeline Overview

\`\`\`
Model Definition → nanoka generate → Drizzle Schema → drizzle-kit generate → SQL Migrations → wrangler d1 migrations apply → D1
\`\`\`

## nanoka.config.ts

The config file tells \`nanoka generate\` which models to process and where to write output. Use \`defineConfig\` from \`@nanokajs/core/config\`:

\`\`\`typescript
import { defineConfig } from '@nanokajs/core/config'
import { User } from './src/models/user'
import { Post } from './src/models/post'

export default defineConfig({
  output: './drizzle/schema.ts',
  models: [User, Post],
  migrate: {
    drizzleConfig: './drizzle.config.ts',
    database: 'my-database',
    packageManager: 'pnpm',
  },
})
\`\`\`

**Fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| \`output\` | string | \`./drizzle/schema.ts\` | Output file path for generated Drizzle schema |
| \`models\` | Model[] | required | Array of Nanoka model definitions |
| \`migrate.drizzleConfig\` | string | \`./drizzle.config.ts\` | Path to drizzle.config.ts |
| \`migrate.database\` | string | — | D1 database name for wrangler |
| \`migrate.packageManager\` | string | \`npx\` | Package manager for CLI commands |

## drizzle.config.ts

\`\`\`typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
})
\`\`\`

## Option A — Unified Pipeline

Run the full pipeline in one command:

\`\`\`bash
npx nanoka generate --apply --db my-database
# Or with remote deploy:
npx nanoka generate --apply --db my-database --remote
\`\`\`

## Option B — Step by Step

\`\`\`bash
# 1. Generate Drizzle schema
npx nanoka generate

# 2. Generate SQL migrations
npx drizzle-kit generate

# 3. Apply to local D1
npx wrangler d1 migrations apply my-database --local
\`\`\`

## Option C — Schema Generation Only

\`\`\`bash
npx nanoka generate --no-migrate
\`\`\`

This generates the Drizzle schema file but skips all migration steps. Useful for CI diffing and codegen-only workflows.

## Remote Deploys

Pass \`--remote\` to apply migrations to the production D1 database instead of the local instance:

\`\`\`bash
npx nanoka generate --apply --db my-database --remote
\`\`\`

The \`--remote\` flag is passed directly to \`wrangler d1 migrations apply\`. To inspect the current migration state:

\`\`\`bash
npx wrangler d1 migrations list my-database --remote
\`\`\`

## Adding a New Model

1. Create a model file (e.g., \`src/models/post.ts\`)
2. Add it to the \`models\` array in \`nanoka.config.ts\`
3. Run the pipeline:

\`\`\`bash
npx nanoka generate --apply --db my-database
\`\`\`

## Modifying a Field

Nanoka regenerates the Drizzle schema from your updated model definition. \`drizzle-kit generate\` then diffs the schema against the previous migration and generates the SQL for the change.

When \`drizzle-kit\` detects a rename or drop, it prompts interactively for confirmation. Nanoka does not intercept or automate this step — the diff and SQL generation logic lives entirely in \`drizzle-kit\`.

## Generated Drizzle Schema Example

Given a User model with typical fields, \`nanoka generate\` writes:

\`\`\`typescript
import { integer, text, sqliteTable } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey().notNull(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('passwordHash').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
})
\`\`\`

This file is a standard Drizzle schema — you can inspect it, commit it, and use it directly with any Drizzle query.

## Note on t.json() and Codegen

- \`t.json()\` generates: \`text('data', { mode: 'json' }).$type<unknown>()\`
- After generation, manually update \`$type<unknown>()\` to \`$type<MyShape>()\` to get proper TypeScript types on that column.
- Function defaults (e.g., \`t.timestamp().default(() => new Date())\`) are dropped during codegen with a warning. Add \`$defaultFn(() => new Date())\` manually to the generated schema if you need a runtime default on that column.
`

export const contentJa = `\
# Migration Workflow

Nanoka はモデル定義をデータベースに反映するために 3 段階のパイプラインを使用します。このページでは各段階と利用できるオプションを説明します。

## パイプライン概要

\`\`\`
モデル定義 → nanoka generate → Drizzle スキーマ → drizzle-kit generate → SQL マイグレーション → wrangler d1 migrations apply → D1
\`\`\`

## nanoka.config.ts

設定ファイルは \`nanoka generate\` に処理するモデルと出力先を伝えます。\`@nanokajs/core/config\` の \`defineConfig\` を使用します:

\`\`\`typescript
import { defineConfig } from '@nanokajs/core/config'
import { User } from './src/models/user'
import { Post } from './src/models/post'

export default defineConfig({
  output: './drizzle/schema.ts',
  models: [User, Post],
  migrate: {
    drizzleConfig: './drizzle.config.ts',
    database: 'my-database',
    packageManager: 'pnpm',
  },
})
\`\`\`

**フィールド:**

| フィールド | 型 | デフォルト | 説明 |
|---|---|---|---|
| \`output\` | string | \`./drizzle/schema.ts\` | 生成された Drizzle スキーマの出力ファイルパス |
| \`models\` | Model[] | 必須 | Nanoka モデル定義の配列 |
| \`migrate.drizzleConfig\` | string | \`./drizzle.config.ts\` | drizzle.config.ts へのパス |
| \`migrate.database\` | string | — | wrangler 用 D1 データベース名 |
| \`migrate.packageManager\` | string | \`npx\` | CLI コマンド用パッケージマネージャ |

## drizzle.config.ts

\`\`\`typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
})
\`\`\`

## Option A — 統合パイプライン

1 コマンドでパイプライン全体を実行します:

\`\`\`bash
npx nanoka generate --apply --db my-database
# またはリモートデプロイ:
npx nanoka generate --apply --db my-database --remote
\`\`\`

## Option B — ステップ別実行

\`\`\`bash
# 1. Drizzle スキーマを生成
npx nanoka generate

# 2. SQL マイグレーションを生成
npx drizzle-kit generate

# 3. ローカル D1 に適用
npx wrangler d1 migrations apply my-database --local
\`\`\`

## Option C — スキーマ生成のみ

\`\`\`bash
npx nanoka generate --no-migrate
\`\`\`

Drizzle スキーマファイルを生成しますが、マイグレーション手順をすべてスキップします。CI での差分確認やコード生成のみのワークフローに便利です。

## リモートデプロイ

\`--remote\` を指定すると、ローカルインスタンスではなく本番 D1 データベースにマイグレーションを適用します:

\`\`\`bash
npx nanoka generate --apply --db my-database --remote
\`\`\`

\`--remote\` フラグは \`wrangler d1 migrations apply\` に直接渡されます。現在のマイグレーション状態を確認するには:

\`\`\`bash
npx wrangler d1 migrations list my-database --remote
\`\`\`

## 新しいモデルを追加する

1. モデルファイルを作成（例: \`src/models/post.ts\`）
2. \`nanoka.config.ts\` の \`models\` 配列に追加
3. パイプラインを実行:

\`\`\`bash
npx nanoka generate --apply --db my-database
\`\`\`

## フィールドを変更する

Nanoka は更新されたモデル定義から Drizzle スキーマを再生成します。次に \`drizzle-kit generate\` がスキーマと前回のマイグレーションを比較して変更の SQL を生成します。

\`drizzle-kit\` がリネームや削除を検出すると、確認のためインタラクティブにプロンプトを表示します。Nanoka はこのステップを横取りしたり自動化したりしません — 差分と SQL 生成ロジックはすべて \`drizzle-kit\` に委ねられています。

## 生成された Drizzle スキーマの例

典型的なフィールドを持つ User モデルに対して \`nanoka generate\` が書き出す内容:

\`\`\`typescript
import { integer, text, sqliteTable } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey().notNull(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('passwordHash').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
})
\`\`\`

このファイルは標準の Drizzle スキーマです — 確認してコミットし、任意の Drizzle クエリで直接使用できます。

## t.json() とコード生成についての注意

- \`t.json()\` は次を生成します: \`text('data', { mode: 'json' }).$type<unknown>()\`
- 生成後、そのカラムで適切な TypeScript 型を得るには、\`$type<unknown>()\` を \`$type<MyShape>()\` に手動で更新してください。
- 関数デフォルト（例: \`t.timestamp().default(() => new Date())\`）はコード生成時に警告付きでドロップされます。そのカラムでランタイムデフォルトが必要な場合は、生成されたスキーマに \`$defaultFn(() => new Date())\` を手動で追加してください。
`
