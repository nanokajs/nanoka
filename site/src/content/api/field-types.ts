export const contentEn = `\
# Field Types

Nanoka's \`t\` object provides a small set of field builders that map directly to SQLite column types and produce Zod validators. All modifiers are chainable and type-safe.

## Field Types

### t.string()

Maps to a SQLite \`text\` column. Accepts optional \`min\`, \`max\`, and \`email\` validators.

\`\`\`typescript
import { t } from '@nanokajs/core'

const fields = {
  name:  t.string().min(1).max(255),
  email: t.string().email(),
  bio:   t.string().optional(),
}
\`\`\`

### t.uuid()

Maps to a SQLite \`text\` column. When combined with \`.primary().readOnly()\`, Nanoka automatically sets \`$defaultFn(() => crypto.randomUUID())\` on the Drizzle column — you never need to generate the ID manually.

\`\`\`typescript
const fields = {
  id: t.uuid().primary().readOnly(),
}
\`\`\`

Because \`readOnly()\` excludes the field from \`create\` and \`update\` inputs, callers cannot supply an \`id\`. The UUID is generated server-side on every \`create()\` call.

### t.integer()

Maps to a SQLite \`integer\` column. The Zod validator enforces integer values (\`z.number().int()\`).

\`\`\`typescript
const fields = {
  age:  t.integer().min(0).max(150),
  rank: t.integer().optional(),
}
\`\`\`

### t.number()

Maps to a SQLite \`real\` column. Accepts floating-point values.

\`\`\`typescript
const fields = {
  price:  t.number().min(0),
  rating: t.number().min(0).max(5),
}
\`\`\`

### t.boolean()

Maps to a SQLite \`integer({ mode: 'boolean' })\` column. Drizzle handles the 0/1 ↔ true/false conversion automatically.

\`\`\`typescript
const fields = {
  isActive: t.boolean().default(true),
  isAdmin:  t.boolean().default(false),
}
\`\`\`

### t.timestamp()

Maps to a SQLite \`integer({ mode: 'timestamp_ms' })\` column. Values are stored as milliseconds since epoch and returned as \`Date\` objects.

\`\`\`typescript
const fields = {
  createdAt: t.timestamp().readOnly().default(() => new Date()),
  updatedAt: t.timestamp().optional(),
}
\`\`\`

### t.json()

Maps to a SQLite \`text({ mode: 'json' })\` column. Two forms are available:

**Type annotation only** — no runtime validation beyond JSON parsing:

\`\`\`typescript
const fields = {
  metadata: t.json<{ tags: string[] }>(),
}
\`\`\`

**With Zod schema** — runtime validation on every parse:

\`\`\`typescript
import { z } from 'zod'

const TagsSchema = z.object({ tags: z.array(z.string()) })

const fields = {
  metadata: t.json(TagsSchema),
}
\`\`\`

> **Note:** \`nanoka generate\` always emits \`$type<unknown>()\` in the generated Drizzle schema regardless of which form you use. If you need a typed Drizzle column, edit the generated file manually or add a cast after generation.

## Modifiers

All field builders support the following chainable modifiers:

| Modifier | Effect |
|---|---|
| \`.primary()\` | Marks the column as the primary key |
| \`.unique()\` | Adds a unique constraint |
| \`.optional()\` | Allows \`undefined\` / \`null\`; removes the \`NOT NULL\` constraint |
| \`.default(val)\` | Sets a static default value |
| \`.default(fn)\` | Sets a dynamic default via \`$defaultFn\` |
| \`.min(n)\` | Minimum string length (string/uuid) or minimum value (number/integer) |
| \`.max(n)\` | Maximum string length (string/uuid) or maximum value (number/integer) |
| \`.email()\` | Adds email format validation (string only) |
| \`.serverOnly()\` | Column exists in DB but is excluded from all API inputs and outputs |
| \`.writeOnly()\` | Accepted as input but never included in responses |
| \`.readOnly()\` | Included in responses but excluded from create/update inputs |

## Relations

Two relation field builders are available for defining associations between models:

\`\`\`typescript
import { t } from '@nanokajs/core'

// 1 → N: define on the parent model
t.hasMany(target, { foreignKey: 'userId' })

// N → 1: define on the child model
t.belongsTo(target, { foreignKey: 'userId' })
\`\`\`

**Key characteristics:**

- Relation fields **have no DB column** — \`nanoka generate\` skips them entirely.
- They are **excluded from \`validator()\`, \`inputSchema()\`, and \`outputSchema()\`** by default.
- The target can be a model reference or a thunk (\`() => Model\`) to handle bidirectional relations.
- \`foreignKey\` is always required — Nanoka does not infer it.

Relation fields are defined in \`app.model()\` registration, not in model files (which should contain DB columns only).

See [Relations](/api/relations) for the full API including \`with\` query options and OpenAPI integration.
`

