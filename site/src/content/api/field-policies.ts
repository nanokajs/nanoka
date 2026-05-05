export const contentEn = `\
# Field Policies

Field policies control where a field appears in the API surface. They are applied at the model level and affect schema derivation, CRUD inputs, and response shaping automatically.

## Policy quick reference

| Policy | DB column | Create input | Update input | API output |
|---|---|---|---|---|
| (none) | ✅ | ✅ | ✅ | ✅ |
| \`readOnly()\` | ✅ | ❌ | ❌ | ✅ |
| \`writeOnly()\` | ✅ | ✅ | ✅ | ❌ |
| \`serverOnly()\` | ✅ | ❌ | ❌ | ❌ |

## readOnly()

Use \`readOnly()\` for fields that are set once at creation time and never changed by callers. Typical patterns are auto-generated UUIDs and creation timestamps.

\`\`\`typescript
const fields = {
  id:        t.uuid().primary().readOnly(),
  createdAt: t.timestamp().readOnly().default(() => new Date()),
}
\`\`\`

- The field is present in every response.
- The field is excluded from \`inputSchema('create')\` and \`inputSchema('update')\`.
- For \`t.uuid().primary().readOnly()\`, Nanoka automatically sets \`$defaultFn(() => crypto.randomUUID())\` so the value is generated on insert.

## writeOnly()

Use \`writeOnly()\` for fields that must be accepted as input but must never appear in responses. A classic example is a field that stores a token or a value derived from user input.

\`\`\`typescript
const fields = {
  verificationToken: t.string().writeOnly(),
}
\`\`\`

- The field is accepted in \`create\` and \`update\` inputs.
- The field is stripped from every response by \`toResponse()\` and \`toResponseMany()\`.
- Note: storing a plain password as \`writeOnly()\` is **not** a secure pattern. Plain passwords must be hashed before storage. Use \`serverOnly()\` for the hash column and accept the plain password through a custom \`extend()\` on \`inputSchema('create')\`.

## serverOnly()

Use \`serverOnly()\` for fields that only server-side code should touch. The field exists in the database but is invisible to external callers from both directions.

\`\`\`typescript
const fields = {
  passwordHash: t.string().serverOnly(),
}
\`\`\`

- The field is **not** accepted in create or update inputs.
- The field is **not** present in any response.
- \`serverOnly\` fields are completely excluded from \`CreateInput<Fields>\`. Passing them to \`User.create()\` is a TypeScript error. To write a \`serverOnly\` field to the database, use the \`app.db\` escape hatch directly.

\`\`\`typescript
// ❌ serverOnly fields cannot be passed to User.create()
// await User.create({ ...body, passwordHash })  // TypeScript error

// ✅ Use app.db directly (escape hatch)
const hash = await bcrypt.hash(body.password, 10)
await app.db.insert(User.table).values({
  id: crypto.randomUUID(),
  email: body.email,
  name: body.name,
  passwordHash: hash,
})
\`\`\`

## Warning: do not re-inject serverOnly fields via extend()

When extending \`inputSchema('create')\` with a custom Zod shape, do not add the \`serverOnly\` field back to the schema. Doing so would expose the field as an accepted API input, defeating the purpose of \`serverOnly()\`.

\`\`\`typescript
// BAD — exposes passwordHash as an accepted API input
const CreateUserBody = User.inputSchema('create').extend({
  passwordHash: z.string(),  // never do this
})

// GOOD — accept plaintext password, hash server-side, write via app.db
const CreateUserBody = User.inputSchema('create').extend({
  password: z.string().min(8),
})

app.post('/users', zValidator('json', CreateUserBody), async (c) => {
  const { password, ...body } = c.req.valid('json')
  const passwordHash = await bcrypt.hash(password, 10)
  await app.db.insert(User.table).values({ ...body, passwordHash })
  const user = await User.findOne({ email: body.email })
  return c.json(User.toResponse(user!), 201)
})
\`\`\`

## pick / omit combined with field accessor

When you need to further narrow a schema beyond what policies provide, use the field accessor to get compile-time typo detection:

\`\`\`typescript
// Typo here is a type error, not a silent runtime miss
const PatchSchema = User.schema({ pick: (f) => [f.name, f.email] })

// Same for omit
const ResponseSchema = User.outputSchema({ omit: (f) => [f.createdAt] })
\`\`\`

The field accessor \`f\` maps each field name to itself as a string literal, so \`f.nme\` or \`f.emails\` would fail to type-check immediately.
`

