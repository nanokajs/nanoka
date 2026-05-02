# Phase 1 実装計画

`docs/nanoka.md` の Phase 1（MVP）を完走させるための作業計画。中断・再開を前提に、各マイルストーンを独立した完了可能単位として設計している。

進捗が変わったら本ファイルのチェックボックスを更新する。新規セッション開始時はまず本ファイルを読み、未完了の最初のマイルストーンから着手する。

---

## 現状

- **M0: スキャフォールディング完了**
- **M1: フィールド DSL（`t`）完了**
- **M2: モデル派生（`schema` / `validator`）完了**
- **M3: Adapter 層完了**
- **M4: CRUD クエリ完了**
- **M5: `nanoka()` ルーター完了**
- **M6: スキーマ生成器（`nanoka generate`）完了**
- **M7: 動作確認（`examples/basic`）完了**
- **M8: README / migration ガイド + publish-ready 化完了**（2026-05-02）
- `pnpm install` / `pnpm -C packages/nanoka build` / `pnpm -C packages/nanoka test` / `pnpm -C packages/nanoka typecheck` / `pnpm -C examples/basic typecheck` / `pnpm -C examples/basic test` / `pnpm -C packages/nanoka publish --dry-run` がすべて通る
- **Phase 1 実装完了。GitHub URL 確定後に `pnpm -C packages/nanoka publish` で npm registry へリリース可能な状態。**

---

## 既知の受容リスク

### M0 時点 (2026-05-01)

- **`undici@5.29.0` の High 2 件 (GHSA-vrm6-8vpv-qv8q / GHSA-v9p9-hfj2-hcw8)**
  - 経路: `@cloudflare/vitest-pool-workers@0.5.x` → `miniflare@3.x` → `undici@5.29.0`
  - 影響範囲: vitest 実行時の miniflare 内部のみ（dev / CI 環境限定）
  - 本番 Cloudflare Workers ランタイムは独自 fetch 実装を使用し undici を含まないため影響なし
  - `undici >=6.24.0` への引き上げは miniflare@3.x が `markAsUncloneable` 等の API 差異で起動不可
  - **見直し条件**: `@cloudflare/vitest-pool-workers` か `miniflare` が undici@6 系に対応した時点で再評価。M3（adapter 層）/ M4（CRUD クエリ）で D1 binding テストを書くタイミングが自然なリビジット契機。
  - その他の Major 指摘 (CVE-2026-39356 drizzle-orm SQLi / GHSA-36p8-mvp6-cv38 wrangler / devalue prototype pollution) は対応済み（drizzle-orm `^0.45.2` 引き上げ + `pnpm.overrides` で wrangler `>=3.114.17`, devalue `>=5.6.4`）

### M3 リビジット時点 (2026-05-02)

- **undici@5.29.0**: 状況変化なし。`@cloudflare/vitest-pool-workers@0.5.41` / `miniflare@3.20241230.0` も依然 undici@5.29.0 に固定。本番 Workers ランタイムは undici を含まないため影響なし継続。次回リビジット契機は M4（CRUD クエリの結合テスト追加時）。
- **devDep transitive の moderate**: `esbuild@0.17.19` / `vite@5.4.21` の moderate 警告あり。tsup 経由のビルド成果物（ESM）には乗らないため本番影響なし。受容。
- **`tsconfig.json` の `__tests__` 包含**: `declare module 'cloudflare:test'` がライブラリ実装側 typecheck にも適用されるが、`dist/index.d.ts` への漏洩はなし（tsup の entry-only 解析で剥がれる）。M5/M6 で `tsconfig.build.json` 分離を再検討。

## M4 着手時に再確認すべきセキュリティ観点（M3 review より）

M4（CRUD クエリ）実装時、最初に以下を設計に組み込むこと:

- **識別子インジェクション**: `orderBy` でカラム名を文字列受けする場合、許可リスト or 型レベル絞り込みが必須。drizzle のパラメタライズドは値のみで、識別子は守らない。
- **`sql.raw()` の警告**: `app.db` escape hatch で raw Drizzle を使う際、`sql\`${value}\``（安全 = parametrized binding）と `sql.raw(${userInput})`（危険 = 文字列補間）の境界を README / JSDoc で明示。
- **`limit` / `offset` の現実的範囲**: number 型強制だけでは不十分。NaN/Infinity 対策と上限 cap（例 `z.number().int().min(0).max(100)`）を Zod 側で required に。
- **`batch` の不変条件**: `BatchItem<'sqlite'>` = `RunnableQuery<any, 'sqlite'>` で生 SQL 文字列が型として受理されない設計を維持。`BatchItem` の型を弱めない。
- **drizzle-orm/d1 の binding 保持**: `drizzle(d1)` は `db.$client` に D1 binding を保持するため、複数 binding を扱う場合 `d1Adapter(d1)` を都度呼ぶ（戻り値を永続キャッシュしない）。

