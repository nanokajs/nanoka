export const contentEn = `\
# Escape Hatch

When the model API does not cover your query needs, \`app.db\` gives you direct access to the full Drizzle API. The escape hatch is intentional and always available.

## app.db

\`app.db\` is a standard Drizzle \`BaseSQLiteDatabase\` instance bound to the adapter. Any Drizzle feature works here.

**SELECT with a WHERE clause:**

\`\`\`typescript
import { eq } from 'drizzle-orm'

const rows = await app.db
  .select()
  .from(User.table)
  .where(eq(User.table.email, 'alice@example.com'))
  .limit(1)

return c.json(User.toResponse(rows[0]))
\`\`\`

**Aggregation:**

\`\`\`typescript
import { count } from 'drizzle-orm'

const [{ total }] = await app.db
  .select({ total: count() })
  .from(User.table)
  .where(eq(User.table.isActive, true))
\`\`\`

## User.table

Each model exposes its Drizzle table via \`.table\`. Use it for column references in raw queries.

\`\`\`typescript
// Type-safe column access
User.table.id
User.table.email
User.table.createdAt
\`\`\`

## Warning: always pass raw rows through toResponse / toResponseMany

Raw rows returned by \`app.db\` include every column in the table — including \`serverOnly\` fields like \`passwordHash\`. Always pass them through the response shaper before returning to clients.

\`\`\`typescript
// WRONG — leaks serverOnly fields
const rows = await app.db.select().from(User.table)
return c.json(rows)

// CORRECT
const rows = await app.db.select().from(User.table)
return c.json(User.toResponseMany(rows))
\`\`\`

## Avoid SQL injection

Always use Drizzle's parameterized query API. Drizzle escapes values automatically when you pass them as arguments.

\`\`\`typescript
// SAFE — parameterized
import { eq } from 'drizzle-orm'
await app.db.select().from(User.table).where(eq(User.table.email, userInput))

// DANGEROUS — never interpolate external input into sql.raw()
import { sql } from 'drizzle-orm'
await app.db.execute(sql.raw(\`SELECT * FROM users WHERE email = '\${userInput}'\`))
\`\`\`

Use \`sql\` tagged template (not \`sql.raw()\`) when you need raw SQL fragments — Drizzle still parameterizes tagged-template values.

\`\`\`typescript
import { sql } from 'drizzle-orm'

// SAFE — sql tagged template parameterizes the value
await app.db.execute(sql\`SELECT * FROM users WHERE email = \${userInput}\`)
\`\`\`

## app.batch()

Executes multiple queries in a single D1 batch request (D1's batch API). Useful for writes that must all succeed or fail together at the network level.

\`\`\`typescript
const [newUser, newPost] = await app.batch([
  app.db.insert(User.table).values({ id: crypto.randomUUID(), email: 'alice@example.com', name: 'Alice' }).returning(),
  app.db.insert(Post.table).values({ id: crypto.randomUUID(), title: 'Hello', userId: 'alice-id' }).returning(),
])
\`\`\`

Note: D1 batch is not a transaction. If the second query fails, the first may already have been applied. For true transactional semantics, use SQLite transactions via raw SQL or Drizzle's transaction API where supported.

## Relations: depth-1 eager loading and complex joins

Nanoka provides a Relations API (\`t.hasMany()\` / \`t.belongsTo()\`) for depth-1 eager loading. Use it for the common case of loading a parent with its direct children.

For complex queries — filtered joins, aggregations, or related-model \`where\` clauses — use \`app.db\` directly. See the [Relations](/api/relations) page for the full Relations API.

**Inner join (complex query example):**

\`\`\`typescript
import { eq } from 'drizzle-orm'

const results = await app.db
  .select({
    user:  User.table,
    post:  Post.table,
  })
  .from(User.table)
  .innerJoin(Post.table, eq(Post.table.userId, User.table.id))
  .where(eq(User.table.id, userId))
\`\`\`

**Left join (include users with no posts):**

\`\`\`typescript
const results = await app.db
  .select({
    user: User.table,
    post: Post.table,
  })
  .from(User.table)
  .leftJoin(Post.table, eq(Post.table.userId, User.table.id))
\`\`\`

Remember to pass the user portions of the result through \`User.toResponse()\` before returning.

## When to use the escape hatch

| Use case | Recommendation |
|---|---|
| Paginated list, single lookup, create, update, delete | Use model CRUD methods |
| Load user with posts (depth 1) | \`User.findOne(id, { with: { posts: true } })\` — see [Relations](/api/relations) |
| Complex WHERE with multiple conditions | \`app.db\` with Drizzle SQL operators |
| Filter by related-model column | \`app.db\` with \`.innerJoin()\` / \`.leftJoin()\` |
| Aggregation (COUNT, SUM, AVG) | \`app.db\` with Drizzle aggregate functions |
| Full-text search | \`app.db\` with raw SQL fragment |
| Multiple inserts that must batch | \`app.batch()\` |
`

