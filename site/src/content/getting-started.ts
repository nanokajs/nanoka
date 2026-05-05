export const contentEn = `\
# Getting Started

Get up and running with Nanoka in minutes.

## 1. Prerequisites

Start from a Hono project targeting Cloudflare Workers:

\`\`\`bash
npm create hono@latest my-api
# Select: cloudflare-workers template
cd my-api
\`\`\`

## 2. Install dependencies

\`\`\`bash
pnpm add @nanokajs/core drizzle-orm zod
pnpm add -D drizzle-kit @cloudflare/workers-types
\`\`\`

## 3. Configure TypeScript

Add the Cloudflare Workers types to \`tsconfig.json\`:

\`\`\`jsonc
{
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  }
}
\`\`\`

## 4. Define a model

Create \`src/models/user.ts\`:

\`\`\`typescript
import { t } from '@nanokajs/core'

export const userTableName = 'users'

export const userFields = {
  id:           t.uuid().primary().readOnly(),
  email:        t.string().email().unique(),
  name:         t.string(),
  passwordHash: t.string().serverOnly(),
  createdAt:    t.timestamp().readOnly(),
}
\`\`\`

- \`readOnly()\` — excluded from create/update inputs; UUID is auto-generated on \`create()\`.
- \`serverOnly()\` — stored in the DB but never included in API responses.

## 5. Create nanoka.config.ts

\`\`\`typescript
import { defineConfig } from '@nanokajs/core/config'
import { userFields, userTableName } from './src/models/user'

export default defineConfig({
  models: [{ name: userTableName, fields: userFields }],
  output: './drizzle/schema.ts',
})
\`\`\`

## 6. Generate the Drizzle schema

\`\`\`bash
npx nanoka generate
\`\`\`

This writes \`src/db/schema.ts\` — a standard Drizzle schema file you can inspect and commit.

## 7. Create drizzle.config.ts

\`\`\`typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
})
\`\`\`

## 8. Apply migrations

**Option A — unified pipeline (recommended):**

\`\`\`bash
# Generate schema, run drizzle-kit, and apply to local D1 in one command
npx nanoka generate --apply --db <DATABASE_NAME>

# Apply to remote D1
npx nanoka generate --apply --db <DATABASE_NAME> --remote
\`\`\`

**Option B — step by step:**

\`\`\`bash
# 1. Generate Drizzle schema
npx nanoka generate

# 2. Generate SQL migration files
npx drizzle-kit generate

# 3a. Apply locally
npx wrangler d1 migrations apply <DATABASE_NAME> --local

# 3b. Apply to remote
npx wrangler d1 migrations apply <DATABASE_NAME> --remote
\`\`\`

## 9. Minimal src/index.ts

\`\`\`typescript
import { nanoka, d1Adapter } from '@nanokajs/core'
import { userFields, userTableName } from './models/user'

export interface Env {
  DB: D1Database
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const app = nanoka<{ Bindings: Env }>(d1Adapter(env.DB))
    const User = app.model(userTableName, userFields)

    app.get('/users', async (c) => {
      const users = await User.findMany({ limit: 20, offset: 0, orderBy: 'createdAt' })
      return c.json(User.toResponseMany(users))
    })

    app.post('/users', User.validator('json', 'create'), async (c) => {
      const body = c.req.valid('json')
      const user = await User.create(body)
      return c.json(User.toResponse(user), 201)
    })

    return app.fetch(req, env, ctx)
  },
}
\`\`\`

## 10. Add D1 binding to wrangler.jsonc

\`\`\`jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "<DATABASE_NAME>",
      "database_id": "<DATABASE_ID>"
    }
  ]
}
\`\`\`

Create the database if you haven't already:

\`\`\`bash
npx wrangler d1 create <DATABASE_NAME>
\`\`\`

## 11. Start the local dev server

\`\`\`bash
pnpm dev
\`\`\`

Wrangler starts a local D1 instance automatically. Hit \`http://localhost:8787/users\` to verify.

## 12. Scaffold a full project instantly

To skip all the manual setup above, use the interactive scaffolder:

\`\`\`bash
pnpm create nanoka-app my-app
\`\`\`

This generates a ready-to-run project with a User model, migrations config, Wrangler config, and all dependencies pre-configured.
`

