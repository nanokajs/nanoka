# Nanoka

> 七日（なのか）— 週休7日制の楽園から生まれた、Hono/Drizzle薄ラッパー

---

## コンセプト

**「ありえないほど怠惰に書けるWorkers APIレイヤー」**

エンジニアが「Webアプリ書くのめんどくさい」と感じる時間の大半は、ルーティングではなくDB周りの儀式だ。スキーマ定義 → 型生成 → マイグレーション → クエリ → バリデーション、この5ステップを別々のツールで繋ぐ現状を、Nanokaはモデル定義を中心に据えて整理する。

Nanokaは**薄いラッパーとして始める**。HonoとDrizzleを捨てるのではなく、その上に乗る。使われたらフレームワークに育てる——名乗るのは後でいい。

名前の由来は「七日」。誰も悲しまない楽園のコンセプト——**週休7日制**——から。Honoが「炎」なら、Nanokaはその炎が消えた後の静けさ。

---

## ポジショニング

| | Hono | Drizzle | Nanoka |
|---|---|---|---|
| ルーティング | ✅ | ❌ | ✅（Hono内包） |
| ORM / クエリ | ❌ | ✅ | ✅（Drizzle内包） |
| マイグレーション | ❌ | ✅ | ✅（生成・手動実行） |
| バリデーション | △（Zod別途） | ❌ | ✅（モデルから派生） |
| CF Workers対応 | ✅ | ✅ | ✅ |
| 学習コスト | 低 | 中 | **低** |

現在のベストプラクティスは `Hono + Drizzle + Zod` の3つを自分で繋ぐ構成。Nanokaはモデル定義をDBスキーマと型の中核に置き、そこからバリデーションを派生させることでこの儀式を削る。

---

## ターゲット

- **プラットフォーム**: Cloudflare Workers + D1（SQLite）ファーストクラスサポート
- **対象ユーザー**: TypeScriptでAPIを速く書きたい個人開発者・スモールチーム
- **空白ポジション**: Cloudflare Workers + D1向けに、Hono互換・モデル駆動・API-firstをまとめた軽量レイヤーはまだ薄い

### 近い競合との棲み分け

| | Nanoka | RedwoodSDK | Prisma |
|---|---|---|---|
| 思想 | API-first / model-first | Full-stack React-first | ORM単体 |
| ルーター | Hono互換 | RedwoodSDK独自 | なし |
| DB escape hatch | 素のDrizzle | Kysely / 生SQL | Raw SQL |
| 主な用途 | 小規模APIを即作る | フルスタックアプリを組む | DBアクセス層のみ |

**Prismaについて**: Prisma 7.0でバンドルサイズ問題は解消されWorkers互換になった。NanokaはPrismaより軽いことを売りにしない。「Workers + D1 + Hono API構築体験を薄く統合する」用途が違う。

> **なぜ今まで誰も統合しなかったか**
> CF Workers + D1の組み合わせが成熟したのが2024〜2025年。プラットフォームの完成度が統合レイヤーを作る前提条件で、そのタイミングがちょうど今。

---

## コアバリュー：モデルをDBスキーマと型の中核に

モデル定義からDBスキーマ・型・基本バリデーションを派生させる。ただし**「唯一の真実」はDB寄りに限定する**。APIの入出力はDBモデルとズレる場面が必ずある（`passwordHash`はDBにあるがレスポンスには出せない、など）。バリデーションはモデルからの派生だが、ルートごとの調整は明示的に書く。

```ts
import { nanoka, d1Adapter, t } from '@nanokajs/core'

const app = nanoka(d1Adapter(env.DB))

// モデル定義 → DBスキーマ・型・ベースバリデーションが派生する
const User = app.model('users', {
  id:           t.uuid().primary(),
  name:         t.string(),
  email:        t.string().email(),
  passwordHash: t.string(),          // DBにはあるがAPIレスポンスには出さない
})

// GETはページネーション付きで安全に
app.get('/users', async (c) => {
  const users = await User.findMany({ limit: 20, offset: 0, orderBy: 'id' })
  return c.json(users)
})

// POSTはschemaをHono validatorとして使う
app.post('/users', User.validator('json', { omit: ['passwordHash'] }), async (c) => {
  const body = c.req.valid('json')   // Hono標準に従う
  const user = await User.create(body)
  return c.json(user, 201)
})

// PATCHはpartialで派生させる
app.patch('/users/:id', User.validator('json', { partial: true, pick: ['name', 'email'] }), async (c) => {
  const body = c.req.valid('json')
  const user = await User.update(c.req.param('id'), body)
  return c.json(user)
})
```

### バリデーションの責務分離

`schema()` と `validator()` を分ける。将来バリデーターだけ差し替えたい場面に備える。

