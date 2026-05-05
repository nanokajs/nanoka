export const contentEn = `\
# Error Handling

Nanoka's router is Hono-compatible. Error handling follows standard Hono patterns using \`HTTPException\` and \`app.onError\`.

## Throwing HTTPException

Import \`HTTPException\` from \`hono/http-exception\` and throw it anywhere in a route handler:

\`\`\`typescript
import { HTTPException } from 'hono/http-exception'

// 404 — resource not found
if (!user) throw new HTTPException(404, { message: 'User not found' })

// 400 — bad request
throw new HTTPException(400, { message: 'Invalid input' })

// 401 — authentication required
throw new HTTPException(401, { message: 'Unauthorized' })

// 403 — forbidden
throw new HTTPException(403, { message: 'Forbidden' })
\`\`\`

## Global Error Handler

Register \`app.onError\` to catch all unhandled errors:

\`\`\`typescript
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  console.error(err)
  return c.json({ error: 'Internal Server Error' }, 500)
})
\`\`\`

Calling \`err.getResponse()\` returns the response with the status code and message you passed to \`HTTPException\`. Errors that are not \`HTTPException\` instances become 500 responses.

## Hiding Stack Traces in 5xx

Never return stack traces in production responses. Internal file paths, variable names, and SQL queries can be leaked in a stack trace, giving attackers useful information about your application internals.

If you want richer error details during local development, gate them behind an environment variable:

\`\`\`typescript
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  if (c.env.DEBUG) {
    return c.json({ error: err.message, stack: err.stack }, 500)
  }
  return c.json({ error: 'Internal Server Error' }, 500)
})
\`\`\`

Only set \`DEBUG=1\` in local development via \`.dev.vars\`. Never enable it in production.

## Zod Validation Errors — Default Behavior

By default, the Hono validator middleware returns a 400 response that includes the full Zod issues object when validation fails. This exposes your internal schema structure (field names, validation rules) to API clients.

## Option 1 — Validator Hook

Use the hook parameter on \`User.validator\` to customize the error response per route:

\`\`\`typescript
app.post('/users', User.validator('json', 'create', (result, c) => {
  if (!result.success) {
    throw new HTTPException(400, { message: 'Invalid input' })
  }
}), async (c) => {
  const body = c.req.valid('json')
  // ...
})
\`\`\`

The hook receives the Zod parse result and the Hono context. Throwing \`HTTPException\` here produces a clean 400 with only your message.

## Option 2 — onError ZodError Catch

Catch \`ZodError\` globally in \`app.onError\`:

\`\`\`typescript
import { ZodError } from 'zod'

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  if (err instanceof ZodError) {
    return c.json({ error: 'Invalid input' }, 400)
  }
  return c.json({ error: 'Internal Server Error' }, 500)
})
\`\`\`

This applies to all \`ZodError\` throws — including manual \`schema.parse()\` calls inside handlers — not just validator middleware errors.

## Password Field Pattern

When a route needs to accept a plain-text password, extend \`inputSchema\` with the extra field, hash it server-side, and store only the hash:

\`\`\`typescript
import { z } from 'zod'

const createUserSchema = User.inputSchema('create').extend({
  password: z.string().min(8),
})

app.post('/users', async (c) => {
  const body = await c.req.json()
  const data = createUserSchema.parse(body)
  const { password, ...rest } = data
  const passwordHash = await hashPassword(password)
  const user = await User.create(adapter, { ...rest, passwordHash })
  return c.json(User.toResponse(user), 201)
})
\`\`\`

The \`passwordHash\` field is \`serverOnly()\` so it never appears in responses, even if you forget to strip it manually.

## D1 / Drizzle Errors

Catch constraint violations and return safe error messages without exposing internal error details:

\`\`\`typescript
try {
  const user = await User.create(adapter, data)
  return c.json(User.toResponse(user), 201)
} catch (err) {
  if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
    throw new HTTPException(409, { message: 'Email already in use' })
  }
  throw err
}
\`\`\`

The internal \`UNIQUE constraint failed\` message is never forwarded to the client. Re-throwing the error for non-constraint cases lets \`app.onError\` handle them as 500s.

## Status Code Patterns

\`\`\`typescript
// 201 Created
return c.json(body, 201)

// 204 No Content
return new Response(null, { status: 204 })

// 404 Not Found
throw new HTTPException(404, { message: 'Not found' })

// 409 Conflict
throw new HTTPException(409, { message: 'Email already in use' })
\`\`\`
`