export const contentJa = `\
# Getting Started

数分で Nanoka を動かしましょう。

## 1. 前提条件

Cloudflare Workers 向け Hono プロジェクトから始めます:

\`\`\`bash
npm create hono@latest my-api
# テンプレート: cloudflare-workers を選択
cd my-api
\`\`\`

## 2. 依存パッケージのインストール

\`\`\`bash
pnpm add @nanokajs/core drizzle-orm zod
pnpm add -D drizzle-kit @cloudflare/workers-types
\`\`\`

## 3. TypeScript の設定

\`tsconfig.json\` に Cloudflare Workers の型を追加します:

\`\`\`jsonc
{
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  }
}
\`\`\`

## 4. モデルを定義する

\`src/models/user.ts\` を作成します:

\`\`\`typescript
import { t } from '@nanokajs/core'

export const userTableName = 'users'

export const userFields = {
  id:           t.uuid().primary().readOnly(),
  email:        t.string().email().unique(),
  name:         t.string(),
  passwordHash: t.string().serverOnly(),
  createdAt:    t.timestamp().readOnly(),
}
\`\`\`

- \`readOnly()\` — create/update 入力から除外されます。UUID は \`create()\` 時に自動生成されます。
- \`serverOnly()\` — DB には保存されますが、API レスポンスには絶対に含まれません。

## 5. nanoka.config.ts を作成する

\`\`\`typescript
import { defineConfig } from '@nanokajs/core/config'
import { userFields, userTableName } from './src/models/user'

export default defineConfig({
  models: [{ name: userTableName, fields: userFields }],
  output: './drizzle/schema.ts',
})
\`\`\`

## 6. Drizzle スキーマを生成する

\`\`\`bash
npx nanoka generate
\`\`\`

\`src/db/schema.ts\` という標準の Drizzle スキーマファイルが生成されます。確認してコミットできます。

## 7. drizzle.config.ts を作成する

\`\`\`typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
})
\`\`\`

## 8. マイグレーションを適用する

**Option A — 統合パイプライン（推奨）:**

\`\`\`bash
# スキーマ生成・drizzle-kit 実行・ローカル D1 への適用を 1 コマンドで
npx nanoka generate --apply --db <DATABASE_NAME>

# リモート D1 への適用
npx nanoka generate --apply --db <DATABASE_NAME> --remote
\`\`\`

**Option B — ステップ別実行:**

\`\`\`bash
# 1. Drizzle スキーマを生成
npx nanoka generate

# 2. SQL マイグレーションファイルを生成
npx drizzle-kit generate

# 3a. ローカルへ適用
npx wrangler d1 migrations apply <DATABASE_NAME> --local

# 3b. リモートへ適用
npx wrangler d1 migrations apply <DATABASE_NAME> --remote
\`\`\`

## 9. src/index.ts の最小実装

\`\`\`typescript
import { nanoka, d1Adapter } from '@nanokajs/core'
import { userFields, userTableName } from './models/user'

export interface Env {
  DB: D1Database
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const app = nanoka<{ Bindings: Env }>(d1Adapter(env.DB))
    const User = app.model(userTableName, userFields)

    app.get('/users', async (c) => {
      const users = await User.findMany({ limit: 20, offset: 0, orderBy: 'createdAt' })
      return c.json(User.toResponseMany(users))
    })

    app.post('/users', User.validator('json', 'create'), async (c) => {
      const body = c.req.valid('json')
      const user = await User.create(body)
      return c.json(User.toResponse(user), 201)
    })

    return app.fetch(req, env, ctx)
  },
}
\`\`\`

## 10. wrangler.jsonc に D1 バインディングを追加する

\`\`\`jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "<DATABASE_NAME>",
      "database_id": "<DATABASE_ID>"
    }
  ]
}
\`\`\`

データベースをまだ作成していない場合は:

\`\`\`bash
npx wrangler d1 create <DATABASE_NAME>
\`\`\`

## 11. ローカル開発サーバを起動する

\`\`\`bash
pnpm dev
\`\`\`

Wrangler がローカル D1 インスタンスを自動で起動します。\`http://localhost:8787/users\` にアクセスして確認します。

## 12. create-nanoka-app でスキャフォールド

上記の手動セットアップを省略するには、インタラクティブなスキャフォールダを使います:

\`\`\`bash
pnpm create nanoka-app my-app
\`\`\`

User モデル・マイグレーション設定・Wrangler 設定・全依存パッケージが設定済みのプロジェクトが生成されます。
`
