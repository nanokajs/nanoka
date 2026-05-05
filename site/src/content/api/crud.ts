export const contentEn = `\
# CRUD Methods

Nanoka models expose six CRUD methods: \`findMany\`, \`findAll\`, \`findOne\`, \`create\`, \`update\`, and \`delete\`. All methods are bound to the adapter when the model is registered with \`app.model()\`.

## findMany

Fetches multiple rows with pagination. \`limit\` is **required** — omitting it is a TypeScript type error.

\`\`\`typescript
// Type error — limit is required
await User.findMany({ offset: 0 })
//         ^^^^^^^^ Property 'limit' is missing

// Correct
const users = await User.findMany({ limit: 20, offset: 0 })
const page2 = await User.findMany({ limit: 20, offset: 20 })
\`\`\`

**Options:**

\`\`\`typescript
interface FindManyOptions {
  limit:    number          // required
  offset?:  number          // default: 0
  orderBy?: OrderBy         // optional ordering
  where?:   Where | SQL     // optional filter
}
\`\`\`

**where** — two forms are accepted:

\`\`\`typescript
// Equality object — each key is AND-combined
const users = await User.findMany({ limit: 10, where: { isActive: true } })

// Drizzle SQL expression
import { eq, gt } from 'drizzle-orm'
const users = await User.findMany({
  limit: 10,
  where: gt(User.table.createdAt, cutoff),
})
\`\`\`

**orderBy** — three forms are accepted:

\`\`\`typescript
// Single field name
await User.findMany({ limit: 10, orderBy: 'name' })

// Field with direction
await User.findMany({ limit: 10, orderBy: { column: 'createdAt', direction: 'desc' } })

// Multiple fields
await User.findMany({ limit: 10, orderBy: [{ column: 'name' }, { column: 'createdAt', direction: 'desc' }] })
\`\`\`

## findAll

Fetches all rows without a LIMIT clause. Use this only in batch processing, data exports, or admin tooling — not in request handlers that could receive unbounded input.

\`\`\`typescript
const allUsers = await User.findAll()
const activeUsers = await User.findAll({ where: { isActive: true }, orderBy: 'name' })
\`\`\`

In request handlers, always prefer \`findMany\` with an explicit limit.

## findOne

Fetches a single row by primary key value or where clause. Returns \`null\` if no row matches.

\`\`\`typescript
// By primary key value
const user = await User.findOne('uuid-value')

// By where clause
const user = await User.findOne({ email: 'alice@example.com' })

// Typical 404 pattern
import { HTTPException } from 'hono/http-exception'

const user = await User.findOne(c.req.param('id'))
if (!user) throw new HTTPException(404, { message: 'Not found' })
return c.json(User.toResponse(user))
\`\`\`

## create

Creates a new row and returns the full inserted record including any generated defaults (UUID, timestamps).

\`\`\`typescript
const user = await User.create({
  email: 'alice@example.com',
  name:  'Alice',
})
// Returns the full row including id (auto-generated UUID) and createdAt
\`\`\`

The input type is \`CreateInput<Fields>\`:

- \`readOnly\` fields are optional (can be passed by server code, excluded from API input schemas).
- \`serverOnly\` fields are completely excluded from the type — passing them to \`create()\` is a TypeScript error. Use \`app.db\` directly to write \`serverOnly\` fields.
- Fields with a \`default\` or marked \`optional\` are optional in the input.
- All other fields are required.

To write a \`serverOnly\` field like \`passwordHash\`, use the \`app.db\` escape hatch:

\`\`\`typescript
const passwordHash = await bcrypt.hash(body.password, 10)
await app.db.insert(User.table).values({ ...body, passwordHash })
\`\`\`

## update

Updates rows matching the given id or where clause. Returns the updated row, or \`null\` if no row matched.

\`\`\`typescript
// By primary key value
const updated = await User.update('uuid-value', { name: 'Bob' })

// By where clause
const updated = await User.update({ email: 'alice@example.com' }, { name: 'Bob' })

// 404 if not found
if (!updated) throw new HTTPException(404, { message: 'Not found' })
return c.json(User.toResponse(updated))
\`\`\`

## delete

Deletes rows matching the given id or where clause. Returns \`{ deleted: number }\`.

\`\`\`typescript
const result = await User.delete('uuid-value')
console.log(result.deleted) // number of deleted rows

// 404 if nothing was deleted
if (result.deleted === 0) throw new HTTPException(404, { message: 'Not found' })
return c.body(null, 204)
\`\`\`

## Full CRUD route example

\`\`\`typescript
import { nanoka, d1Adapter } from '@nanokajs/core'
import { HTTPException } from 'hono/http-exception'

export default {
  async fetch(req, env, ctx) {
    const app = nanoka(d1Adapter(env.DB))
    const User = app.model('users', userFields)

    // GET /users — paginated list
    app.get('/users', async (c) => {
      const users = await User.findMany({ limit: 20, offset: 0, orderBy: 'createdAt' })
      return c.json(User.toResponseMany(users))
    })

    // GET /users/:id — single user
    app.get('/users/:id', async (c) => {
      const user = await User.findOne(c.req.param('id'))
      if (!user) throw new HTTPException(404, { message: 'Not found' })
      return c.json(User.toResponse(user))
    })

    // POST /users — create
    app.post('/users', User.validator('json', 'create'), async (c) => {
      const body = c.req.valid('json')
      const user = await User.create(body)
      return c.json(User.toResponse(user), 201)
    })

    // PATCH /users/:id — partial update
    app.patch('/users/:id', User.validator('json', 'update'), async (c) => {
      const body = c.req.valid('json')
      const updated = await User.update(c.req.param('id'), body)
      if (!updated) throw new HTTPException(404, { message: 'Not found' })
      return c.json(User.toResponse(updated))
    })

    // DELETE /users/:id — delete
    app.delete('/users/:id', async (c) => {
      const result = await User.delete(c.req.param('id'))
      if (result.deleted === 0) throw new HTTPException(404, { message: 'Not found' })
      return c.body(null, 204)
    })

    return app.fetch(req, env, ctx)
  },
}
\`\`\`
`