```ts
// schema() — Zodスキーマを返す。単体でも使える
const CreateSchema = User.schema({ omit: ['passwordHash'] })
const UpdateSchema = User.schema({ partial: true, pick: ['name', 'email'] })
const ResponseSchema = User.schema({ omit: ['passwordHash'] })

// validator() — Hono validatorとして使う。第1引数はHonoのtarget（'json' | 'query' | 'param'）
User.validator('json', { omit: ['passwordHash'] })
User.validator('json', { partial: true })
```

### 型安全なフィールドアクセス（Phase 2以降）

`pick` / `omit` への文字列配列はタイポがコンパイルエラーにならない。Phase 2ではまずschema/validator用途のフィールドアクセサAPIを導入し、**Proxyなし・ランタイムコストなし**でタイポを型エラーにする。

```ts
// Phase 2：schema / validator のフィールドアクセサ形式
User.schema({ pick: (f) => [f.name, f.emial] })
//                                   ^^^^^^ Type error: 'emial' does not exist

// Phase 2後半以降の候補：クエリ側アクセサ
User.where({ email: 'foo@example.com' })           // MVP（オブジェクト形式）
User.where(f => eq(f.email, 'foo@example.com'))    // 候補（Drizzle再発明に寄りやすいため後回し）
```

内部の `f` はProxyではなく `as const` オブジェクト。ランタイムコストはゼロ。

```ts
const f = { id: 'id', name: 'name', email: 'email' } as const
```

---

## 設計方針

### 1. モデルをDB寄りの中核に、派生で解決する
モデル定義がDBスキーマと型の中核。APIバリデーションはそこから派生させるが、DB層とAPI層の責務は明確に分ける。「全部自動」ではなく「**80%自動、20%明示**」。

### 2. マイグレーションはDrizzle Kit / Wranglerの流儀に乗る

独自のdiffエンジンは書かない。NanokaはモデルDSLからDrizzleスキーマ定義を生成し、migration差分生成・適用はDrizzle KitとWranglerの既存フローに委ねる。

```
# Nanokaがやること
nanoka generate        # モデル定義 → Drizzleスキーマファイルを生成

# 既存ツールに委ねること
drizzle-kit generate   # スキーマ差分からSQLを生成
wrangler d1 migrations apply --local / --remote  # 適用
```

この分界により、migration基盤を自前で維持するコストをゼロにする。migration差分生成・SQL管理はDrizzle Kit / Wranglerの既存フローに寄せる。

### 3. D1ファースト、adapter設計で逃げ道を用意
D1をファーストクラスサポートしつつ、最初からadapter層を設計に含める。TursoやlibSQLへの移行パスを閉じない。

### 4. Honoを内包する
「共存」ではなく「内包」。NanokaのルーターはHono互換とし、サンプルコードも `c.req.valid('json')` などHono標準に従う。Honoのエコシステム（middleware・RPC・OpenAPI）をそのまま使える。

### 5. escape hatchを常に開けておく
抽象が邪魔になったら素のDrizzleに降りられる。フレームワークに閉じ込めない。

```ts
// いつでも素のDrizzleに降りられる
const result = await app.db
  .select()
  .from(User.table)
  .where(eq(User.table.email, 'foo@example.com'))
  .limit(1)
// app.db 経由で取得した row は policy 未適用（passwordHash 等を含む完全な DB 行）。
// API レスポンスに返すときは User.toResponse(row) または z.array(User.outputSchema()).parse(rows) を必ず通すこと。
```

---

## Nanokaがやらないこと（MVP時点）

- フルスタックReactフレームワークにはしない
- 認証・認可をコアに含めない
- 複雑なSQLをDSLですべて表現しない（素のDrizzleで書く）
- マイグレーションを自動実行しない
- D1以外のDBをMVP段階で完全サポートしない
- relationをMVPに含めない（Phase 2以降、手書きDrizzleで対応）
- フィールドアクセサAPIをMVPに含めない（Phase 2以降）

> **成長戦略**: 薄いラッパーとして始め、使われたらフレームワークに育てる。スコープを広げるタイミングはユーザーの声が判断基準。名乗るのは後でいい。

---

## 実装ロードマップ

### Phase 1 — MVP（薄いラッパーとして成立させる）

**残すもの**
- [ ] `app.model()` DSLの設計と実装
- [ ] `nanoka generate`（モデル定義 → Drizzleスキーマ生成）
- [ ] Drizzle Kit / Wrangler migration flowのテンプレート生成
- [ ] READMEにmigration手順を明記
- [ ] 基本CRUDクエリ（`findMany` / `findOne` / `create` / `update` / `delete`）
- [ ] `User.schema()` / `User.validator()` の派生バリデーション（責務分離）
- [ ] D1 adapter実装（adapter層を最初から分離）
- [ ] Cloudflare Workers上での動作確認

