export const contentEn = `\
# Relations

Nanoka supports depth-1 eager loading via \`t.hasMany()\` and \`t.belongsTo()\`. The implementation uses two queries and JavaScript grouping — not SQL JOINs.

## Overview

- **2 queries + JS grouping**: parent rows are fetched first, then child rows are fetched with an \`IN (...)\` query and grouped in JavaScript.
- **JOIN is not used**: this avoids cartesian product issues, differences in D1/libSQL JOIN support, and re-inventing Drizzle's relation DSL.
- Depth is limited to 1. Nested \`with\` (e.g. \`posts.comments\`) is not supported in v1.

## Field Builders

Define relations in your model registration, not in the model file. Relation fields have no DB column and are skipped by \`nanoka generate\`.

\`\`\`typescript
import { t } from '@nanokajs/core'

// 1 → N: User has many Posts
t.hasMany(target, { foreignKey })

// N → 1: Post belongs to a User
t.belongsTo(target, { foreignKey })
\`\`\`

\`foreignKey\` is **always required** — Nanoka does not infer it.

- \`hasMany\`: \`foreignKey\` is the column name on the **target** model (e.g. \`'userId'\` on \`Post\`).
- \`belongsTo\`: \`foreignKey\` is the column name on the **current** model (e.g. \`'userId'\` on \`Post\`).

### Thunk form for bidirectional relations

When two models reference each other, use a thunk (\`() => Target\`) on at least one side to avoid temporal dead zone (TDZ) errors:

\`\`\`typescript
// biome-ignore lint/suspicious/noExplicitAny: cyclic model graph requires forward declaration
let User: any

const Post = app.model('posts', {
  ...postFields,
  author: t.belongsTo(() => User, { foreignKey: 'userId' }),
})

User = app.model('users', {
  ...userFields,
  posts: t.hasMany(() => Post, { foreignKey: 'userId' }),
})
\`\`\`

The thunk is evaluated lazily at query time, so both models are fully defined before any query runs.

## Query API

Pass a \`with\` option to \`findMany\` or \`findOne\` to load relations eagerly.

\`\`\`typescript
// Load user with their posts
const user = await User.findOne(id, { with: { posts: true } })
// { id, name, email, createdAt, posts: [{ id, userId, title, ... }] }

// Load post with its author
const post = await Post.findOne(id, { with: { author: true } })
// { id, userId, title, createdAt, author: { id, name, email, ... } | null }

// findMany also supports with
const users = await User.findMany({ limit: 20, with: { posts: true } })
// [{ id, name, ..., posts: [...] }, ...]
\`\`\`

**Return type:**

- \`hasMany\`: a \`RowType<TargetFields>[]\` array is appended to the parent row.
- \`belongsTo\`: a \`RowType<TargetFields> | null\` object is appended to the parent row.

## Constraints

| Constraint | Detail |
|---|---|
| Depth | 1 only. Nested \`with\` (e.g. \`posts.comments\`) is not supported in v1. |
| Parent \`limit\` | Required on \`findMany\` — same as without \`with\`. |
| Child \`limit\` | Not applied — all matching child rows are returned. |
| \`where\` on relations | Not supported. Use \`app.db\` for filtered joins. |
| FK SQL constraint | Not auto-generated. Add \`references()\` manually in \`drizzle/schema.ts\` if needed. |
| Validator / schema | Relation fields are excluded from \`inputSchema()\`, \`outputSchema()\`, and \`validator()\` by default. |

## OpenAPI Integration

Use \`toOpenAPISchema('output', { with })\` to expand relations in OpenAPI spec output. This is **spec-only** — runtime validation source of truth remains Zod.

\`\`\`typescript
// Expand posts array in the User output schema
User.toOpenAPISchema('output', { with: { posts: true } })
// → { type: 'object', properties: { ..., posts: { type: 'array', items: { ... } } } }

// Expand author object in the Post output schema
Post.toOpenAPISchema('output', { with: { author: true } })
// → { type: 'object', properties: { ..., author: { type: 'object', nullable: true, ... } } }
\`\`\`

When \`with\` is not passed, relation fields are excluded from the schema (default behavior).

> **Important:** The OpenAPI spec is for documentation only. Runtime validation always uses Zod schemas (\`inputSchema()\` / \`outputSchema()\` / \`validator()\`).

## Migration Notes

\`nanoka generate\` skips relation fields — they have no DB column. The generated \`drizzle/schema.ts\` will not include \`t.hasMany()\` or \`t.belongsTo()\` entries.

If you need a foreign key constraint in SQL:

1. Run \`nanoka generate\` to get the base schema.
2. Manually add \`references()\` to the relevant column in \`drizzle/schema.ts\`:

\`\`\`typescript
// Edit drizzle/schema.ts manually after generation
userId: text('userId').notNull().references(() => users.id)
\`\`\`

3. Run \`drizzle-kit generate\` to produce the migration SQL.

## When to Use the Escape Hatch Instead

Relations API covers the common depth-1 eager loading case. For anything more complex, use \`app.db\` directly:

| Use case | Recommendation |
|---|---|
| Load user with posts | \`User.findOne(id, { with: { posts: true } })\` |
| Filter posts by a condition | \`app.db\` with Drizzle WHERE clause |
| Aggregate (count posts per user) | \`app.db\` with Drizzle aggregate functions |
| Multi-level nesting (posts + comments) | \`app.db\` with joins |
| Related-model \`where\` (posts where title = …) | \`app.db\` with inner join |

See [Escape Hatch](/api/escape-hatch) for examples.
`