export const contentJa = `\
# CRUD Methods

Nanoka モデルは 6 つの CRUD メソッドを公開します: \`findMany\`・\`findAll\`・\`findOne\`・\`create\`・\`update\`・\`delete\`。すべてのメソッドは \`app.model()\` でモデルを登録する際にアダプターにバインドされます。

## findMany

ページネーション付きで複数の行を取得します。\`limit\` は**必須**です — 省略すると TypeScript の型エラーになります。

\`\`\`typescript
// 型エラー — limit が必要
await User.findMany({ offset: 0 })
//         ^^^^^^^^ Property 'limit' is missing

// 正しい
const users = await User.findMany({ limit: 20, offset: 0 })
const page2 = await User.findMany({ limit: 20, offset: 20 })
\`\`\`

**オプション:**

\`\`\`typescript
interface FindManyOptions {
  limit:    number          // 必須
  offset?:  number          // デフォルト: 0
  orderBy?: OrderBy         // 任意の並び替え
  where?:   Where | SQL     // 任意のフィルタ
}
\`\`\`

**where** — 2 つの形式が使えます:

\`\`\`typescript
// 等値オブジェクト — 各キーは AND で結合される
const users = await User.findMany({ limit: 10, where: { isActive: true } })

// Drizzle SQL 式
import { eq, gt } from 'drizzle-orm'
const users = await User.findMany({
  limit: 10,
  where: gt(User.table.createdAt, cutoff),
})
\`\`\`

**orderBy** — 3 つの形式が使えます:

\`\`\`typescript
// フィールド名のみ
await User.findMany({ limit: 10, orderBy: 'name' })

// 方向付きフィールド
await User.findMany({ limit: 10, orderBy: { column: 'createdAt', direction: 'desc' } })

// 複数フィールド
await User.findMany({ limit: 10, orderBy: [{ column: 'name' }, { column: 'createdAt', direction: 'desc' }] })
\`\`\`

## findAll

LIMIT 句なしで全行を取得します。バッチ処理・データエクスポート・管理ツールのみで使用してください。無制限の入力を受け取る可能性があるリクエストハンドラでは使用しないこと。

\`\`\`typescript
const allUsers = await User.findAll()
const activeUsers = await User.findAll({ where: { isActive: true }, orderBy: 'name' })
\`\`\`

リクエストハンドラでは、常に明示的な limit を持つ \`findMany\` を優先してください。

## findOne

主キーの値または where 句で単一の行を取得します。行が見つからない場合は \`null\` を返します。

\`\`\`typescript
// 主キーの値で
const user = await User.findOne('uuid-value')

// where 句で
const user = await User.findOne({ email: 'alice@example.com' })

// 典型的な 404 パターン
import { HTTPException } from 'hono/http-exception'

const user = await User.findOne(c.req.param('id'))
if (!user) throw new HTTPException(404, { message: 'Not found' })
return c.json(User.toResponse(user))
\`\`\`

## create

新しい行を作成し、生成されたデフォルト値（UUID・タイムスタンプ）を含む挿入されたレコード全体を返します。

\`\`\`typescript
const user = await User.create({
  email: 'alice@example.com',
  name:  'Alice',
})
// id（自動生成 UUID）と createdAt を含む全行を返す
\`\`\`

入力の型は \`CreateInput<Fields>\` です:

- \`readOnly\` フィールドはオプション（サーバーコードから渡せる。API 入力スキーマからは除外される）。
- \`serverOnly\` フィールドは型から完全に除外される — \`create()\` に渡すと TypeScript エラーになります。\`serverOnly\` フィールドを書き込む場合は \`app.db\` を直接使用してください。
- \`default\` を持つまたは \`optional\` とマークされたフィールドはオプション。
- その他のフィールドはすべて必須。

\`passwordHash\` のような \`serverOnly\` フィールドを書き込む場合は \`app.db\` escape hatch を使います:

\`\`\`typescript
const passwordHash = await bcrypt.hash(body.password, 10)
await app.db.insert(User.table).values({ ...body, passwordHash })
\`\`\`

## update

指定した id または where 句に一致する行を更新します。更新された行を返し、一致する行がなければ \`null\` を返します。

\`\`\`typescript
// 主キーの値で
const updated = await User.update('uuid-value', { name: 'Bob' })

// where 句で
const updated = await User.update({ email: 'alice@example.com' }, { name: 'Bob' })

// 見つからない場合は 404
if (!updated) throw new HTTPException(404, { message: 'Not found' })
return c.json(User.toResponse(updated))
\`\`\`

## delete

指定した id または where 句に一致する行を削除します。\`{ deleted: number }\` を返します。

\`\`\`typescript
const result = await User.delete('uuid-value')
console.log(result.deleted) // 削除された行数

// 削除されなかった場合は 404
if (result.deleted === 0) throw new HTTPException(404, { message: 'Not found' })
return c.body(null, 204)
\`\`\`

## フル CRUD ルート例

\`\`\`typescript
import { nanoka, d1Adapter } from '@nanokajs/core'
import { HTTPException } from 'hono/http-exception'

export default {
  async fetch(req, env, ctx) {
    const app = nanoka(d1Adapter(env.DB))
    const User = app.model('users', userFields)

    // GET /users — ページネーション付きリスト
    app.get('/users', async (c) => {
      const users = await User.findMany({ limit: 20, offset: 0, orderBy: 'createdAt' })
      return c.json(User.toResponseMany(users))
    })

    // GET /users/:id — 単一ユーザー
    app.get('/users/:id', async (c) => {
      const user = await User.findOne(c.req.param('id'))
      if (!user) throw new HTTPException(404, { message: 'Not found' })
      return c.json(User.toResponse(user))
    })

    // POST /users — 作成
    app.post('/users', User.validator('json', 'create'), async (c) => {
      const body = c.req.valid('json')
      const user = await User.create(body)
      return c.json(User.toResponse(user), 201)
    })

    // PATCH /users/:id — 部分的な更新
    app.patch('/users/:id', User.validator('json', 'update'), async (c) => {
      const body = c.req.valid('json')
      const updated = await User.update(c.req.param('id'), body)
      if (!updated) throw new HTTPException(404, { message: 'Not found' })
      return c.json(User.toResponse(updated))
    })

    // DELETE /users/:id — 削除
    app.delete('/users/:id', async (c) => {
      const result = await User.delete(c.req.param('id'))
      if (result.deleted === 0) throw new HTTPException(404, { message: 'Not found' })
      return c.body(null, 204)
    })

    return app.fetch(req, env, ctx)
  },
}
\`\`\`
`