export const contentJa = `\
# Error Handling

Nanoka のルーターは Hono 互換です。エラーハンドリングは \`HTTPException\` と \`app.onError\` を使った標準的な Hono パターンに従います。

## HTTPException をスローする

\`hono/http-exception\` から \`HTTPException\` をインポートし、ルートハンドラの任意の場所でスローします:

\`\`\`typescript
import { HTTPException } from 'hono/http-exception'

// 404 — リソースが見つからない
if (!user) throw new HTTPException(404, { message: 'User not found' })

// 400 — 不正なリクエスト
throw new HTTPException(400, { message: 'Invalid input' })

// 401 — 認証が必要
throw new HTTPException(401, { message: 'Unauthorized' })

// 403 — アクセス禁止
throw new HTTPException(403, { message: 'Forbidden' })
\`\`\`

## グローバルエラーハンドラ

すべての未処理エラーをキャッチするために \`app.onError\` を登録します:

\`\`\`typescript
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  console.error(err)
  return c.json({ error: 'Internal Server Error' }, 500)
})
\`\`\`

\`err.getResponse()\` を呼ぶと、\`HTTPException\` に渡したステータスコードとメッセージでレスポンスを返します。\`HTTPException\` インスタンスでないエラーは 500 レスポンスになります。

## 5xx でスタックトレースを隠す

本番環境のレスポンスにスタックトレースを含めてはいけません。スタックトレースには内部のファイルパス・変数名・SQL クエリが漏れる可能性があり、攻撃者にアプリケーション内部の有用な情報を与えます。

ローカル開発中により詳細なエラー情報が必要な場合は、環境変数でゲートします:

\`\`\`typescript
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  if (c.env.DEBUG) {
    return c.json({ error: err.message, stack: err.stack }, 500)
  }
  return c.json({ error: 'Internal Server Error' }, 500)
})
\`\`\`

\`DEBUG=1\` は \`.dev.vars\` 経由でローカル開発時のみ設定してください。本番環境では絶対に有効にしないでください。

## Zod バリデーションエラー — デフォルトの挙動

デフォルトでは、Hono バリデータミドルウェアはバリデーション失敗時に Zod の issues オブジェクト全体を含む 400 レスポンスを返します。これにより API クライアントに内部のスキーマ構造（フィールド名、バリデーションルール）が露出します。

## Option 1 — バリデータフック

\`User.validator\` の hook パラメータを使ってルートごとにエラーレスポンスをカスタマイズします:

\`\`\`typescript
app.post('/users', User.validator('json', 'create', (result, c) => {
  if (!result.success) {
    throw new HTTPException(400, { message: 'Invalid input' })
  }
}), async (c) => {
  const body = c.req.valid('json')
  // ...
})
\`\`\`

フックは Zod のパース結果と Hono コンテキストを受け取ります。ここで \`HTTPException\` をスローすると、メッセージだけを含むきれいな 400 が返ります。

## Option 2 — onError で ZodError をキャッチ

\`app.onError\` でグローバルに \`ZodError\` をキャッチします:

\`\`\`typescript
import { ZodError } from 'zod'

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  if (err instanceof ZodError) {
    return c.json({ error: 'Invalid input' }, 400)
  }
  return c.json({ error: 'Internal Server Error' }, 500)
})
\`\`\`

これはバリデータミドルウェアのエラーだけでなく、ハンドラ内での手動 \`schema.parse()\` 呼び出しも含む、すべての \`ZodError\` スローに適用されます。

## パスワードフィールドのパターン

ルートで平文パスワードを受け取る必要がある場合は、\`inputSchema\` を拡張して追加フィールドを加え、サーバーサイドでハッシュ化してハッシュのみを保存します:

\`\`\`typescript
import { z } from 'zod'

const createUserSchema = User.inputSchema('create').extend({
  password: z.string().min(8),
})

app.post('/users', async (c) => {
  const body = await c.req.json()
  const data = createUserSchema.parse(body)
  const { password, ...rest } = data
  const passwordHash = await hashPassword(password)
  const user = await User.create(adapter, { ...rest, passwordHash })
  return c.json(User.toResponse(user), 201)
})
\`\`\`

\`passwordHash\` フィールドは \`serverOnly()\` なので、手動で除外し忘れてもレスポンスに含まれることはありません。

## D1 / Drizzle エラー

制約違反をキャッチし、内部エラーの詳細を露出させずに安全なエラーメッセージを返します:

\`\`\`typescript
try {
  const user = await User.create(adapter, data)
  return c.json(User.toResponse(user), 201)
} catch (err) {
  if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
    throw new HTTPException(409, { message: 'Email already in use' })
  }
  throw err
}
\`\`\`

内部の \`UNIQUE constraint failed\` メッセージはクライアントに転送されません。制約違反以外のエラーを再スローすることで、\`app.onError\` が 500 として処理します。

## ステータスコードパターン

\`\`\`typescript
// 201 Created
return c.json(body, 201)

// 204 No Content
return new Response(null, { status: 204 })

// 404 Not Found
throw new HTTPException(404, { message: 'Not found' })

// 409 Conflict
throw new HTTPException(409, { message: 'Email already in use' })
\`\`\`
`