export const contentJa = `\
# Escape Hatch

モデル API がクエリのニーズを満たさない場合、\`app.db\` が完全な Drizzle API への直接アクセスを提供します。escape hatch は意図的なものであり、常に利用可能です。

## app.db

\`app.db\` はアダプターにバインドされた標準の Drizzle \`BaseSQLiteDatabase\` インスタンスです。すべての Drizzle 機能が使えます。

**WHERE 句付き SELECT:**

\`\`\`typescript
import { eq } from 'drizzle-orm'

const rows = await app.db
  .select()
  .from(User.table)
  .where(eq(User.table.email, 'alice@example.com'))
  .limit(1)

return c.json(User.toResponse(rows[0]))
\`\`\`

**集計:**

\`\`\`typescript
import { count } from 'drizzle-orm'

const [{ total }] = await app.db
  .select({ total: count() })
  .from(User.table)
  .where(eq(User.table.isActive, true))
\`\`\`

## User.table

各モデルは Drizzle テーブルを \`.table\` で公開します。raw クエリでのカラム参照に使用します。

\`\`\`typescript
// 型安全なカラムアクセス
User.table.id
User.table.email
User.table.createdAt
\`\`\`

## 警告: raw 行は必ず toResponse / toResponseMany に通すこと

\`app.db\` が返す raw 行には、テーブルのすべてのカラムが含まれます — \`passwordHash\` のような \`serverOnly\` フィールドも含めて。クライアントに返す前に必ずレスポンスシェーパーに通してください。

\`\`\`typescript
// 誤り — serverOnly フィールドが漏れる
const rows = await app.db.select().from(User.table)
return c.json(rows)

// 正しい
const rows = await app.db.select().from(User.table)
return c.json(User.toResponseMany(rows))
\`\`\`

## SQL インジェクションを避ける

常に Drizzle のパラメータ化クエリ API を使ってください。引数として渡すと Drizzle が値を自動でエスケープします。

\`\`\`typescript
// 安全 — パラメータ化
import { eq } from 'drizzle-orm'
await app.db.select().from(User.table).where(eq(User.table.email, userInput))

// 危険 — 外部入力を sql.raw() に補間しない
import { sql } from 'drizzle-orm'
await app.db.execute(sql.raw(\`SELECT * FROM users WHERE email = '\${userInput}'\`))
\`\`\`

生の SQL フラグメントが必要な場合は \`sql\` タグ付きテンプレート（\`sql.raw()\` ではなく）を使ってください — Drizzle はタグ付きテンプレートの値も引き続きパラメータ化します。

\`\`\`typescript
import { sql } from 'drizzle-orm'

// 安全 — sql タグ付きテンプレートは値をパラメータ化する
await app.db.execute(sql\`SELECT * FROM users WHERE email = \${userInput}\`)
\`\`\`

## app.batch()

複数のクエリを 1 回の D1 バッチリクエストで実行します（D1 のバッチ API）。ネットワークレベルですべて成功するか失敗するかが必要な書き込みに役立ちます。

\`\`\`typescript
const [newUser, newPost] = await app.batch([
  app.db.insert(User.table).values({ id: crypto.randomUUID(), email: 'alice@example.com', name: 'Alice' }).returning(),
  app.db.insert(Post.table).values({ id: crypto.randomUUID(), title: 'Hello', userId: 'alice-id' }).returning(),
])
\`\`\`

注意: D1 バッチはトランザクションではありません。2 番目のクエリが失敗しても、最初のクエリはすでに適用されている可能性があります。真のトランザクションセマンティクスには、サポートされている場合は raw SQL または Drizzle のトランザクション API を通じた SQLite トランザクションを使ってください。

## Relations: depth-1 の eager loading と複雑な join

Nanoka は Relations API（\`t.hasMany()\` / \`t.belongsTo()\`）による depth-1 の eager loading を提供します。親と直接の子を一緒に取得する一般的なケースに使います。

複雑なクエリ — フィルタ付き join・集計・関係先カラムへの \`where\` — には \`app.db\` を直接使います。Relations API の詳細は [Relations](/api/relations) ページを参照してください。

**内部結合（複雑なクエリの例）:**

\`\`\`typescript
import { eq } from 'drizzle-orm'

const results = await app.db
  .select({
    user:  User.table,
    post:  Post.table,
  })
  .from(User.table)
  .innerJoin(Post.table, eq(Post.table.userId, User.table.id))
  .where(eq(User.table.id, userId))
\`\`\`

**左結合（投稿がないユーザーも含む）:**

\`\`\`typescript
const results = await app.db
  .select({
    user: User.table,
    post: Post.table,
  })
  .from(User.table)
  .leftJoin(Post.table, eq(Post.table.userId, User.table.id))
\`\`\`

返す前に結果のユーザー部分を \`User.toResponse()\` に通すことを忘れないでください。

## いつ escape hatch を使うか

| ユースケース | 推奨 |
|---|---|
| ページネーション付きリスト・単一ルックアップ・作成・更新・削除 | モデル CRUD メソッドを使う |
| user と posts を一緒に取得（depth 1）| \`User.findOne(id, { with: { posts: true } })\` — [Relations](/api/relations) 参照 |
| 複数条件を持つ複雑な WHERE | Drizzle SQL オペレーターを使った \`app.db\` |
| 関係先カラムへのフィルタ | \`.innerJoin()\` / \`.leftJoin()\` を使った \`app.db\` |
| 集計（COUNT、SUM、AVG）| Drizzle 集計関数を使った \`app.db\` |
| 全文検索 | raw SQL フラグメントを使った \`app.db\` |
| バッチ処理が必要な複数の挿入 | \`app.batch()\` |
`
