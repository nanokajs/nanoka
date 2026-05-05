export const contentEn = `\
# Nanoka

> **Stable 1.0.0** — Thin wrapper over Hono + Drizzle + Zod for Cloudflare Workers + D1.

Nanoka eliminates the wiring ceremony between Hono, Drizzle, and Zod.
One model definition becomes your DB schema, TypeScript types, and base validation — while keeping the 20% explicit where it matters.

## Quick look

\`\`\`typescript
import { nanoka, d1Adapter, t } from '@nanokajs/core'

const app = nanoka(d1Adapter(env.DB))

const User = app.model('users', {
  id:           t.uuid().primary().readOnly(),
  email:        t.string().email().unique(),
  name:         t.string(),
  passwordHash: t.string().serverOnly(),
  createdAt:    t.timestamp().readOnly(),
})

// GET /users — paginated, safe by default
app.get('/users', async (c) => {
  const users = await User.findMany({ limit: 20, offset: 0, orderBy: 'createdAt' })
  return c.json(User.toResponseMany(users))
})

// POST /users — validator derived from the model
app.post('/users', User.validator('json', 'create'), async (c) => {
  const body = c.req.valid('json')
  const user = await User.create(body)
  return c.json(User.toResponse(user), 201)
})
\`\`\`

## Why Nanoka?

When you use Hono + Drizzle + Zod manually, you end up writing the same field names in three or four places: the Drizzle schema, the Zod validator, the TypeScript type, and sometimes a separate OpenAPI spec. Nanoka makes the model definition the single source of truth and derives the rest.

- **One definition, multiple derivations** — DB schema, TypeScript types, create/update validators, and OpenAPI components all come from the same model.
- **Field policies instead of hand-rolling omits** — mark a field \`serverOnly()\` and it never appears in output; mark it \`readOnly()\` and it is excluded from create/update inputs automatically.
- **Hono internalized** — \`c.req.valid('json')\`, \`HTTPException\`, middleware — the full Hono ecosystem works as-is.
- **Drizzle escape hatch always open** — \`app.db\` gives you raw Drizzle when the abstraction is not enough.
- **No custom migration engine** — \`nanoka generate\` produces Drizzle schema files; diff generation and migration application stay with \`drizzle-kit\` and \`wrangler d1 migrations\`.

## Positioning

| | Hono | Drizzle | Nanoka |
|---|---|---|---|
| Routing | yes | no | yes (Hono internalized) |
| ORM / queries | no | yes | yes (Drizzle internalized) |
| Migrations | no | yes | yes (generate + hand-apply) |
| Validation | partial (Zod separately) | no | yes (derived from model) |
| Cloudflare Workers | yes | yes | yes |
| Learning curve | low | medium | **low** |

## Compared to alternatives

| | Nanoka | RedwoodSDK | Prisma |
|---|---|---|---|
| Philosophy | API-first / model-first | Full-stack React-first | ORM only |
| Router | Hono-compatible | RedwoodSDK own | none |
| DB escape hatch | raw Drizzle | Kysely / raw SQL | Raw SQL |
| Primary use case | Small APIs fast | Full-stack apps | DB access layer only |

Prisma 7.0 resolved the bundle-size problem and is now Workers-compatible. Nanoka does not compete on bundle size — the difference is the integrated Hono + D1 API-building experience.

## Where to next

- [Getting Started](/getting-started) — install, define a model, run migrations, serve your first route.
- [Core Concepts](/concepts) — field policies, the 80/20 design, and the Drizzle escape hatch.
`

export const contentJa = `\
# Nanoka

> **Stable 1.0.0** — Cloudflare Workers + D1 向け Hono + Drizzle + Zod 薄ラッパー

Nanoka は Hono・Drizzle・Zod の配線作業をなくします。
1 つのモデル定義から DB スキーマ・TypeScript 型・基本バリデーションが派生し、重要な 20% だけを明示的に書きます。

## クイックルック

\`\`\`typescript
import { nanoka, d1Adapter, t } from '@nanokajs/core'

const app = nanoka(d1Adapter(env.DB))

const User = app.model('users', {
  id:           t.uuid().primary().readOnly(),
  email:        t.string().email().unique(),
  name:         t.string(),
  passwordHash: t.string().serverOnly(),
  createdAt:    t.timestamp().readOnly(),
})

// GET /users — ページネーション付きで安全
app.get('/users', async (c) => {
  const users = await User.findMany({ limit: 20, offset: 0, orderBy: 'createdAt' })
  return c.json(User.toResponseMany(users))
})

// POST /users — モデルから派生したバリデータ
app.post('/users', User.validator('json', 'create'), async (c) => {
  const body = c.req.valid('json')
  const user = await User.create(body)
  return c.json(User.toResponse(user), 201)
})
\`\`\`

## なぜ Nanoka か

Hono + Drizzle + Zod を手動で繋ぐとき、同じフィールド名を Drizzle スキーマ・Zod バリデータ・TypeScript 型・OpenAPI スペックの 3〜4 箇所に書くことになります。Nanoka はモデル定義を唯一の情報源にして、残りを派生させます。

- **1 つの定義、複数の派生** — DB スキーマ・TypeScript 型・create/update バリデータ・OpenAPI コンポーネントはすべて同じモデルから生成されます。
- **フィールドポリシーで omit 記述を省く** — \`serverOnly()\` を付けたフィールドはレスポンスに絶対に現れず、\`readOnly()\` を付けると create/update 入力から自動的に除外されます。
- **Hono を内包** — \`c.req.valid('json')\`・\`HTTPException\`・ミドルウェアなど、Hono エコシステムがそのまま使えます。
- **Drizzle escape hatch は常に開いている** — 抽象が足りないときは \`app.db\` で素の Drizzle に降りられます。
- **独自マイグレーションエンジンなし** — \`nanoka generate\` は Drizzle スキーマファイルを生成し、差分生成・適用は \`drizzle-kit\` と \`wrangler d1 migrations\` に委ねます。

## ポジショニング

| | Hono | Drizzle | Nanoka |
|---|---|---|---|
| ルーティング | yes | no | yes（Hono 内包） |
| ORM / クエリ | no | yes | yes（Drizzle 内包） |
| マイグレーション | no | yes | yes（生成・手動実行） |
| バリデーション | partial（Zod 別途） | no | yes（モデルから派生） |
| Cloudflare Workers | yes | yes | yes |
| 学習コスト | 低 | 中 | **低** |

## 競合との比較

| | Nanoka | RedwoodSDK | Prisma |
|---|---|---|---|
| 思想 | API-first / model-first | フルスタック React-first | ORM 単体 |
| ルーター | Hono 互換 | RedwoodSDK 独自 | なし |
| DB escape hatch | 素の Drizzle | Kysely / 生 SQL | Raw SQL |
| 主な用途 | 小規模 API を即作る | フルスタックアプリを組む | DB アクセス層のみ |

Prisma 7.0 でバンドルサイズ問題は解消され Workers 互換になりました。Nanoka はバンドルサイズで競いません——違いは Hono + D1 を統合した API 構築体験にあります。

## 次へ

- [Getting Started](/getting-started) — インストール・モデル定義・マイグレーション・最初のルートを立ち上げます。
- [Core Concepts](/concepts) — フィールドポリシー・80/20 設計・Drizzle escape hatch について説明します。
`