---

## 確定済み設計判断

すべて推奨案を採用。`docs/nanoka.md` の load-bearing rule（CLAUDE.md 参照）と整合している。

1. **ランタイム Drizzle テーブルは自前構築**
   `app.model()` がフィールド DSL から `sqliteTable(...)` を直接組み立てる。`nanoka generate` の出力ファイルは drizzle-kit 専用で、ランタイムからは import しない。runtime と codegen を分離する。

2. **`findMany` の `limit` は型で強制**
   引数型を `{ limit: number; offset?: number; orderBy?: ... }` 固定とし、`limit` 省略はコンパイルエラー。実行時のデフォルト値はライブラリでは持たず、サンプルコード側で示す。

3. **pnpm workspace 構成**
   `packages/nanoka`（本体ライブラリ + CLI bin）と `examples/basic`（動作確認用ミニアプリ）の 2 ワークスペース。CI もこの 2 つを対象にする。

4. **`d1Adapter` の引数型は `D1Database` を直接受け取る（rule #3 の対象外）**
   load-bearing rule #3「`D1Database` 型を core の query path に漏らさない」は **モデル / クエリ / ルーター** の core path を対象とする制約であり、**adapter ファクトリ自体は D1 を知ってよい**。`d1Adapter(d1: D1Database)` の引数型として `dist/index.d.ts` に `D1Database` が現れるが、これは設計上やむを得ない（structural type に弱めると型安全性が失われ、Workers 利用者にも追加負担になる）。利用者の型解決は `peerDependencies: @cloudflare/workers-types` で担保する。Phase 2 で Turso adapter を追加した際も同様の方針（`tursoAdapter(client: Client)` のように専用型を引数に取る）でよい。

---

## マイルストーン

### M0: スキャフォールディング

- [x] `pnpm-workspace.yaml` と root `package.json` 作成
- [x] `packages/nanoka/` 配下に `package.json` / `tsconfig.json`
- [x] `examples/basic/` 配下に `package.json` / `wrangler.toml` の雛形
- [x] TypeScript 設定: strict / ES2022 / `moduleResolution: bundler`
- [x] `tsup` で ESM ビルド設定
- [x] `vitest` + `@cloudflare/vitest-pool-workers` を導入
- [x] Biome（lint + format）導入
- [x] peer dependencies: `hono` / `drizzle-orm` / `zod`
- [x] internal: `@hono/zod-validator`
- [x] `.gitignore` 整備（`node_modules` / `dist` / `.wrangler` / `.dev.vars` 等）
- [x] CLAUDE.md の `## Commands` セクションを実コマンドで更新

完了基準: `pnpm install` と `pnpm -C packages/nanoka build` が通る。

### M1: フィールド DSL（`t`）

- [x] フィールド型: `string` / `uuid` / `number` / `integer` / `boolean` / `timestamp` / `json`
- [x] 修飾子: `.primary()` / `.unique()` / `.optional()` / `.default(...)` / `.email()` / `.min()` / `.max()`
- [x] 内部統一インターフェース: 各フィールドが `{ drizzleColumn(name): Column, zodBase: ZodType, tsType }` を返す
- [x] 単体テスト: 型推論と Zod / Drizzle 出力の整合

完了基準: `t.string().email().optional()` のような連結が型と runtime 両方で正しく振る舞う。

### M2: モデル派生（`schema` / `validator`）

- [x] `model.schema({ pick?, omit?, partial? })` → Zod スキーマ
- [x] `model.validator(target, opts)` → Hono validator（`@hono/zod-validator` 経由）
- [x] **`schema` と `validator` を別メソッドとして保つ**（load-bearing rule #5）
- [x] `pick` / `omit` は文字列配列のみ（フィールドアクセサ形式は Phase 2）
- [x] 単体テスト: `omit: ['passwordHash']` / `partial: true` / `pick` 各パターン

