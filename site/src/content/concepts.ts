export const contentEn = `\
# Core Concepts

The design decisions that make Nanoka tick.

## 80% automatic, 20% explicit

Nanoka derives your DB schema, TypeScript types, and base validation from one model definition. That is the automatic 80%. The remaining 20% — what the API accepts, what it returns, how fields are shaped for specific routes — is kept explicit.

The clearest example is \`passwordHash\`:

\`\`\`typescript
const User = app.model('users', {
  id:           t.uuid().primary().readOnly(),
  email:        t.string().email(),
  name:         t.string(),
  passwordHash: t.string().serverOnly(), // DB column, never in API output
})
\`\`\`

By marking it \`serverOnly()\`, Nanoka strips it from every response automatically. You do not need to \`omit\` it by hand in every route. The 20% is where you intentionally diverge — for example, a POST /users route that accepts a plain \`password\` field, hashes it, and stores the hash:

\`\`\`typescript
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const CreateUserBody = User.inputSchema('create').extend({ password: z.string().min(8) })

app.post('/users', zValidator('json', CreateUserBody), async (c) => {
  const { password, ...body } = c.req.valid('json')
  const passwordHash = await hash(password)
  const user = await User.create({ ...body, passwordHash })
  return c.json(User.toResponse(user), 201)
})
\`\`\`

This is explicit by design. The framework does not try to guess how you hash passwords.

## Model-centric data flow

\`\`\`
model definition (app.model)
        |
        +---> DB schema (nanoka generate -> Drizzle schema file)
        |
        +---> TypeScript types (inferred automatically)
        |
        +---> Zod schemas
        |       +---> inputSchema('create')  -- readOnly fields removed
        |       +---> inputSchema('update')  -- readOnly fields removed, all optional
        |       +---> outputSchema()         -- serverOnly fields removed
        |
        +---> Hono validators (User.validator('json', 'create'))
        |
        +---> OpenAPI components (User.toOpenAPIComponent())
\`\`\`

The DB shape and the API shape can diverge intentionally. The model is the bridge, not a mirror.

## Field policy quick reference

| Policy | DB column | Create input | Update input | API output |
|---|---|---|---|---|
| (none) | yes | yes | yes | yes |
| \`readOnly()\` | yes | no | no | yes |
| \`writeOnly()\` | yes | yes | yes | no |
| \`serverOnly()\` | yes | no | no | no |

- **readOnly** — set once (auto-generated UUID, \`createdAt\` timestamps). Not accepted by create or update.
- **writeOnly** — accepted as input but never returned. Suitable for fields that are stored but must not leak.
- **serverOnly** — only ever touched by server-side code. Not accepted as input and not returned. Suitable for \`passwordHash\` and similar secrets.

## Why \`schema()\` and \`validator()\` are separate

\`User.schema(opts)\` returns a standalone Zod schema. \`User.validator(target, opts)\` returns a Hono validator middleware.

Keeping them separate lets you use the schema without Hono — in tests, in background workers, or when composing schemas:

\`\`\`typescript
// Use schema() standalone — no Hono dependency needed
const CreateSchema = User.schema({ omit: (f) => [f.passwordHash] })
const parsed = CreateSchema.safeParse(body)

// Use validator() as Hono middleware
app.post('/users', User.validator('json', { omit: (f) => [f.passwordHash] }), handler)
\`\`\`

Both accept the field accessor form \`{ pick: (f) => [f.name] }\` so typos become type errors at compile time.

## Hono internalized

Nanoka's router is Hono-compatible. You use Hono patterns throughout:

\`\`\`typescript
import { HTTPException } from 'hono/http-exception'

app.get('/users/:id', async (c) => {
  const user = await User.findOne({ id: c.req.param('id') })
  if (!user) throw new HTTPException(404, { message: 'Not found' })
  return c.json(User.toResponse(user))
})
\`\`\`

Hono middleware, \`c.req.valid()\`, \`c.env\`, and the RPC client all work without any adapter layer.

## The Drizzle escape hatch

When the model API is not enough, drop down to raw Drizzle:

\`\`\`typescript
import { eq } from 'drizzle-orm'

const rows = await app.db
  .select()
  .from(User.table)
  .where(eq(User.table.email, 'alice@example.com'))
  .limit(1)

// Raw DB rows include all columns including serverOnly fields.
// Always pass through toResponse / toResponseMany before returning.
return c.json(User.toResponse(rows[0]))
\`\`\`

\`app.db\` is a standard Drizzle instance. Any Drizzle feature — joins, aggregates, raw SQL — works here.

## No custom migration engine

\`nanoka generate\` reads your model definition and writes a Drizzle schema TypeScript file. That is all it does. The diff-to-SQL step and the apply step are delegated to \`drizzle-kit\` and \`wrangler d1 migrations\`:

\`\`\`
app.model(...)  -->  nanoka generate  -->  src/db/schema.ts
                                              |
                              drizzle-kit generate  -->  migrations/*.sql
                                              |
                      wrangler d1 migrations apply  -->  D1 database
\`\`\`

This design means Nanoka never needs to maintain its own migration diffing logic or SQL dialect support. You get the full power of the existing toolchain without Nanoka standing in the way.

## \`findMany\` requires \`limit\`

Calling \`findMany\` without a \`limit\` is a TypeScript type error. This is intentional: unbounded queries against a production database are a common accidental mistake.

\`\`\`typescript
// Type error — limit is required
await User.findMany({ offset: 0 })

// Correct
await User.findMany({ limit: 20, offset: 0 })
\`\`\`

When you genuinely need all rows — for example, in a background job or a data export — use \`findAll\`:

\`\`\`typescript
const allUsers = await User.findAll()
\`\`\`

\`findAll\` makes the intent explicit. Use it knowingly, not as a default.
`

