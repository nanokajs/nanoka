export const contentEn = `\
# OpenAPI

Nanoka supports generating OpenAPI 3.1 documents from model definitions and route metadata. The generated spec is documentation — it is not used for runtime validation.

## toOpenAPIComponent()

Returns an OpenAPI component object for the model that can be referenced in the spec. Includes all fields with their types and descriptions, with policies applied for output.

\`\`\`typescript
const component = User.toOpenAPIComponent()
// { UserOutput: { type: 'object', properties: { ... } } }
\`\`\`

## toOpenAPISchema(usage)

Returns an OpenAPI schema object for a specific usage context. Three usages are available:

\`\`\`typescript
// Schema for create request body — readOnly and serverOnly fields excluded
User.toOpenAPISchema('create')

// Schema for update request body — readOnly and serverOnly excluded, all fields optional
User.toOpenAPISchema('update')

// Schema for response body — serverOnly and writeOnly fields excluded
User.toOpenAPISchema('output')
\`\`\`

Use these inline in your route definitions to document request and response shapes:

\`\`\`typescript
app.post('/users', {
  openapi: {
    summary: 'Create user',
    requestBody: {
      required: true,
      content: { 'application/json': { schema: User.toOpenAPISchema('create') } },
    },
    responses: {
      '201': {
        description: 'Created user',
        content: { 'application/json': { schema: User.toOpenAPISchema('output') } },
      },
    },
  },
}, User.validator('json', 'create'), handler)
\`\`\`

## app.openapi(metadata)

Registers OpenAPI metadata for a route independently of the route handler. Use this form when you need \`c.req.valid()\` to retain its inferred type in the handler.

\`\`\`typescript
app.openapi({
  method: 'post',
  path: '/users',
  summary: 'Create user',
  requestBody: {
    required: true,
    content: { 'application/json': { schema: User.toOpenAPISchema('create') } },
  },
  responses: {
    '201': { description: 'Created user' },
  },
})

app.post('/users', User.validator('json', 'create'), async (c) => {
  const body = c.req.valid('json')  // type is properly inferred here
  const user = await User.create(body)
  return c.json(User.toResponse(user), 201)
})
\`\`\`

## Known limitation: inline { openapi } loses c.req.valid type inference

When you pass \`{ openapi: ... }\` as the second argument to \`app.get()\` / \`app.post()\` / etc., the handler's \`c.req.valid()\` loses its inferred type. This is because the inline form uses a variadic \`H[]\` overload that does not thread the validator's type through to the handler.

\`\`\`typescript
// Inline form — c.req.valid loses type inference
app.post('/users', { openapi: { ... } }, User.validator('json', 'create'), async (c) => {
  const body = c.req.valid('json')  // type is 'unknown' here
  // Must cast explicitly:
  const body2 = (c.req.valid as (t: 'json') => { email: string; name: string })('json')
})
\`\`\`

**Recommendation:** use \`app.openapi()\` + a separate route definition when full handler type inference is required.

## app.generateOpenAPISpec(options)

Builds the full OpenAPI 3.1 document from all registered metadata. Mount the result at \`/openapi.json\`:

\`\`\`typescript
app.get('/openapi.json', (c) =>
  c.json(
    app.generateOpenAPISpec({
      info: { title: 'My API', version: '1.0.0' },
    }),
  ),
)
\`\`\`

The \`info\` field is required. Optional \`servers\` and \`tags\` can be added.

## swaggerUI({ url, title? })

Mounts a Swagger UI endpoint that reads from the given OpenAPI JSON URL:

\`\`\`typescript
import { swaggerUI } from '@nanokajs/core'

app.get('/docs', swaggerUI({ url: '/openapi.json', title: 'API Docs' }))
\`\`\`

Navigate to \`/docs\` to see the interactive API documentation.

## OpenAPI and runtime validation

> **Important:** The OpenAPI spec is documentation only. Runtime validation is always performed by Zod schemas and Hono validators (\`inputSchema()\` / \`outputSchema()\` / \`User.validator()\`). Do not treat the OpenAPI spec as a security boundary.
`