export const contentJa = `\
# Field Types

Nanoka の \`t\` オブジェクトは、SQLite カラム型に直接マッピングされ Zod バリデータを生成するフィールドビルダーを提供します。すべてのモディファイアはチェーン可能で型安全です。

## フィールド型

### t.string()

SQLite の \`text\` カラムにマッピングされます。オプションで \`min\`・\`max\`・\`email\` バリデータを追加できます。

\`\`\`typescript
import { t } from '@nanokajs/core'

const fields = {
  name:  t.string().min(1).max(255),
  email: t.string().email(),
  bio:   t.string().optional(),
}
\`\`\`

### t.uuid()

SQLite の \`text\` カラムにマッピングされます。\`.primary().readOnly()\` と組み合わせると、Nanoka が自動的に \`$defaultFn(() => crypto.randomUUID())\` を Drizzle カラムに設定します — ID を手動で生成する必要はありません。

\`\`\`typescript
const fields = {
  id: t.uuid().primary().readOnly(),
}
\`\`\`

\`readOnly()\` によりフィールドが \`create\` および \`update\` 入力から除外されるため、呼び出し側は \`id\` を指定できません。UUID はすべての \`create()\` 呼び出し時にサーバーサイドで生成されます。

### t.integer()

SQLite の \`integer\` カラムにマッピングされます。Zod バリデータは整数値（\`z.number().int()\`）を強制します。

\`\`\`typescript
const fields = {
  age:  t.integer().min(0).max(150),
  rank: t.integer().optional(),
}
\`\`\`

### t.number()

SQLite の \`real\` カラムにマッピングされます。浮動小数点値を受け付けます。

\`\`\`typescript
const fields = {
  price:  t.number().min(0),
  rating: t.number().min(0).max(5),
}
\`\`\`

### t.boolean()

SQLite の \`integer({ mode: 'boolean' })\` カラムにマッピングされます。0/1 ↔ true/false の変換は Drizzle が自動で処理します。

\`\`\`typescript
const fields = {
  isActive: t.boolean().default(true),
  isAdmin:  t.boolean().default(false),
}
\`\`\`

### t.timestamp()

SQLite の \`integer({ mode: 'timestamp_ms' })\` カラムにマッピングされます。値はエポックからのミリ秒として保存され、\`Date\` オブジェクトとして返されます。

\`\`\`typescript
const fields = {
  createdAt: t.timestamp().readOnly().default(() => new Date()),
  updatedAt: t.timestamp().optional(),
}
\`\`\`

### t.json()

SQLite の \`text({ mode: 'json' })\` カラムにマッピングされます。2 つの形式が使えます:

**型アノテーションのみ** — JSON パース以外の runtime 検証なし:

\`\`\`typescript
const fields = {
  metadata: t.json<{ tags: string[] }>(),
}
\`\`\`

**Zod スキーマ付き** — 毎回のパース時に runtime 検証:

\`\`\`typescript
import { z } from 'zod'

const TagsSchema = z.object({ tags: z.array(z.string()) })

const fields = {
  metadata: t.json(TagsSchema),
}
\`\`\`

> **注意:** \`nanoka generate\` は、どちらの形式を使っても生成された Drizzle スキーマには常に \`$type<unknown>()\` を出力します。型付きの Drizzle カラムが必要な場合は、生成後に手動でファイルを編集するかキャストを追加してください。

## モディファイア

すべてのフィールドビルダーは以下のチェーン可能なモディファイアをサポートします:

| モディファイア | 効果 |
|---|---|
| \`.primary()\` | カラムを主キーとして設定する |
| \`.unique()\` | ユニーク制約を追加する |
| \`.optional()\` | \`undefined\` / \`null\` を許可する。\`NOT NULL\` 制約を削除する |
| \`.default(val)\` | 静的なデフォルト値を設定する |
| \`.default(fn)\` | \`$defaultFn\` による動的なデフォルトを設定する |
| \`.min(n)\` | 文字列の最小長（string/uuid）または最小値（number/integer）|
| \`.max(n)\` | 文字列の最大長（string/uuid）または最大値（number/integer）|
| \`.email()\` | メール形式バリデーションを追加する（string のみ）|
| \`.serverOnly()\` | DB にカラムは存在するが、すべての API 入出力から除外される |
| \`.writeOnly()\` | 入力として受け付けるが、レスポンスには含めない |
| \`.readOnly()\` | レスポンスには含まれるが、create/update 入力から除外される |

## Relations

モデル間の関連を定義するための relation フィールドビルダーが 2 つあります:

\`\`\`typescript
import { t } from '@nanokajs/core'

// 1 → N: 親モデルに定義する
t.hasMany(target, { foreignKey: 'userId' })

// N → 1: 子モデルに定義する
t.belongsTo(target, { foreignKey: 'userId' })
\`\`\`

**主な特性:**

- relation フィールドは **DB 列を持ちません** — \`nanoka generate\` で完全に skip されます。
- \`validator()\`・\`inputSchema()\`・\`outputSchema()\` から**デフォルト除外**されます。
- ターゲットにはモデル参照か thunk（\`() => Model\`）を使えます（双方向 relation の TDZ 回避）。
- \`foreignKey\` は常に必須です — Nanoka は推測しません。

relation フィールドはモデルファイルではなく \`app.model()\` 登録時に定義します（モデルファイルは DB 列のみ持つ）。

\`with\` クエリオプションや OpenAPI 連携を含む詳細は [Relations](/api/relations) を参照してください。
`