完了基準: spec 例（`User.validator('json', { omit: ['passwordHash'] })` など）がそのまま動く。

### M3: Adapter 層

- [x] `Adapter` interface 定義: `{ drizzle: DrizzleDatabase, batch(...): Promise<...> }`
- [x] `d1Adapter(env.DB)` 実装
- [x] core の query path は `Adapter` のみ参照する（`D1Database` 型を core に出さない、rule #3）
- [x] adapter のモック / インメモリ実装でテスト可能にする

完了基準: D1 binding を直接触る箇所が `d1Adapter` 内に閉じている。

### M4: CRUD クエリ

- [x] `findMany({ limit, offset?, orderBy? })`（limit 型必須）
- [x] `findOne(idOrWhere)`
- [x] `create(data)`
- [x] `update(idOrWhere, data)`
- [x] `delete(idOrWhere)`
- [x] `where` はオブジェクト形式（アクセサ形式は Phase 2）
- [x] すべて adapter 経由で素の Drizzle を呼ぶ薄さに留める
- [x] 結合テスト: vitest-pool-workers の D1 で各メソッド
- [x] **M4 再 review（2026-05-02）**: Minor 2 修正完了（エラーメッセージのフィールド名露出を固定文言に統一）
- [x] **M4 セキュリティレビュー修正（2026-05-02）**: Major 1 件修正（`in` 演算子を `Object.hasOwn()` に置換）・テスト追加（prototype pollution ケース 2 件）

完了基準: `findMany()`（引数なし）が型エラーになり、`findMany({ limit: 20 })` が動く。

### M4 セキュリティレビューより M5 着手時に注意すべき観点（2026-05-02）

M5（`nanoka()` ルーター）でハンドラ実装の例コード / README を書く際、以下を必ず守る・推奨パターンとして明示する:

- **`c.req.json()` を `User.create` / `User.update` に直渡し禁止**: 必ず `validator('json', { omit: [...] })` を通して `c.req.valid('json')` を使う。生 body を渡すと mass assignment（攻撃者が DB スキーマの全列を埋められる）と prototype pollution の経路が開く。
- **`c.req.query()` / `c.req.param()` を where に直渡し禁止**: クエリ文字列はオブジェクト形状を持たないが、Hono が prototype-chain key を own property として解釈する経路がないか個別に検証する。整数 PK は必ず `Number()` + Zod 検証。
- **レスポンスの機密フィールド除外**: `c.json(user)` ではなく `c.json(User.schema({ omit: ['passwordHash'] }).parse(user))` のような明示的フィルタを推奨パターンとして示す。`passwordHash` 等のレスポンス漏洩はライブラリ側では守らない（"80% automatic, 20% explicit" 思想）。
- **`app.onError` の実装**: production 環境で `HTTPException(500)` のスタックトレースを body に出さない。

### M5: `nanoka()` ルーター

- [x] `nanoka()` が Hono インスタンスを拡張して返す
- [x] `app.model(name, fields)` がモデル登録 + テーブル構築
- [x] `app.db` で素の Drizzle を露出（rule #4 の escape hatch）
- [x] `app.batch(...)` で D1 batch をそのまま公開（独自抽象を作らない、rule #7）
- [x] エラーは Hono の `HTTPException` のまま（rule #2、独自エラー型を作らない）
- [x] `app.fetch` が Workers handler としてそのまま使える
- [x] **M2 持ち越し（型精緻化）**: 以下の 3 点を一括で解決する。
  - [x] `Model.validator()` の戻り型を `MiddlewareHandler<any, any, any>` から精緻型へ。`zValidator` の `MiddlewareHandler<E, P, { in: { [T in Target]: z.input<Apply<...>> }, out: { [T in Target]: z.output<Apply<...>> } }>` を透過させ、ハンドラ側の `c.req.valid(target)` の型が `Apply` 後の shape に揃うようにする。
  - [x] `FieldsToZodShape<Fields>` の型が `ZodTypeAny` に潰れる問題を解決する。`Fields[K] extends Field<any, any, any> ? Fields[K]['zodBase'] : never` の制約式が第 3 generic `ZB` を `any` に解消するため、`zodBase` から具体的な `z.ZodType<TS, ..., InputTS>` が取り出せていない可能性がある。`schema()` の戻り値の `z.infer` 型が `Record<string, unknown>` 相当になっていないか型レベルで再検証し、必要に応じて制約式を見直す。
  - [x] `validator.test.ts` の `[TODO:M5]` プレフィックス付きテストを `@ts-expect-error` で `passwordHash` の排除を検証する形に書き直す。
  - 経緯: M2 では implementer が「Hono の generic 仕様が複雑で困難」と判断し据え置き。M5 でルーター本体を組む際に併せて解決する。

