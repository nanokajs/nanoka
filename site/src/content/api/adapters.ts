export const contentEn = `\
# Adapters

Nanoka routes all database access through an adapter interface. Two adapters are provided out of the box: \`d1Adapter\` for Cloudflare D1 and \`tursoAdapter\` for Turso/libSQL.

## d1Adapter(env.DB)

The D1 adapter is the default choice for Cloudflare Workers. Pass the \`D1Database\` binding from your Worker's environment.

\`\`\`typescript
import { nanoka, d1Adapter } from '@nanokajs/core'

export interface Env {
  DB: D1Database
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const app = nanoka<{ Bindings: Env }>(d1Adapter(env.DB))
    // ...
    return app.fetch(req, env, ctx)
  },
}
\`\`\`

Configure the D1 binding in \`wrangler.jsonc\`:

\`\`\`jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-database",
      "database_id": "<your-database-id>"
    }
  ]
}
\`\`\`

Create the database if you haven't already:

\`\`\`bash
npx wrangler d1 create my-database
\`\`\`

## tursoAdapter(client)

The Turso adapter supports Turso/libSQL databases. Import from the sub-path export \`@nanokajs/core/turso\`.

\`\`\`typescript
import { nanoka } from '@nanokajs/core'
import { tursoAdapter } from '@nanokajs/core/turso'
import { createClient } from '@libsql/client'

export interface Env {
  TURSO_URL:       string
  TURSO_AUTH_TOKEN: string
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const client = createClient({
      url:       env.TURSO_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    })

    const app = nanoka<{ Bindings: Env }>(tursoAdapter(client))
    // ...
    return app.fetch(req, env, ctx)
  },
}
\`\`\`

For local development, use a local SQLite file instead of a remote Turso URL. Use \`file:local.db\` in \`.dev.vars\` and \`libsql://...\` for production:

\`\`\`typescript
// Local development with a local SQLite file
import { createClient } from '@libsql/client'
const client = createClient({ url: 'file:local.db' })
\`\`\`

\`\`\`
# .dev.vars — local dev
TURSO_URL=file:local.db
TURSO_AUTH_TOKEN=

# Production (set via wrangler secret put)
# TURSO_URL=libsql://your-db.turso.io
# TURSO_AUTH_TOKEN=your-token
\`\`\`

## Secret configuration

Store database credentials as Wrangler secrets, not in source code or \`wrangler.jsonc\`.

\`\`\`bash
# Set secrets for Turso
npx wrangler secret put TURSO_URL
npx wrangler secret put TURSO_AUTH_TOKEN
\`\`\`

For local development, add secrets to \`.dev.vars\` (this file should be in \`.gitignore\`):

\`\`\`
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
\`\`\`

D1 database IDs are not secrets and can be committed in \`wrangler.jsonc\`. The D1 database itself is protected by your Cloudflare account credentials.

## D1 vs Turso: choosing an adapter

| Criterion | D1 (Cloudflare) | Turso/libSQL |
|---|---|---|
| Primary deployment target | Cloudflare Workers | Cloudflare Workers, Node.js, edge runtimes |
| Geographic distribution | Cloudflare's global network | Turso's global edge replicas |
| Pricing model | Included in Workers plans | Turso's own pricing |
| Local dev | Wrangler local D1 (automatic) | \`libsql\` client in dev mode or local SQLite file |
| Batch API | D1 batch | Turso batch (same adapter interface) |
| Production recommendation | Start here for Cloudflare-only apps | Use when you need multi-platform or Turso-specific features |
`

export const contentJa = `\
# Adapters

Nanoka はすべてのデータベースアクセスをアダプターインターフェース経由でルーティングします。2 つのアダプターが標準提供されています: Cloudflare D1 向けの \`d1Adapter\` と Turso/libSQL 向けの \`tursoAdapter\` です。

## d1Adapter(env.DB)

D1 アダプターは Cloudflare Workers のデフォルトの選択肢です。Worker の環境から \`D1Database\` バインディングを渡します。

\`\`\`typescript
import { nanoka, d1Adapter } from '@nanokajs/core'

export interface Env {
  DB: D1Database
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const app = nanoka<{ Bindings: Env }>(d1Adapter(env.DB))
    // ...
    return app.fetch(req, env, ctx)
  },
}
\`\`\`

\`wrangler.jsonc\` で D1 バインディングを設定します:

\`\`\`jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-database",
      "database_id": "<your-database-id>"
    }
  ]
}
\`\`\`

データベースをまだ作成していない場合は:

\`\`\`bash
npx wrangler d1 create my-database
\`\`\`

## tursoAdapter(client)

Turso アダプターは Turso/libSQL データベースをサポートします。サブパスエクスポート \`@nanokajs/core/turso\` からインポートします。

\`\`\`typescript
import { nanoka } from '@nanokajs/core'
import { tursoAdapter } from '@nanokajs/core/turso'
import { createClient } from '@libsql/client'

export interface Env {
  TURSO_URL:        string
  TURSO_AUTH_TOKEN: string
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const client = createClient({
      url:       env.TURSO_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    })

    const app = nanoka<{ Bindings: Env }>(tursoAdapter(client))
    // ...
    return app.fetch(req, env, ctx)
  },
}
\`\`\`

ローカル開発時はリモートの Turso URL の代わりにローカル SQLite ファイルを使用します。\`.dev.vars\` では \`file:local.db\`、本番では \`libsql://...\` を使い分けます:

\`\`\`typescript
// ローカル開発: ローカル SQLite ファイルを使用
import { createClient } from '@libsql/client'
const client = createClient({ url: 'file:local.db' })
\`\`\`

\`\`\`
# .dev.vars — ローカル開発用
TURSO_URL=file:local.db
TURSO_AUTH_TOKEN=

# 本番（wrangler secret put で設定）
# TURSO_URL=libsql://your-db.turso.io
# TURSO_AUTH_TOKEN=your-token
\`\`\`

## シークレット設定

データベースの認証情報はソースコードや \`wrangler.jsonc\` ではなく、Wrangler のシークレットとして保存します。

\`\`\`bash
# Turso 用シークレットを設定
npx wrangler secret put TURSO_URL
npx wrangler secret put TURSO_AUTH_TOKEN
\`\`\`

ローカル開発用には \`.dev.vars\` にシークレットを追加します（このファイルは \`.gitignore\` に含めること）:

\`\`\`
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
\`\`\`

D1 データベース ID はシークレットではなく、\`wrangler.jsonc\` にコミットできます。D1 データベース自体は Cloudflare アカウントの認証情報で保護されています。

## D1 vs Turso: アダプターの選び方

| 基準 | D1（Cloudflare）| Turso/libSQL |
|---|---|---|
| 主要デプロイターゲット | Cloudflare Workers | Cloudflare Workers・Node.js・エッジランタイム |
| 地理的分散 | Cloudflare のグローバルネットワーク | Turso のグローバルエッジレプリカ |
| 料金モデル | Workers プランに含まれる | Turso 独自の料金 |
| ローカル開発 | Wrangler ローカル D1（自動）| dev モードの \`libsql\` クライアントまたはローカル SQLite ファイル |
| バッチ API | D1 バッチ | Turso バッチ（同じアダプターインターフェース）|
| 本番推奨 | Cloudflare のみのアプリはここから始める | マルチプラットフォームや Turso 固有の機能が必要な場合 |
`