**最低限対応する設計上の問い**
- pagination: `findMany({ limit, offset, orderBy })` をデフォルト安全に
- エラーハンドリング: Honoの `HTTPException` に乗る。Nanokaは独自エラー型を持たない
- transaction: D1のbatch APIをそのまま公開。独自抽象は持たない

> **Phase 1時点のrelationについて**: `t.hasMany()` / `t.belongsTo()` はMVPに含めない。リレーションが必要な場合は素のDrizzleで書く。cascade・N+1・join型推論の設計負荷はPhase 2以降で向き合う。

### Phase 1.5 — 公開運用基盤
- [ ] README onboarding parity CI（公開 tarball / 最小 scaffold で `tsc --noEmit` と `drizzle-kit generate` を検証）
- [ ] GitHub Actions の PR ゲート（build / test / typecheck / lint）
- [ ] tag push による publish 自動化
- [ ] CONTRIBUTING / Issue・PR template / CODEOWNERS
- [ ] Phase 1 の型持ち越し解消（`Nanoka<E extends Env>` など）

### Phase 2 — API境界をNanokaのコア価値にする

DrizzleのクエリDSLを再発明するのではなく、DBモデルとAPI入力/出力の境界を安全に速く書ける方向へ伸ばす。

#### Phase 2A — API境界
- [x] フィールドポリシー（例: `serverOnly()` / `writeOnly()` / `readOnly()`）
- [x] 用途別スキーマ（例: `User.inputSchema('create')` / `User.inputSchema('update')` / `User.outputSchema()`）
- [x] validator preset（例: `User.validator('json', 'create')`）
- [x] 明示的なレスポンス整形（`User.toResponse(row)` および `User.outputSchema().parse(row)` の両方）
- [x] `t.json(zodSchema)` による JSON フィールドの実行時検証

##### Phase 2A の設計判断メモ

**`writeOnly` の用途と制約（判断 F）**

`writeOnly()` は「DB 列はあるが API output から消す」用途のみ対応する。`password` のような「DB 列を持たない平文入力」は field DSL 内では扱わない（virtual field は M1 範囲外）。

推奨パターン:
```ts
import { zValidator } from '@hono/zod-validator'

// handler 内で password → passwordHash 変換
const CreateUserBody = User.inputSchema('create').extend({ password: z.string().min(8) })

app.post('/users', zValidator('json', CreateUserBody), async (c) => {
  const { password, ...body } = c.req.valid('json')
  const passwordHash = await hash(password)
  const created = await User.create({
    ...body,
    id: crypto.randomUUID(),
    passwordHash,
    createdAt: new Date(),
  })
  // password / passwordHash を絶対に返さない（toResponse が serverOnly を strip）
  return c.json(User.toResponse(created))
})
```

`zValidator` に渡すことで runtime 検証が確実に走る。`User.toResponse(created)` を通すことでレスポンスから `passwordHash` が確実に剥がれる。

注意: `User.inputSchema('create').extend({ ... })` で `passwordHash` のような `serverOnly` フィールドを再注入しないこと。`extend()` で再注入された場合、`inputSchema` 由来の自動 strip 保護は効かない。

**`t.json(zodSchema)` と codegen の関係（判断 E）**

`t.json(zodSchema)` を渡しても、`nanoka generate` が出力する Drizzle schema TS は `$type<unknown>()` のまま。`app.db.select().from(User.table)` 経由で精緻型が欲しい場合は、生成された Drizzle schema TS を手動で `$type<{...}>()` に書き換えるか、ユーザー側で `as` を使う。API 層の zod runtime 検証は `t.json(zodSchema)` で正しく走る。

`t.json(zodSchema)` で外部入力を runtime 検証するときは、Hono の body size limit（`bodyLimit` middleware など）を併用すると、巨大ペイロード起因の CPU 消費を抑えられる。zod 自体は深さ無制限なので、防御層を多重化しておくのが安全。

**レスポンス整形の役割分担（判断 G）**

単体 row のレスポンス整形は `User.toResponse(row)` で convenience wrapper を提供する。配列の場合は `z.array(User.outputSchema()).parse(rows)` で zod schema 合成として書く。これにより「80% automatic, 20% explicit」を維持し、配列変換は明示的に書く設計にする。

#### Phase 2B — 型と互換性
- [x] フィールドアクセサAPI（まず `pick` / `omit` / validator 用途から: `User.schema({ pick: f => [f.name] })`）
- [x] **Zod 4 サポート**（`peerDependencies.zod` は `^3.23.0 || ^4.0.0`）
- [x] create / update input の必須・任意フィールド精緻化
- [x] **Phase 1.5 持ち越しの型精緻化**: `noExplicitAny` warning は大幅削減、`noNonNullAssertion` は 0 件化