完了基準: spec の `app.get('/users', ...)` 例コードが動く。

### M5 完了時の持ち越し（M8 で対処）

- **`docs/nanoka.md` の Quickstart 表記**: spec 例の `const app = nanoka()` は引数なし表記だが、Phase 1 実装は `nanoka(d1Adapter(env.DB))` 形（プラン採用案A）。M8 README 作業時に spec 表記との差を明示するか、`docs/nanoka.md` 本文を実装に合わせて更新する。
  - **M8 で対処済み**: `docs/nanoka.md` L61 に `d1Adapter` を import に追加、L63 を `const app = nanoka(d1Adapter(env.DB))` に修正。L60-92 全体の矛盾確認完了。

### M6: スキーマ生成器（`nanoka generate`）

- [x] 純関数: `(models[]) => string`（Drizzle schema TS のソース）
- [x] CLI: `nanoka.config.ts` を読み込み `drizzle/schema.ts` を書き出す
- [x] diff / SQL / 適用には一切踏み込まない（rule #1）
- [x] snapshot test で出力を固定
- [x] `package.json` の `bin` に `nanoka` を登録

完了基準: `npx nanoka generate` で Drizzle schema ファイルが生成され、`drizzle-kit generate` がそれを読める。

### M7: 動作確認（`examples/basic`）

- [x] User モデルの最小 CRUD API
- [x] `wrangler.toml` の D1 binding 設定
- [x] フロー手動検証: `nanoka generate` → `drizzle-kit generate` → `wrangler d1 migrations apply --local` → `wrangler dev`
- [x] vitest-pool-workers での E2E 結合テスト
- [x] フロー全体を README にコマンド付きで記録

完了基準: `pnpm -C examples/basic dev` で起動し、curl で CRUD 全部が通る。

### M7 完了時の持ち越し

- **`nanoka()` の Bindings generic 対応（小タスク・M8 直前 or 直後で実施）**: 現状 `Nanoka extends Hono`（generic なし）のため、ハンドラ内で `c.env` の型が解決できず `examples/basic/src/index.ts:22` の `(c.env as Env)` キャストが必要になっている。`Nanoka<E extends Env = BlankEnv> extends Hono<E>` / `nanoka<E extends Env = BlankEnv>(adapter): Nanoka<E>` に変更すれば、利用側で `nanoka<{ Bindings: Env }>(...)` と書けて `c.env` が型推論される。実装は `packages/nanoka/src/router/types.ts` と `packages/nanoka/src/router/nanoka.ts` の 2 ファイルで完結し、後方互換（既存呼び出し `nanoka(adapter)` は `BlankEnv` にデフォルト解決）。M5 で精緻化したチェイン型推論との回帰確認を併せて行う。
- **`examples/basic/test/e2e.test.ts` の seed データ投入を `User.create` 経由に**: 現状は生 SQL `INSERT INTO users` で列順依存。テーブル変更に脆い。implementation review M7 再レビューの Minor #2。優先度低い。
- **`User.validator()` のエラーハンドリング例（M8 で対処）**: M7 セキュリティレビュー Minor #3。Hono の `@hono/zod-validator` がデフォルトで Zod の `issues` 配列をそのまま 400 で返す挙動により、API スキーマの内部構造（フィールド名・型・omit 後の shape）が attacker reconnaissance に利用可能。M8 README で `User.validator(target, opts, hook)` を使い `issues` を握りつぶした 400 を返す利用例を示す。または `app.onError` で ZodError を捕まえて固定文言に置き換えるパターンを併記する。Phase 1 ライブラリ本体には変更を入れない。
  - **M8 で対処済み**: `packages/nanoka/README.md` の「Error handling」セクションに両パターン（`app.onError` hook と `validator` hook）を記載。

### M8: README / migration ガイド + publish-ready 化

M8 のスコープを拡張: 「README だけ読んで第三者が再現できる」ことに加え、`pnpm publish` 直前まで進められる状態（メタデータ・ライセンス・バージョン）に持っていく。

