export const contentEn = `\
# Using with Turso

This page covers the practical steps for using Nanoka with Turso/libSQL in a Cloudflare Worker. For the full adapter API reference, see [/api/adapters](/api/adapters).

## Install

\`\`\`bash
pnpm add @libsql/client
\`\`\`

## Setup

Create the Turso client inside the \`fetch\` handler so each request gets a fresh connection, then pass it to \`tursoAdapter\`:

\`\`\`typescript
import { nanoka } from '@nanokajs/core'
import { tursoAdapter } from '@nanokajs/core/turso'
import { createClient } from '@libsql/client'
import { User } from './models/user'

export interface Env {
  TURSO_URL: string
  TURSO_AUTH_TOKEN: string
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const client = createClient({
      url: env.TURSO_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    })
    const adapter = tursoAdapter(client)
    const app = nanoka(adapter)
    app.model(User)
    // routes...
    return app.fetch(req, env, ctx)
  },
}
\`\`\`

## Secrets

Store credentials as Wrangler secrets, never in source code or \`wrangler.jsonc\`:

\`\`\`bash
wrangler secret put TURSO_URL
wrangler secret put TURSO_AUTH_TOKEN
\`\`\`

For local development, add them to \`.dev.vars\` (keep this file in \`.gitignore\`):

\`\`\`
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
\`\`\`

## Local Development

Use a local SQLite file during development to avoid needing a live Turso database:

\`\`\`typescript
const client = createClient({
  url: 'file:local.db',
})
\`\`\`

Or set \`TURSO_URL=file:local.db\` in \`.dev.vars\` and leave \`TURSO_AUTH_TOKEN\` empty. Apply migrations to the local file:

\`\`\`bash
npx drizzle-kit migrate
\`\`\`

## Migrations for Turso

Update \`drizzle.config.ts\` to use the \`turso\` dialect:

\`\`\`typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'turso',
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
\`\`\`

Apply migrations:

\`\`\`bash
npx drizzle-kit migrate
\`\`\`

## Switching from D1 to Turso

The following changes are required when switching an existing D1-based app to Turso:

**1. Add dependency:**
\`\`\`bash
pnpm add @libsql/client
\`\`\`

**2. Update import in worker:**
\`\`\`typescript
- import { d1Adapter } from '@nanokajs/core'
+ import { tursoAdapter } from '@nanokajs/core/turso'
+ import { createClient } from '@libsql/client'
\`\`\`

**3. Update env interface:**
\`\`\`typescript
- export interface Env {
-   DB: D1Database
- }
+ export interface Env {
+   TURSO_URL: string
+   TURSO_AUTH_TOKEN: string
+ }
\`\`\`

**4. Update adapter initialization:**
\`\`\`typescript
- const app = nanoka(d1Adapter(env.DB))
+ const client = createClient({ url: env.TURSO_URL, authToken: env.TURSO_AUTH_TOKEN })
+ const app = nanoka(tursoAdapter(client))
\`\`\`

**5. wrangler.jsonc:** Remove the \`d1_databases\` binding. The Turso credentials are managed as secrets and do not appear in \`wrangler.jsonc\`.

**6. drizzle.config.ts:** Change \`dialect\` from \`'sqlite'\` to \`'turso'\` and add \`dbCredentials\`.

**7. Migration command:** Replace \`wrangler d1 migrations apply\` with \`drizzle-kit migrate\`.
`

export const contentJa = `\
# Using with Turso

このページでは、Cloudflare Worker で Nanoka を Turso/libSQL と組み合わせて使う実践的な手順を説明します。アダプター API リファレンスの詳細については [/api/adapters](/api/adapters) を参照してください。

## インストール

\`\`\`bash
pnpm add @libsql/client
\`\`\`

## セットアップ

各リクエストで新しい接続を得るために \`fetch\` ハンドラ内で Turso クライアントを作成し、\`tursoAdapter\` に渡します:

\`\`\`typescript
import { nanoka } from '@nanokajs/core'
import { tursoAdapter } from '@nanokajs/core/turso'
import { createClient } from '@libsql/client'
import { User } from './models/user'

export interface Env {
  TURSO_URL: string
  TURSO_AUTH_TOKEN: string
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const client = createClient({
      url: env.TURSO_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    })
    const adapter = tursoAdapter(client)
    const app = nanoka(adapter)
    app.model(User)
    // routes...
    return app.fetch(req, env, ctx)
  },
}
\`\`\`

## シークレット

認証情報はソースコードや \`wrangler.jsonc\` ではなく、Wrangler のシークレットとして保存します:

\`\`\`bash
wrangler secret put TURSO_URL
wrangler secret put TURSO_AUTH_TOKEN
\`\`\`

ローカル開発用には \`.dev.vars\` に追加します（このファイルは \`.gitignore\` に含めること）:

\`\`\`
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
\`\`\`

## ローカル開発

開発中はライブの Turso データベースを必要としないよう、ローカル SQLite ファイルを使用します:

\`\`\`typescript
const client = createClient({
  url: 'file:local.db',
})
\`\`\`

または \`.dev.vars\` に \`TURSO_URL=file:local.db\` を設定し、\`TURSO_AUTH_TOKEN\` を空のままにします。ローカルファイルにマイグレーションを適用するには:

\`\`\`bash
npx drizzle-kit migrate
\`\`\`

## Turso 用マイグレーション

\`drizzle.config.ts\` を \`turso\` ダイアレクトを使うように更新します:

\`\`\`typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'turso',
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
\`\`\`

マイグレーションを適用:

\`\`\`bash
npx drizzle-kit migrate
\`\`\`

## D1 から Turso への切り替え

既存の D1 ベースのアプリを Turso に切り替える際に必要な変更:

**1. 依存パッケージを追加:**
\`\`\`bash
pnpm add @libsql/client
\`\`\`

**2. ワーカーのインポートを更新:**
\`\`\`typescript
- import { d1Adapter } from '@nanokajs/core'
+ import { tursoAdapter } from '@nanokajs/core/turso'
+ import { createClient } from '@libsql/client'
\`\`\`

**3. env インターフェースを更新:**
\`\`\`typescript
- export interface Env {
-   DB: D1Database
- }
+ export interface Env {
+   TURSO_URL: string
+   TURSO_AUTH_TOKEN: string
+ }
\`\`\`

**4. アダプター初期化を更新:**
\`\`\`typescript
- const app = nanoka(d1Adapter(env.DB))
+ const client = createClient({ url: env.TURSO_URL, authToken: env.TURSO_AUTH_TOKEN })
+ const app = nanoka(tursoAdapter(client))
\`\`\`

**5. wrangler.jsonc:** \`d1_databases\` バインディングを削除します。Turso の認証情報はシークレットとして管理され、\`wrangler.jsonc\` には含まれません。

**6. drizzle.config.ts:** \`dialect\` を \`'sqlite'\` から \`'turso'\` に変更し、\`dbCredentials\` を追加します。

**7. マイグレーションコマンド:** \`wrangler d1 migrations apply\` を \`drizzle-kit migrate\` に置き換えます。
`