export const contentJa = `\
# Relations

Nanoka は \`t.hasMany()\` と \`t.belongsTo()\` による depth 1 の eager loading をサポートします。実装は 2 クエリ + JS グループ化で行われ、SQL JOIN は使用しません。

## 概要

- **2 クエリ + JS グループ化**: まず親行を取得し、次に \`IN (...)\` クエリで子行を一括取得して JS 側でグループ化します。
- **JOIN を使わない理由**: cartesian product の回避・D1/libSQL の JOIN 対応差の吸収・Drizzle の relations DSL 再発明を避けるためです。
- Depth は 1 のみ。ネストした \`with\`（例: \`posts.comments\`）は v1 非対応です。

## フィールドビルダー

relation の合成はモデルファイルではなく、モデル登録時（\`app.model()\`）に行います。relation フィールドは DB 列を持たず、\`nanoka generate\` では skip されます。

\`\`\`typescript
import { t } from '@nanokajs/core'

// 1 → N: User が多数の Post を持つ
t.hasMany(target, { foreignKey })

// N → 1: Post が 1 つの User に属する
t.belongsTo(target, { foreignKey })
\`\`\`

\`foreignKey\` は**常に必須**です — Nanoka は推測しません。

- \`hasMany\`: \`foreignKey\` は**ターゲット**モデル側の列名（例: \`Post\` の \`'userId'\`）。
- \`belongsTo\`: \`foreignKey\` は**自モデル**側の列名（例: \`Post\` の \`'userId'\`）。

### 双方向 relation の thunk 形

2 つのモデルが互いを参照する場合、TDZ（Temporal Dead Zone）エラーを避けるため、少なくとも一方を thunk（\`() => Target\`）形式にします:

\`\`\`typescript
// biome-ignore lint/suspicious/noExplicitAny: cyclic model graph requires forward declaration
let User: any

const Post = app.model('posts', {
  ...postFields,
  author: t.belongsTo(() => User, { foreignKey: 'userId' }),
})

User = app.model('users', {
  ...userFields,
  posts: t.hasMany(() => Post, { foreignKey: 'userId' }),
})
\`\`\`

thunk はクエリ実行時に遅延評価されるため、クエリが発行される前に両モデルが定義済みになります。

## クエリ API

\`findMany\` または \`findOne\` に \`with\` オプションを渡して relation を eager load します。

\`\`\`typescript
// user と posts を一緒に取得
const user = await User.findOne(id, { with: { posts: true } })
// { id, name, email, createdAt, posts: [{ id, userId, title, ... }] }

// post と author を一緒に取得
const post = await Post.findOne(id, { with: { author: true } })
// { id, userId, title, createdAt, author: { id, name, email, ... } | null }

// findMany でも with が使える
const users = await User.findMany({ limit: 20, with: { posts: true } })
// [{ id, name, ..., posts: [...] }, ...]
\`\`\`

**戻り値の型:**

- \`hasMany\`: \`RowType<TargetFields>[]\` 配列が親行に付加されます。
- \`belongsTo\`: \`RowType<TargetFields> | null\` オブジェクトが親行に付加されます。

## 制約

| 制約 | 内容 |
|---|---|
| Depth | 1 のみ。ネストした \`with\`（例: \`posts.comments\`）は v1 非対応 |
| 親の \`limit\` | \`findMany\` では必須（\`with\` なしと同様） |
| 子の \`limit\` | 適用されない — 一致するすべての子行が返される |
| relation への \`where\` | 非対応。フィルタ付き JOIN は \`app.db\` を使う |
| FK SQL 制約 | 自動生成されない。必要な場合は \`drizzle/schema.ts\` に手動で \`references()\` を追加する |
| Validator / schema | relation フィールドは \`inputSchema()\`・\`outputSchema()\`・\`validator()\` からデフォルト除外される |

## OpenAPI 連携

\`toOpenAPISchema('output', { with })\` を使って OpenAPI spec 出力で relation を展開できます。これは **spec のみ** の展開です — runtime バリデーションの source of truth は引き続き Zod です。

\`\`\`typescript
// User の output スキーマに posts 配列を展開
User.toOpenAPISchema('output', { with: { posts: true } })
// → { type: 'object', properties: { ..., posts: { type: 'array', items: { ... } } } }

// Post の output スキーマに author オブジェクトを展開
Post.toOpenAPISchema('output', { with: { author: true } })
// → { type: 'object', properties: { ..., author: { type: 'object', nullable: true, ... } } }
\`\`\`

\`with\` を渡さない場合、relation フィールドはスキーマから除外されます（デフォルト動作）。

> **重要:** OpenAPI スペックはドキュメント用途のみです。runtime バリデーションは常に Zod スキーマ（\`inputSchema()\` / \`outputSchema()\` / \`validator()\`）が source of truth です。

## マイグレーションの注意

\`nanoka generate\` は relation フィールドを skip します — DB 列がないためです。生成された \`drizzle/schema.ts\` には \`t.hasMany()\` や \`t.belongsTo()\` の内容は含まれません。

SQL で外部キー制約が必要な場合:

1. \`nanoka generate\` でベーススキーマを生成します。
2. 生成後の \`drizzle/schema.ts\` に手動で \`references()\` を追加します:

\`\`\`typescript
// nanoka generate 後に drizzle/schema.ts を手動編集
userId: text('userId').notNull().references(() => users.id)
\`\`\`

3. \`drizzle-kit generate\` でマイグレーション SQL を生成します。

## Escape Hatch との使い分け

Relations API は depth 1 の eager loading を対象としています。より複雑なケースは \`app.db\` を使います:

| ユースケース | 推奨 |
|---|---|
| user と posts を一緒に取得 | \`User.findOne(id, { with: { posts: true } })\` |
| posts を条件でフィルタ | Drizzle WHERE 句を使った \`app.db\` |
| 集計（user ごとの post 数など）| Drizzle 集計関数を使った \`app.db\` |
| 多段ネスト（posts + comments）| join を使った \`app.db\` |
| 関係先の \`where\`（title = … の posts）| inner join を使った \`app.db\` |

詳細は [Escape Hatch](/api/escape-hatch) を参照してください。
`