#### ドキュメント

- [x] `packages/nanoka/README.md`: Quickstart（3 コマンドで動かす）
- [x] migration フロー図解（Nanoka と drizzle-kit / wrangler の分界線を明示）
- [x] escape hatch のコード例
- [x] 「Phase 1 でやらないこと」の明記（relation / フィールドアクセサ / OpenAPI 等）
- [x] M7 セキュリティ持ち越し Minor #3 への対応: `User.validator()` の hook で Zod `issues` を固定文言に置き換える利用例、または `app.onError` で `ZodError` を捕まえる例のいずれかを README に記載

#### ライセンス

- [x] リポジトリルートに `LICENSE` ファイルを作成（**MIT** 採用）。Copyright 表記は `Copyright (c) 2026 Eiichiro Iriguchi`
- [x] `packages/nanoka/package.json` の `license` フィールドに `"MIT"` を追加
- [x] LICENSE は `packages/nanoka/` 配下にも置くか、`files: ["dist", "LICENSE"]` でリポジトリルートのコピーを公開対象に含めるかを決定（npm の慣行に従い、package 内に同梱）

#### `packages/nanoka/package.json` メタデータ整備

- [x] `version`: `0.0.0` → `0.1.0` に bump（Phase 1 完了時点の API 安定線）
- [x] `description`: 一行説明（例: `"Thin wrapper over Hono + Drizzle + Zod for Cloudflare Workers + D1. 80% automatic, 20% explicit."`）
- [x] `author`: `"Eiichiro Iriguchi <eiichiro_iriguchi@a-1ro.dev>"`
- [x] `keywords`: `["hono", "drizzle", "zod", "cloudflare-workers", "d1", "orm", "validation"]` 程度（npm 検索ヒット用）
- [x] `repository` / `homepage` / `bugs`: URL 確定済み（`https://github.com/A-1ro/nanoka.git`）。M8 で package.json に追加済み
- [x] `engines`: `{ "node": ">=20" }`（Cloudflare Workers の Node 互換ターゲット相当）
- [x] `prepublishOnly` スクリプト: `"pnpm build && pnpm test && pnpm typecheck"`（dist の取りこぼしと回帰を防ぐ）
- [x] `sideEffects`: `false`（tree-shaking の最適化情報。現在のコードに副作用 import がないことを確認のうえ宣言）

#### Publish 直前チェック（README または別ファイルに記録）

- [x] `pnpm publish --dry-run` の出力を確認し、`dist/` と `LICENSE` のみが含まれ、`src/` / `test/` / `node_modules/` が含まれないことを確認
- [x] npm registry 上で `nanoka` パッケージ名が空きであることを確認（占有されていれば scope 付き `@<scope>/nanoka` への変更を判断）
- [x] `repository` / `homepage` / `bugs` フィールドを GitHub URL で埋める（対応済み（M8））

完了基準:
1. README だけ読んで第三者が `examples/basic` 相当を再現できる
2. `pnpm -C packages/nanoka publish --dry-run` がエラーなく完了し、含まれるファイル一覧が想定通り（`dist/` + `LICENSE` + `package.json` + `README.md`）
3. `version: 0.1.0`, `license: "MIT"`, `description`, `author`, `keywords`, `engines`, `prepublishOnly`, `sideEffects` が `package.json` に揃っている

---

## Phase 2 に漏らさないリスト

実装中に手が伸びやすいので注意。手が伸びたらこの計画書に立ち戻る。

- `t.hasMany()` / `t.belongsTo()` → Phase 2
- `User.where(f => ...)` 形式（フィールドアクセサ）→ Phase 2
- OpenAPI 自動生成 → Phase 2
- Turso / libSQL adapter → Phase 2
- `t.json(zodSchema)` 形式の引数化（現状 `t.json()` は `z.unknown()` で runtime 検証なし。security review M-1） → Phase 2 で検討
- `npx create-nanoka-app` → Phase 3
- 認証 / フルスタック React / 複雑な query DSL → 全 Phase でスコープ外

---

## 着手前チェック（再開時用）

新規セッションで本計画から再開する場合、以下を確認：

1. `git status` と `git log` で前回の到達点を把握
2. 本ファイルのチェックボックスと実コードの差分を照合（チェックが正しいか）
3. 直近完了マイルストーンの「完了基準」を実行して回帰を検出
4. 次の未完了マイルストーンに着手
