export const contentEn = `\
# Response Shaping

Before returning data to clients, you must pass DB rows through a response shaper. This strips \`serverOnly\` and \`writeOnly\` fields that should never appear in API responses.

## toResponse(row)

Parses a single DB row through \`outputSchema()\` and returns the safe response object. Use this when returning a single record.

\`\`\`typescript
app.get('/users/:id', async (c) => {
  const user = await User.findOne(c.req.param('id'))
  if (!user) throw new HTTPException(404, { message: 'Not found' })
  return c.json(User.toResponse(user))
})
\`\`\`

Equivalent to \`User.outputSchema().parse(user)\`, but slightly more readable in route handlers.

## toResponseMany(rows)

Parses an array of DB rows and returns an array of safe response objects. The \`outputSchema()\` is built once and reused for every element — more efficient than mapping \`toResponse\` over a large array.

\`\`\`typescript
app.get('/users', async (c) => {
  const users = await User.findMany({ limit: 20 })
  return c.json(User.toResponseMany(users))
})
\`\`\`

## Always pass app.db results through the shaper

When using \`app.db\` (raw Drizzle), rows are returned as-is from the database and include all columns — including \`serverOnly\` fields like \`passwordHash\`. You must always call \`toResponse\` or \`toResponseMany\` before returning.

\`\`\`typescript
// Raw Drizzle — row includes ALL columns including serverOnly
const rows = await app.db.select().from(User.table).where(eq(User.table.email, email)).limit(1)

// REQUIRED: strip serverOnly / writeOnly before returning
return c.json(User.toResponse(rows[0]))
\`\`\`

Skipping the shaper leaks \`passwordHash\` and any other sensitive columns directly to the client.

## Using outputSchema() directly

When you need to parse an array, add additional \`omit\`, or compose the schema further, use \`outputSchema()\` directly:

\`\`\`typescript
// Parse an array
import { z } from 'zod'
const result = z.array(User.outputSchema()).parse(rows)

// Omit additional fields beyond policy defaults
const result = User.outputSchema({ omit: (f) => [f.createdAt] }).parse(user)

// Compose with other schemas
const PaginatedUsers = z.object({
  items: z.array(User.outputSchema()),
  total: z.number(),
})
\`\`\`

## When to use each

\`\`\`
Have a single raw DB row?
  └─ Use toResponse(row)

Have an array of raw DB rows?
  └─ Use toResponseMany(rows)

Need to omit extra fields or compose with other schemas?
  └─ Use outputSchema() directly

Need to parse an array with additional constraints?
  └─ z.array(User.outputSchema()).parse(rows)
\`\`\`

## Fields excluded by outputSchema()

| Policy | Excluded from output? |
|---|---|
| \`serverOnly()\` | ✅ Yes — always excluded |
| \`writeOnly()\` | ✅ Yes — accepted as input, never returned |
| \`readOnly()\` | ❌ No — safe to return (UUIDs, timestamps) |
| (none) | ❌ No — regular fields are always returned |
`

export const contentJa = `\
# Response Shaping

クライアントにデータを返す前に、DB の行をレスポンスシェーパーに通す必要があります。これにより、API レスポンスに絶対に含めてはいけない \`serverOnly\` および \`writeOnly\` フィールドが除去されます。

## toResponse(row)

単一の DB 行を \`outputSchema()\` でパースして、安全なレスポンスオブジェクトを返します。単一のレコードを返す場合に使用します。

\`\`\`typescript
app.get('/users/:id', async (c) => {
  const user = await User.findOne(c.req.param('id'))
  if (!user) throw new HTTPException(404, { message: 'Not found' })
  return c.json(User.toResponse(user))
})
\`\`\`

\`User.outputSchema().parse(user)\` と等価ですが、ルートハンドラでは少し読みやすいです。

## toResponseMany(rows)

DB 行の配列をパースして、安全なレスポンスオブジェクトの配列を返します。\`outputSchema()\` は一度だけ構築され、すべての要素で再利用されます — 大きな配列で \`toResponse\` をマップするより効率的です。

\`\`\`typescript
app.get('/users', async (c) => {
  const users = await User.findMany({ limit: 20 })
  return c.json(User.toResponseMany(users))
})
\`\`\`

## app.db の結果は必ずシェーパーに通す

\`app.db\`（素の Drizzle）を使うと、行はデータベースからそのまま返され、\`passwordHash\` のような \`serverOnly\` フィールドを含む全カラムが含まれます。返す前に必ず \`toResponse\` または \`toResponseMany\` を呼び出してください。

\`\`\`typescript
// 素の Drizzle — serverOnly を含む全カラムが行に含まれる
const rows = await app.db.select().from(User.table).where(eq(User.table.email, email)).limit(1)

// 必須: 返す前に serverOnly / writeOnly を除去する
return c.json(User.toResponse(rows[0]))
\`\`\`

シェーパーを省略すると、\`passwordHash\` やその他の機密カラムが直接クライアントに漏れます。

## outputSchema() を直接使う

配列をパースしたり、追加の \`omit\` を加えたり、スキーマをさらに組み合わせる必要がある場合は、\`outputSchema()\` を直接使います:

\`\`\`typescript
// 配列をパース
import { z } from 'zod'
const result = z.array(User.outputSchema()).parse(rows)

// ポリシーのデフォルトを超えて追加フィールドを除外
const result = User.outputSchema({ omit: (f) => [f.createdAt] }).parse(user)

// 他のスキーマと組み合わせる
const PaginatedUsers = z.object({
  items: z.array(User.outputSchema()),
  total: z.number(),
})
\`\`\`

## どれをいつ使うか

\`\`\`
単一の生の DB 行がある？
  └─ toResponse(row) を使う

生の DB 行の配列がある？
  └─ toResponseMany(rows) を使う

追加フィールドの除外や他のスキーマとの合成が必要？
  └─ outputSchema() を直接使う

追加制約付きで配列をパースする必要がある？
  └─ z.array(User.outputSchema()).parse(rows)
\`\`\`

## outputSchema() が除外するフィールド

| ポリシー | 出力から除外？ |
|---|---|
| \`serverOnly()\` | ✅ はい — 常に除外 |
| \`writeOnly()\` | ✅ はい — 入力として受け付けるが、返さない |
| \`readOnly()\` | ❌ いいえ — 返しても安全（UUID・タイムスタンプ）|
| （なし） | ❌ いいえ — 通常フィールドは常に返される |
`
