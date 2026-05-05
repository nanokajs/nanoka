export const contentEn = `\
# Schema & Validator

Nanoka provides two related but separate APIs for working with Zod schemas: \`schema()\` / \`inputSchema()\` / \`outputSchema()\` return standalone Zod objects, while \`validator()\` wraps them as Hono middleware.

## schema(opts?)

Returns a standalone Zod schema derived from the model's fields. Can be used without Hono — in tests, background workers, or when composing schemas.

\`\`\`typescript
// Full schema
const FullSchema = User.schema()

// Narrowed with pick
const NameEmailSchema = User.schema({ pick: (f) => [f.name, f.email] })

// Partial update shape
const PatchSchema = User.schema({ partial: true, omit: (f) => [f.passwordHash] })

// Standalone parse — no Hono required
const result = NameEmailSchema.safeParse(body)
\`\`\`

## validator(target, opts | preset, hook?)

Returns a Hono middleware that validates the specified request target using the model's schema.

\`\`\`typescript
// Custom options
app.post('/users', User.validator('json', { omit: (f) => [f.passwordHash] }), async (c) => {
  const body = c.req.valid('json')
  // body is typed — passwordHash excluded
})

// With a custom hook for error handling
app.post(
  '/users',
  User.validator('json', 'create', (result, c) => {
    if (!result.success) return c.json({ error: result.error.flatten() }, 400)
  }),
  handler,
)
\`\`\`

## Presets

Two presets are available as shorthand for common input shapes:

**\`'create'\`** — applies \`inputSchema('create')\`: removes \`readOnly\` and \`serverOnly\` fields.

\`\`\`typescript
app.post('/users', User.validator('json', 'create'), async (c) => {
  const body = c.req.valid('json')
  // id, createdAt (readOnly) and passwordHash (serverOnly) are excluded
})
\`\`\`

**\`'update'\`** — applies \`inputSchema('update')\`: removes \`readOnly\` and \`serverOnly\` fields, then makes all remaining fields optional (\`partial: true\`).

\`\`\`typescript
app.patch('/users/:id', User.validator('json', 'update'), async (c) => {
  const body = c.req.valid('json')
  // all fields optional; readOnly and serverOnly excluded
})
\`\`\`

## Custom Options

When presets are not enough, pass explicit options:

\`\`\`typescript
interface SchemaOptions {
  pick?:    string[] | ((f: FieldAccessor) => string[])
  omit?:    string[] | ((f: FieldAccessor) => string[])
  partial?: boolean
}
\`\`\`

Operations are applied in order: pick → omit → partial.

\`\`\`typescript
// Accept only name and email, both optional
const opts = { pick: (f) => [f.name, f.email], partial: true }
app.patch('/profile', User.validator('json', opts), handler)
\`\`\`

## Field Accessor

Both \`pick\` and \`omit\` accept a function \`(f) => [f.fieldName]\` where \`f\` maps every field name to itself as a string literal. This turns typos into compile-time type errors.

\`\`\`typescript
// Typo is a type error
User.schema({ pick: (f) => [f.nme] })
//                          ^^^^ Property 'nme' does not exist on type ...

// Correct
User.schema({ pick: (f) => [f.name] })
\`\`\`

## hook parameter

The optional third argument to \`validator()\` is passed directly to \`@hono/zod-validator\`. Use it to customize the error response without replacing the entire middleware.

\`\`\`typescript
const hook = (result, c) => {
  if (!result.success) return c.json({ errors: result.error.flatten().fieldErrors }, 422)
}

app.post('/users', User.validator('json', 'create', hook), handler)
\`\`\`

Using a hook is also the recommended way to prevent schema leak: the default \`@hono/zod-validator\` error includes the full Zod error tree, which may reveal field names that should be private.

## inputSchema('create' | 'update', opts?)

Returns a Zod schema with policies applied for the given input context.

- \`'create'\`: removes \`serverOnly\` and \`readOnly\` fields.
- \`'update'\`: removes \`serverOnly\` and \`readOnly\` fields, then applies \`partial: true\`.

Additional \`opts\` are applied after policy filtering.

\`\`\`typescript
// Extend with a custom field
const CreateBody = User.inputSchema('create').extend({
  password: z.string().min(8),
})
\`\`\`

## outputSchema(opts?)

Returns a Zod schema with policies applied for response output.

- \`serverOnly\` fields are excluded.
- \`writeOnly\` fields are excluded.
- \`readOnly\` fields are **included** (they are safe to return).

\`\`\`typescript
// Parse an array of raw DB rows into safe response objects
const rows = await app.db.select().from(User.table)
const response = z.array(User.outputSchema()).parse(rows)
\`\`\`

## Policy application matrix

The table below shows which policies are included or excluded by each method:

| Method | serverOnly | writeOnly | readOnly |
|---|---|---|---|
| \`schema()\` | included | included | included |
| \`inputSchema('create')\` | excluded | included | excluded |
| \`inputSchema('update')\` | excluded | included | excluded |
| \`outputSchema()\` | excluded | excluded | included |
| \`validator('json', 'create')\` | excluded | included | excluded |
| \`validator('json', 'update')\` | excluded | included | excluded |
`