export const contentJa = `\
# OpenAPI

Nanoka はモデル定義とルートメタデータから OpenAPI 3.1 ドキュメントの生成をサポートします。生成されたスペックはドキュメントです — runtime バリデーションには使用されません。

## toOpenAPIComponent()

スペック内で参照できるモデルの OpenAPI コンポーネントオブジェクトを返します。ポリシーが output 向けに適用されたすべてのフィールドの型と説明が含まれます。

\`\`\`typescript
const component = User.toOpenAPIComponent()
// { UserOutput: { type: 'object', properties: { ... } } }
\`\`\`

## toOpenAPISchema(usage)

特定の使用コンテキスト向けの OpenAPI スキーマオブジェクトを返します。3 つの usage が使えます:

\`\`\`typescript
// create リクエストボディ用スキーマ — readOnly と serverOnly フィールドは除外
User.toOpenAPISchema('create')

// update リクエストボディ用スキーマ — readOnly と serverOnly は除外、全フィールドはオプション
User.toOpenAPISchema('update')

// レスポンスボディ用スキーマ — serverOnly と writeOnly フィールドは除外
User.toOpenAPISchema('output')
\`\`\`

ルート定義でインラインに使って、リクエストとレスポンスの形状をドキュメント化します:

\`\`\`typescript
app.post('/users', {
  openapi: {
    summary: 'Create user',
    requestBody: {
      required: true,
      content: { 'application/json': { schema: User.toOpenAPISchema('create') } },
    },
    responses: {
      '201': {
        description: 'Created user',
        content: { 'application/json': { schema: User.toOpenAPISchema('output') } },
      },
    },
  },
}, User.validator('json', 'create'), handler)
\`\`\`

## app.openapi(metadata)

ルートハンドラとは独立して、ルートの OpenAPI メタデータを登録します。ハンドラ内で \`c.req.valid()\` が型推論を保持する必要がある場合はこの形式を使います。

\`\`\`typescript
app.openapi({
  method: 'post',
  path: '/users',
  summary: 'Create user',
  requestBody: {
    required: true,
    content: { 'application/json': { schema: User.toOpenAPISchema('create') } },
  },
  responses: {
    '201': { description: 'Created user' },
  },
})

app.post('/users', User.validator('json', 'create'), async (c) => {
  const body = c.req.valid('json')  // ここで型が正しく推論される
  const user = await User.create(body)
  return c.json(User.toResponse(user), 201)
})
\`\`\`

## 既知の制限: インライン { openapi } は c.req.valid の型推論を失う

\`app.get()\` / \`app.post()\` などの第 2 引数に \`{ openapi: ... }\` を渡すと、ハンドラの \`c.req.valid()\` が型推論を失います。これはインライン形式がバリデータの型をハンドラまでスレッドしない可変長 \`H[]\` オーバーロードを使うためです。

\`\`\`typescript
// インライン形式 — c.req.valid が型推論を失う
app.post('/users', { openapi: { ... } }, User.validator('json', 'create'), async (c) => {
  const body = c.req.valid('json')  // ここでの型は 'unknown'
  // 明示的なキャストが必要:
  const body2 = (c.req.valid as (t: 'json') => { email: string; name: string })('json')
})
\`\`\`

**推奨:** ハンドラの型推論が必要な場合は \`app.openapi()\` と別のルート定義を使ってください。

## app.generateOpenAPISpec(options)

登録されたすべてのメタデータから完全な OpenAPI 3.1 ドキュメントを構築します。結果を \`/openapi.json\` で配信します:

\`\`\`typescript
app.get('/openapi.json', (c) =>
  c.json(
    app.generateOpenAPISpec({
      info: { title: 'My API', version: '1.0.0' },
    }),
  ),
)
\`\`\`

\`info\` フィールドは必須です。オプションで \`servers\` と \`tags\` を追加できます。

## swaggerUI({ url, title? })

指定した OpenAPI JSON URL から読み込む Swagger UI エンドポイントをマウントします:

\`\`\`typescript
import { swaggerUI } from '@nanokajs/core'

app.get('/docs', swaggerUI({ url: '/openapi.json', title: 'API Docs' }))
\`\`\`

\`/docs\` にアクセスするとインタラクティブな API ドキュメントが表示されます。

## OpenAPI と runtime バリデーション

> **重要:** OpenAPI スペックはドキュメントのみです。Runtime バリデーションは常に Zod スキーマと Hono バリデータ（\`inputSchema()\` / \`outputSchema()\` / \`User.validator()\`）によって行われます。OpenAPI スペックをセキュリティ境界として扱わないでください。
`
