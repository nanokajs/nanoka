# Phase 1 実装計画

`docs/nanoka.md` の Phase 1（MVP）を完走させるための作業計画。中断・再開を前提に、各マイルストーンを独立した完了可能単位として設計している。

進捗が変わったら本ファイルのチェックボックスを更新する。新規セッション開始時はまず本ファイルを読み、未完了の最初のマイルストーンから着手する。

---

## 現状

- **M0: スキャフォールディング完了**
- `pnpm install` と `pnpm -C packages/nanoka build` が通る
- 次の着手対象は **M1: フィールド DSL（`t`）**

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

---

## 確定済み設計判断

すべて推奨案を採用。`docs/nanoka.md` の load-bearing rule（CLAUDE.md 参照）と整合している。

1. **ランタイム Drizzle テーブルは自前構築**
   `app.model()` がフィールド DSL から `sqliteTable(...)` を直接組み立てる。`nanoka generate` の出力ファイルは drizzle-kit 専用で、ランタイムからは import しない。runtime と codegen を分離する。

2. **`findMany` の `limit` は型で強制**
   引数型を `{ limit: number; offset?: number; orderBy?: ... }` 固定とし、`limit` 省略はコンパイルエラー。実行時のデフォルト値はライブラリでは持たず、サンプルコード側で示す。

3. **pnpm workspace 構成**
   `packages/nanoka`（本体ライブラリ + CLI bin）と `examples/basic`（動作確認用ミニアプリ）の 2 ワークスペース。CI もこの 2 つを対象にする。

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

- [ ] フィールド型: `string` / `uuid` / `number` / `integer` / `boolean` / `timestamp` / `json`
- [ ] 修飾子: `.primary()` / `.unique()` / `.optional()` / `.default(...)` / `.email()` / `.min()` / `.max()`
- [ ] 内部統一インターフェース: 各フィールドが `{ drizzleColumn(name): Column, zodBase: ZodType, tsType }` を返す
- [ ] 単体テスト: 型推論と Zod / Drizzle 出力の整合

完了基準: `t.string().email().optional()` のような連結が型と runtime 両方で正しく振る舞う。

### M2: モデル派生（`schema` / `validator`）

- [ ] `model.schema({ pick?, omit?, partial? })` → Zod スキーマ
- [ ] `model.validator(target, opts)` → Hono validator（`@hono/zod-validator` 経由）
- [ ] **`schema` と `validator` を別メソッドとして保つ**（load-bearing rule #5）
- [ ] `pick` / `omit` は文字列配列のみ（フィールドアクセサ形式は Phase 2）
- [ ] 単体テスト: `omit: ['passwordHash']` / `partial: true` / `pick` 各パターン

完了基準: spec 例（`User.validator('json', { omit: ['passwordHash'] })` など）がそのまま動く。

### M3: Adapter 層

- [ ] `Adapter` interface 定義: `{ drizzle: DrizzleDatabase, batch(...): Promise<...> }`
- [ ] `d1Adapter(env.DB)` 実装
- [ ] core の query path は `Adapter` のみ参照する（`D1Database` 型を core に出さない、rule #3）
- [ ] adapter のモック / インメモリ実装でテスト可能にする

完了基準: D1 binding を直接触る箇所が `d1Adapter` 内に閉じている。

### M4: CRUD クエリ

- [ ] `findMany({ limit, offset?, orderBy? })`（limit 型必須）
- [ ] `findOne(idOrWhere)`
- [ ] `create(data)`
- [ ] `update(idOrWhere, data)`
- [ ] `delete(idOrWhere)`
- [ ] `where` はオブジェクト形式（アクセサ形式は Phase 2）
- [ ] すべて adapter 経由で素の Drizzle を呼ぶ薄さに留める
- [ ] 結合テスト: vitest-pool-workers の D1 で各メソッド

完了基準: `findMany()`（引数なし）が型エラーになり、`findMany({ limit: 20 })` が動く。

### M5: `nanoka()` ルーター

- [ ] `nanoka()` が Hono インスタンスを拡張して返す
- [ ] `app.model(name, fields)` がモデル登録 + テーブル構築
- [ ] `app.db` で素の Drizzle を露出（rule #4 の escape hatch）
- [ ] `app.batch(...)` で D1 batch をそのまま公開（独自抽象を作らない、rule #7）
- [ ] エラーは Hono の `HTTPException` のまま（rule #2、独自エラー型を作らない）
- [ ] `app.fetch` が Workers handler としてそのまま使える

完了基準: spec の `app.get('/users', ...)` 例コードが動く。

### M6: スキーマ生成器（`nanoka generate`）

- [ ] 純関数: `(models[]) => string`（Drizzle schema TS のソース）
- [ ] CLI: `nanoka.config.ts` を読み込み `drizzle/schema.ts` を書き出す
- [ ] diff / SQL / 適用には一切踏み込まない（rule #1）
- [ ] snapshot test で出力を固定
- [ ] `package.json` の `bin` に `nanoka` を登録

完了基準: `npx nanoka generate` で Drizzle schema ファイルが生成され、`drizzle-kit generate` がそれを読める。

### M7: 動作確認（`examples/basic`）

- [ ] User モデルの最小 CRUD API
- [ ] `wrangler.toml` の D1 binding 設定
- [ ] フロー手動検証: `nanoka generate` → `drizzle-kit generate` → `wrangler d1 migrations apply --local` → `wrangler dev`
- [ ] vitest-pool-workers での E2E 結合テスト
- [ ] フロー全体を README にコマンド付きで記録

完了基準: `pnpm -C examples/basic dev` で起動し、curl で CRUD 全部が通る。

### M8: README / migration ガイド

- [ ] `packages/nanoka/README.md`: Quickstart（3 コマンドで動かす）
- [ ] migration フロー図解（Nanoka と drizzle-kit / wrangler の分界線を明示）
- [ ] escape hatch のコード例
- [ ] 「Phase 1 でやらないこと」の明記（relation / フィールドアクセサ / OpenAPI 等）

完了基準: README だけ読んで第三者が `examples/basic` 相当を再現できる。

---

## Phase 2 に漏らさないリスト

実装中に手が伸びやすいので注意。手が伸びたらこの計画書に立ち戻る。

- `t.hasMany()` / `t.belongsTo()` → Phase 2
- `User.where(f => ...)` 形式（フィールドアクセサ）→ Phase 2
- OpenAPI 自動生成 → Phase 2
- Turso / libSQL adapter → Phase 2
- `npx create-nanoka-app` → Phase 3
- 認証 / フルスタック React / 複雑な query DSL → 全 Phase でスコープ外

---

## 着手前チェック（再開時用）

新規セッションで本計画から再開する場合、以下を確認：

1. `git status` と `git log` で前回の到達点を把握
2. 本ファイルのチェックボックスと実コードの差分を照合（チェックが正しいか）
3. 直近完了マイルストーンの「完了基準」を実行して回帰を検出
4. 次の未完了マイルストーンに着手