export const contentJa = `\
# Field Policies

フィールドポリシーは、フィールドが API サーフェスのどこに現れるかを制御します。モデルレベルで適用され、スキーマ派生・CRUD 入力・レスポンス整形に自動的に影響します。

## ポリシー早見表

| ポリシー | DB カラム | Create 入力 | Update 入力 | API 出力 |
|---|---|---|---|---|
| （なし） | ✅ | ✅ | ✅ | ✅ |
| \`readOnly()\` | ✅ | ❌ | ❌ | ✅ |
| \`writeOnly()\` | ✅ | ✅ | ✅ | ❌ |
| \`serverOnly()\` | ✅ | ❌ | ❌ | ❌ |

## readOnly()

作成時に一度設定され、呼び出し側によって変更されることのないフィールドに使用します。典型的なパターンは自動生成 UUID と作成タイムスタンプです。

\`\`\`typescript
const fields = {
  id:        t.uuid().primary().readOnly(),
  createdAt: t.timestamp().readOnly().default(() => new Date()),
}
\`\`\`

- フィールドはすべてのレスポンスに含まれます。
- フィールドは \`inputSchema('create')\` および \`inputSchema('update')\` から除外されます。
- \`t.uuid().primary().readOnly()\` の場合、Nanoka が自動的に \`$defaultFn(() => crypto.randomUUID())\` を設定するため、挿入時に値が生成されます。

## writeOnly()

入力として受け付けるが、レスポンスには絶対に含めてはならないフィールドに使用します。トークンやユーザー入力から派生した値を保存するフィールドが典型例です。

\`\`\`typescript
const fields = {
  verificationToken: t.string().writeOnly(),
}
\`\`\`

- フィールドは \`create\` および \`update\` 入力で受け付けられます。
- フィールドは \`toResponse()\` および \`toResponseMany()\` によってすべてのレスポンスから除去されます。
- 注意: 平文パスワードを \`writeOnly()\` として保存することは**安全ではありません**。平文パスワードは保存前にハッシュ化が必要です。ハッシュカラムには \`serverOnly()\` を使い、平文パスワードは \`inputSchema('create')\` への \`extend()\` で別途受け付けてください。

## serverOnly()

サーバーサイドのコードのみが扱うべきフィールドに使用します。フィールドはデータベースに存在しますが、外部の呼び出し側からは双方向に不可視です。

\`\`\`typescript
const fields = {
  passwordHash: t.string().serverOnly(),
}
\`\`\`

- フィールドは create または update 入力で**受け付けられません**。
- フィールドはどのレスポンスにも**含まれません**。
- \`serverOnly\` フィールドは \`CreateInput<Fields>\` から完全に除外されます。\`User.create()\` に渡すと TypeScript エラーになります。DB に書き込むには \`app.db\` escape hatch を直接使用してください。

\`\`\`typescript
// ❌ serverOnly フィールドは User.create() に渡せない
// await User.create({ ...body, passwordHash })  // TypeScript エラー

// ✅ app.db を直接使う（escape hatch）
const hash = await bcrypt.hash(body.password, 10)
await app.db.insert(User.table).values({
  id: crypto.randomUUID(),
  email: body.email,
  name: body.name,
  passwordHash: hash,
})
\`\`\`

## 注意: extend() で serverOnly フィールドを再注入しない

\`inputSchema('create')\` をカスタム Zod シェイプで拡張する場合、\`serverOnly\` フィールドをスキーマに戻してはいけません。そうすると、フィールドが受け入れ可能な API 入力として公開され、\`serverOnly()\` の目的が失われます。

\`\`\`typescript
// 悪い例 — passwordHash を受け入れ可能な API 入力として公開してしまう
const CreateUserBody = User.inputSchema('create').extend({
  passwordHash: z.string(),  // 絶対にやらない
})

// 良い例 — 平文パスワードを受け取り、サーバーサイドでハッシュ化して app.db で書き込む
const CreateUserBody = User.inputSchema('create').extend({
  password: z.string().min(8),
})

app.post('/users', zValidator('json', CreateUserBody), async (c) => {
  const { password, ...body } = c.req.valid('json')
  const passwordHash = await bcrypt.hash(password, 10)
  await app.db.insert(User.table).values({ ...body, passwordHash })
  const user = await User.findOne({ email: body.email })
  return c.json(User.toResponse(user!), 201)
})
\`\`\`

## フィールドアクセサと pick / omit の組み合わせ

ポリシーが提供する以上にスキーマをさらに絞り込む必要がある場合は、フィールドアクセサを使うことでコンパイル時のタイポ検出が得られます:

\`\`\`typescript
// ここでのタイポは型エラーになり、サイレントな runtime ミスにならない
const PatchSchema = User.schema({ pick: (f) => [f.name, f.email] })

// omit でも同様
const ResponseSchema = User.outputSchema({ omit: (f) => [f.createdAt] })
\`\`\`

フィールドアクセサ \`f\` は各フィールド名を文字列リテラルとして自身にマッピングするため、\`f.nme\` や \`f.emails\` のようなタイポは即座に型チェックエラーになります。
`