export const contentJa = `\
# Core Concepts

Nanoka の設計判断を説明します。

## 80% 自動、20% 明示

Nanoka は 1 つのモデル定義から DB スキーマ・TypeScript 型・基本バリデーションを派生させます。これが自動の 80% です。残りの 20% — API が受け取る内容・返す内容・特定ルートでのフィールド整形 — は明示的に書きます。

最もわかりやすい例が \`passwordHash\` です:

\`\`\`typescript
const User = app.model('users', {
  id:           t.uuid().primary().readOnly(),
  email:        t.string().email(),
  name:         t.string(),
  passwordHash: t.string().serverOnly(), // DB カラム、API レスポンスには絶対に含まれない
})
\`\`\`

\`serverOnly()\` を付けると、Nanoka はすべてのレスポンスから自動的に除外します。各ルートで手動で \`omit\` する必要はありません。20% とは意図的に diverge する部分です。例えば POST /users ルートで平文の \`password\` フィールドを受け取り、ハッシュして保存する場合:

\`\`\`typescript
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const CreateUserBody = User.inputSchema('create').extend({ password: z.string().min(8) })

app.post('/users', zValidator('json', CreateUserBody), async (c) => {
  const { password, ...body } = c.req.valid('json')
  const passwordHash = await hash(password)
  const user = await User.create({ ...body, passwordHash })
  return c.json(User.toResponse(user), 201)
})
\`\`\`

これは設計的に明示的です。フレームワークがパスワードのハッシュ方法を推測しようとしません。

## モデル中心のデータフロー

\`\`\`
モデル定義 (app.model)
        |
        +---> DB スキーマ (nanoka generate -> Drizzle スキーマファイル)
        |
        +---> TypeScript 型 (自動推論)
        |
        +---> Zod スキーマ
        |       +---> inputSchema('create')  -- readOnly フィールド除外
        |       +---> inputSchema('update')  -- readOnly フィールド除外、全て任意
        |       +---> outputSchema()         -- serverOnly フィールド除外
        |
        +---> Hono バリデータ (User.validator('json', 'create'))
        |
        +---> OpenAPI コンポーネント (User.toOpenAPIComponent())
\`\`\`

DB の形と API の形は意図的に diverge できます。モデルはミラーではなく橋渡し役です。

## フィールドポリシー早見表

| ポリシー | DB カラム | Create 入力 | Update 入力 | API 出力 |
|---|---|---|---|---|
| （なし） | ✅ | ✅ | ✅ | ✅ |
| \`readOnly()\` | ✅ | ❌ | ❌ | ✅ |
| \`writeOnly()\` | ✅ | ✅ | ✅ | ❌ |
| \`serverOnly()\` | ✅ | ❌ | ❌ | ❌ |

- **readOnly** — 一度だけ設定（自動生成 UUID・\`createdAt\` タイムスタンプ）。create・update では受け付けません。
- **writeOnly** — 入力として受け付けますが、返しません。保存はするが漏れてはいけないフィールドに適しています。
- **serverOnly** — サーバーサイドのコードのみが扱います。入力として受け付けず、返しません。\`passwordHash\` など機密情報に適しています。

## \`schema()\` と \`validator()\` を分ける理由

\`User.schema(opts)\` はスタンドアロンな Zod スキーマを返します。\`User.validator(target, opts)\` は Hono バリデータミドルウェアを返します。

分離することで、Hono なしでスキーマを使えます — テスト・バックグラウンドワーカー・スキーマ合成など:

\`\`\`typescript
// schema() をスタンドアロンで使用 — Hono 依存不要
const CreateSchema = User.schema({ omit: (f) => [f.passwordHash] })
const parsed = CreateSchema.safeParse(body)

// validator() を Hono ミドルウェアとして使用
app.post('/users', User.validator('json', { omit: (f) => [f.passwordHash] }), handler)
\`\`\`

どちらもフィールドアクセサ形式 \`{ pick: (f) => [f.name] }\` に対応しており、タイポがコンパイル時の型エラーになります。

## Hono を内包

Nanoka のルーターは Hono 互換です。Hono のパターンをそのまま使えます:

\`\`\`typescript
import { HTTPException } from 'hono/http-exception'

app.get('/users/:id', async (c) => {
  const user = await User.findOne({ id: c.req.param('id') })
  if (!user) throw new HTTPException(404, { message: 'Not found' })
  return c.json(User.toResponse(user))
})
\`\`\`

Hono ミドルウェア・\`c.req.valid()\`・\`c.env\`・RPC クライアントはアダプター層なしで動作します。

## Drizzle escape hatch

モデル API が足りないときは素の Drizzle に降りられます:

\`\`\`typescript
import { eq } from 'drizzle-orm'

const rows = await app.db
  .select()
  .from(User.table)
  .where(eq(User.table.email, 'alice@example.com'))
  .limit(1)

// 生の DB 行には serverOnly フィールドも含む全カラムが含まれます。
// 返す前に必ず toResponse / toResponseMany を通すこと。
return c.json(User.toResponse(rows[0]))
\`\`\`

\`app.db\` は標準の Drizzle インスタンスです。join・集計・生 SQL など Drizzle のすべての機能が使えます。

## 独自マイグレーションエンジンなし

\`nanoka generate\` はモデル定義を読み取り、Drizzle スキーマの TypeScript ファイルを書き出します。それだけです。差分から SQL への変換と適用は \`drizzle-kit\` と \`wrangler d1 migrations\` に委ねます:

\`\`\`
app.model(...)  -->  nanoka generate  -->  src/db/schema.ts
                                              |
                              drizzle-kit generate  -->  migrations/*.sql
                                              |
                      wrangler d1 migrations apply  -->  D1 データベース
\`\`\`

この設計により、Nanoka は独自のマイグレーション差分ロジックや SQL 方言サポートを維持する必要がありません。既存ツールチェーンのフルパワーを、Nanoka が邪魔することなく使えます。

## \`findMany\` は \`limit\` 必須

\`limit\` なしで \`findMany\` を呼ぶと TypeScript の型エラーになります。これは意図的な設計です。本番 DB への無制限クエリは頻繁に起きる誤りです。

\`\`\`typescript
// 型エラー — limit が必要
await User.findMany({ offset: 0 })

// 正しい呼び方
await User.findMany({ limit: 20, offset: 0 })
\`\`\`

バックグラウンドジョブやデータエクスポートなど、本当に全件が必要な場合は \`findAll\` を使います:

\`\`\`typescript
const allUsers = await User.findAll()
\`\`\`

\`findAll\` は意図を明示します。デフォルトとしてではなく、意識的に使ってください。
`