export const contentJa = `\
# Schema & Validator

Nanoka は Zod スキーマを扱うための関連する 2 つの API を提供します: \`schema()\` / \`inputSchema()\` / \`outputSchema()\` はスタンドアロンの Zod オブジェクトを返し、\`validator()\` はそれらを Hono ミドルウェアとしてラップします。

## schema(opts?)

モデルのフィールドから派生したスタンドアロンの Zod スキーマを返します。Hono なしで使えます — テスト・バックグラウンドワーカー・スキーマ合成など。

\`\`\`typescript
// フルスキーマ
const FullSchema = User.schema()

// pick で絞り込み
const NameEmailSchema = User.schema({ pick: (f) => [f.name, f.email] })

// 部分的な update 形状
const PatchSchema = User.schema({ partial: true, omit: (f) => [f.passwordHash] })

// スタンドアロンでパース — Hono 不要
const result = NameEmailSchema.safeParse(body)
\`\`\`

## validator(target, opts | preset, hook?)

指定したリクエストターゲットをモデルのスキーマで検証する Hono ミドルウェアを返します。

\`\`\`typescript
// カスタムオプション
app.post('/users', User.validator('json', { omit: (f) => [f.passwordHash] }), async (c) => {
  const body = c.req.valid('json')
  // body は型付き — passwordHash は除外済み
})

// エラーハンドリングのためのカスタムフック付き
app.post(
  '/users',
  User.validator('json', 'create', (result, c) => {
    if (!result.success) return c.json({ error: result.error.flatten() }, 400)
  }),
  handler,
)
\`\`\`

## プリセット

よく使う入力形状の短縮形として 2 つのプリセットが使えます:

**\`'create'\`** — \`inputSchema('create')\` を適用: \`readOnly\` および \`serverOnly\` フィールドを除去します。

\`\`\`typescript
app.post('/users', User.validator('json', 'create'), async (c) => {
  const body = c.req.valid('json')
  // id、createdAt（readOnly）および passwordHash（serverOnly）は除外済み
})
\`\`\`

**\`'update'\`** — \`inputSchema('update')\` を適用: \`readOnly\` および \`serverOnly\` フィールドを除去し、残りのすべてのフィールドをオプションにします（\`partial: true\`）。

\`\`\`typescript
app.patch('/users/:id', User.validator('json', 'update'), async (c) => {
  const body = c.req.valid('json')
  // 全フィールドがオプション; readOnly と serverOnly は除外済み
})
\`\`\`

## カスタムオプション

プリセットで足りない場合は、明示的なオプションを渡します:

\`\`\`typescript
interface SchemaOptions {
  pick?:    string[] | ((f: FieldAccessor) => string[])
  omit?:    string[] | ((f: FieldAccessor) => string[])
  partial?: boolean
}
\`\`\`

操作は pick → omit → partial の順で適用されます。

\`\`\`typescript
// name と email のみを受け付け、両方オプション
const opts = { pick: (f) => [f.name, f.email], partial: true }
app.patch('/profile', User.validator('json', opts), handler)
\`\`\`

## フィールドアクセサ

\`pick\` と \`omit\` は両方、\`f\` が各フィールド名を文字列リテラルとして自身にマッピングする \`(f) => [f.fieldName]\` 関数を受け付けます。これにより、タイポがコンパイル時の型エラーになります。

\`\`\`typescript
// タイポは型エラー
User.schema({ pick: (f) => [f.nme] })
//                          ^^^^ Property 'nme' does not exist on type ...

// 正しい
User.schema({ pick: (f) => [f.name] })
\`\`\`

## hook パラメータ

\`validator()\` のオプションの第 3 引数は \`@hono/zod-validator\` にそのまま渡されます。ミドルウェア全体を置き換えることなく、エラーレスポンスをカスタマイズするために使います。

\`\`\`typescript
const hook = (result, c) => {
  if (!result.success) return c.json({ errors: result.error.flatten().fieldErrors }, 422)
}

app.post('/users', User.validator('json', 'create', hook), handler)
\`\`\`

フックの使用は、スキーマリーク防止にも推奨されます: デフォルトの \`@hono/zod-validator\` エラーには完全な Zod エラーツリーが含まれ、非公開にすべきフィールド名が漏れる可能性があります。

## inputSchema('create' | 'update', opts?)

指定した入力コンテキストにポリシーを適用した Zod スキーマを返します。

- \`'create'\`: \`serverOnly\` および \`readOnly\` フィールドを除去します。
- \`'update'\`: \`serverOnly\` および \`readOnly\` フィールドを除去した後、\`partial: true\` を適用します。

追加の \`opts\` はポリシーフィルタリングの後に適用されます。

\`\`\`typescript
// カスタムフィールドで拡張
const CreateBody = User.inputSchema('create').extend({
  password: z.string().min(8),
})
\`\`\`

## outputSchema(opts?)

レスポンス出力用にポリシーを適用した Zod スキーマを返します。

- \`serverOnly\` フィールドは除外されます。
- \`writeOnly\` フィールドは除外されます。
- \`readOnly\` フィールドは**含まれます**（返しても安全です）。

\`\`\`typescript
// 生の DB 行の配列を安全なレスポンスオブジェクトにパース
const rows = await app.db.select().from(User.table)
const response = z.array(User.outputSchema()).parse(rows)
\`\`\`

## ポリシー適用マトリクス

以下の表は、各メソッドで各ポリシーが含まれるか除外されるかを示します:

| メソッド | serverOnly | writeOnly | readOnly |
|---|---|---|---|
| \`schema()\` | 含まれる | 含まれる | 含まれる |
| \`inputSchema('create')\` | 除外 | 含まれる | 除外 |
| \`inputSchema('update')\` | 除外 | 含まれる | 除外 |
| \`outputSchema()\` | 除外 | 除外 | 含まれる |
| \`validator('json', 'create')\` | 除外 | 含まれる | 除外 |
| \`validator('json', 'update')\` | 除外 | 含まれる | 除外 |
`