#### Phase 2C — OpenAPI seed
- [x] モデル単位の JSON Schema / OpenAPI component 生成
- [x] `inputSchema()` / `outputSchema()` / フィールドポリシーが OpenAPI の source of truth として成立するか検証
- [x] Hono ルート全体の自動収集や Swagger UI は Phase 3 に送る判断を記録

#### 1.0.0 リリース判断基準

`1.0.0` は Phase 3 の完了ではなく、Nanoka の中心 API を長期維持できると判断できた時点で切る。具体的には Phase 2A / 2B と最小 OpenAPI seed を完了し、DBモデルとAPI入力/出力の境界設計を破壊的変更なしに保てる状態を条件にする。

- [x] `serverOnly()` / `writeOnly()` / `readOnly()` の意味論が確定している
- [x] `inputSchema('create' | 'update')` / `outputSchema()` の公開 API が安定している
- [x] `User.validator(...)` の用途別 preset が安定している
- [x] `t.json(zodSchema)` と Zod 4 対応が完了している
- [x] create / update input 型が実用上十分に精緻化されている
- [x] OpenAPI component 生成で schema 設計が破綻しないことを確認済み
- [x] onboarding parity CI により README 通りの導入が継続検証されている
- [x] 既知の破壊的変更候補が backlog 上で整理または解消されている

relation / Turso・libSQL adapter / route-level OpenAPI / `create-nanoka-app` / VSCode拡張は `1.0.0` の必須条件にしない。ただし 2026-05 時点の実装では、Turso・libSQL adapter、route-level OpenAPI / Swagger UI、`create-nanoka-app` は 1.0.0 後の 1.x 機能として既に取り込まれている。

#### 1.x 追加済み（Phase 2 後半 / Phase 3 が混在して実装されたもの）
- [x] route-level OpenAPI: `app.openapi(metadata)` / `app.generateOpenAPISpec(options)`
- [x] Swagger UI middleware: `swaggerUI({ url, title? })`
- [x] Turso / libSQL adapter: `tursoAdapter(client)`（`@nanokajs/core/turso` export）
- [x] CLIスキャフォールダ: `create-nanoka-app`

#### 次に残っている設計候補
- [ ] リレーション定義（`t.hasMany()` / `t.belongsTo()`）※cascade/N+1/joinの型推論を含む重い作業
- [ ] 型安全なクエリビルダー（`User.where(f => eq(f.email, x)).limit(10)`）※Drizzle再発明に寄りやすいため優先度を下げる
- [ ] VSCode拡張（モデル定義からの補完）
- [ ] Claude Code / Codex プラグイン（モデル定義・ルート生成・migration手順の補助）
- [ ] OSSコミュニティ整備

---

## 技術スタック（予定）

| レイヤー | 採用技術 | 理由 |
|---|---|---|
| ランタイム | Cloudflare Workers | エッジ・低コスト・D1との統合 |
| DB（ファースト） | Cloudflare D1（SQLite） | Workers前提の最適解 |
| ORMコア | Drizzle ORM | 7.4kb・エッジ対応・escape hatchが容易 |
| バリデーション | Zod（派生生成） | 実績・型推論・エコシステム |
| ルーター | Hono内包 | エッジ対応・RPC・middleware互換 |

---

## 名前について

**Nanoka（七日）**

- 「七日」= 週休7日制の楽園という元コンセプトから直接導出
- Honoが日本語由来（炎）であることとの世界観の統一
- npmパッケージ名として現時点で未取得、確認済み
- 5文字で打ちやすい（パッケージ名は `@nanokajs/core` として npm に publish）

---

## なぜ今か

- Cloudflare Workersの普及が加速（2024年に開発者300万人、前年比50%増）
- CF Workers + D1の組み合わせが成熟したのが2024〜2025年。統合レイヤーを作る前提条件がやっと揃った
- `Hono + Drizzle + Zod` の組み合わせが「デファクト」になりつつあるが、それを束ねる薄い体験レイヤーの空白はまだ残っている

---

## 既知のリスクと対策

| リスク | 対策 |
|---|---|
| DB層とAPI層の責務衝突 | 「唯一の真実」はDB寄りに限定。APIバリデーションは派生で明示的に調整 |
| マイグレーション事故 | 独自diffエンジンを持たない。Drizzle Kit / Wranglerの流儀に完全委譲 |
| D1ロックイン | adapter層を初期設計に含める |
| 長期的な抽象の重さ | 素のDrizzleへのescape hatchを常に開けておく |
| relation設計の複雑さ | MVPスコープから除外。必要なら手書きDrizzleで対応 |
| `findMany`のデフォルト安全性 | limit必須・デフォルト20件。limitなしは型エラー |
| スコープ肥大化 | 「やらないこと」リストを公開し、IssueよりもPRを優先する運営方針 |
| 依存ライブラリのbreaking change | Drizzle・Hono・Zodのメジャーアップは即対応。薄いラッパーゆえ追従コストは低い |
