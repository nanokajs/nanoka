# Backlog

`docs/phase1-plan.md` で記録した Phase 1（M0〜M8）は完了済み。`@nanokajs/core` を npm registry に公開済み。

このファイルは Phase 1 完了後の残課題を集約する。新しい課題を追加するときは該当セクションに節として追記し、解消したら該当節を削除（または `~~取り消し線~~` で残す）するか、`docs/phase1-plan.md` のような完了履歴ドキュメントへ移す。

---

## 1. Phase 1 内の持ち越し

`docs/phase1-plan.md` の M7 完了時持ち越しセクションから移管。

### 1.1 `Nanoka<E extends Env>` Bindings generic 対応

- **概要**: 現状 `Nanoka extends Hono`（generic なし）のため、ハンドラ内で `c.env` の型が解決できず `examples/basic/src/index.ts:22` で `(c.env as Env)` キャストが必要になっている。
- **修正方針**: `Nanoka<E extends Env = BlankEnv> extends Hono<E>` / `nanoka<E extends Env = BlankEnv>(adapter): Nanoka<E>` に変更すれば、利用側で `nanoka<{ Bindings: Env }>(...)` と書けて `c.env` が型推論される。
- **修正範囲**: `packages/nanoka/src/router/types.ts` と `packages/nanoka/src/router/nanoka.ts` の 2 ファイルで完結。
- **後方互換**: 既存呼び出し `nanoka(adapter)` は `BlankEnv` にデフォルト解決されるため破壊的変更なし。
- **回帰確認ポイント**: M5 で精緻化したチェイン型推論（`Model.validator` の戻り型）と新 generic が干渉しないか。
- **工数**: 小。

### 1.2 `examples/basic/test/e2e.test.ts` の seed を `User.create` 経由に

- **概要**: 現状 seed データ投入は生 SQL `INSERT INTO users` で列順依存。テーブル変更時に脆い。
- **修正方針**: `User.create` 経由に書き換え、列順依存を排除。
- **優先度**: 低。実害は出ていない。

---

## 2. 既知の受容リスク

`docs/phase1-plan.md` の「既知の受容リスク」セクションから移管。状況に変化があれば該当節を更新。

### 2.1 `undici@5.29.0` High 2 件 (GHSA-vrm6-8vpv-qv8q / GHSA-v9p9-hfj2-hcw8)

- **経路**: `@cloudflare/vitest-pool-workers@0.5.x` → `miniflare@3.x` → `undici@5.29.0`
- **影響範囲**: vitest 実行時の miniflare 内部のみ（dev / CI 環境限定）。
- **本番影響**: なし。Cloudflare Workers ランタイムは独自 fetch 実装を使用し undici を含まない。
- **見直し条件**: `@cloudflare/vitest-pool-workers` または `miniflare` が undici@6 系に対応した時点で再評価。
- **対応不可の理由**: `undici >=6.24.0` への直接引き上げは miniflare@3.x が `markAsUncloneable` 等の API 差異で起動不可。

### 2.2 devDep transitive moderate (`esbuild@0.17.19` / `vite@5.4.21`)

- **影響範囲**: tsup 経由のビルド成果物（ESM）には乗らない。本番影響なし。
- **対応**: 受容。アップストリーム更新を待つ。

### 2.3 `tsconfig.json` の `__tests__` 包含

- **影響**: `declare module 'cloudflare:test'` がライブラリ実装側 typecheck にも適用されるが、`dist/index.d.ts` への漏洩はなし（tsup の entry-only 解析で剥がれる）。
- **対応**: 必要なら `tsconfig.build.json` 分離を検討。

---

## 3. Phase 2 候補

`docs/nanoka.md` で Phase 2 として明示的に切り出している機能。Phase 2 着手時は本セクションを `docs/phase2-plan.md` に展開する。

- **Relations** (`t.hasMany()` / `t.belongsTo()`)
- **フィールドアクセサ API** (`{ pick: f => [f.name] }` / `User.where(f => eq(f.email, x))`)
  - 制約: `f` は `as const` の固定オブジェクトとし、Proxy にしない（runtime コスト ゼロ要件）
- **OpenAPI 自動生成**
- **Turso / libSQL adapter**
- **`t.json(zodSchema)` の引数化**: 現状 `t.json()` は `z.unknown()` で runtime 検証なし（M-1 review 指摘）
- **Zod 4 サポート**: 現状 `peerDependencies.zod: ^3.23.0`。v4 は `ZodType<Output, Def, Input>` → `ZodType<Output, Input, Internals>` に generic 順序が変わり、`packages/nanoka/src/field/factories.ts` 各 builder の `ZB extends z.ZodType<TS, z.ZodTypeDef, TS>` 制約が壊れる。結果として `Field<TS, Mods, ZB>` 由来の `InferFieldType` 条件型分岐が `never` に潰れ、`User.create({...})` で「string は undefined に代入できない」型エラーが発生する（2026-05 ユーザー報告）。対応方針:
  1. `peerDependencies.zod` を `^3.23.0 || ^4.0.0` に広げ、両対応する型シグネチャに書き換える
  2. または v4 に切り替えて v3 を切る（破壊的変更）
  - 着手時に判断。あわせて CI に「公開後パッケージを空プロジェクトに `pnpm add` して `tsc --noEmit`」する peer-dep 整合 E2E を追加（workspace 内テストでは見えない種類の不整合だった）
- **`npx create-nanoka-app`**（Phase 3）

### 全 Phase でスコープ外

- 認証 / フルスタック React / 複雑な query DSL

---

## 4. 運用・インフラ

### 4.1 CI/CD セットアップ

- **現状**: 手動 publish。
- **方針案**: GitHub Actions で `main` への push 時に build/test/typecheck を回す + tag push (`v*`) で `pnpm publish` 自動化。`prepublishOnly` が ローカルで実行されるのは保険として残す。
- **要検討**: npm 2FA 有効時の自動化方法（`NPM_TOKEN` での publish or trusted publisher / OIDC）。

### 4.2 `nanokajs/nanoka` リポジトリ整備

- branch protection ルール（main への直 push 禁止 / PR 必須 / CI green 必須）
- Issue / PR テンプレート
- Discussions 有効化
- `CODEOWNERS`

### 4.3 CONTRIBUTING.md

- `prepublishOnly` が pnpm 直書きであることの明記
- 開発フロー（pnpm install / build / test / lint）
- リリース手順（version bump / publish）

### 4.4 LICENSE 二重配置の同期

- リポジトリルートと `packages/nanoka/LICENSE` が同一内容で配置されている。
- Copyright 年が更新されたとき、両方を同時に更新する必要がある。CI で diff チェックする手もある。

### 4.5 README の相対リンク

- `packages/nanoka/README.md` に `../../examples/basic` への相対リンクが残っている。
- npm registry 上では解決されない（GitHub 上では解決される）。注記は README 内の Release checklist に記載済み。
- 改善案: GitHub 絶対 URL (`https://github.com/nanokajs/nanoka/blob/main/examples/basic/README.md`) に書き換える。

### 4.6 `docs/phase1-plan.md` のクリーンアップ（任意）

- 現状の Phase 1 完了履歴 + 持ち越し情報 + 受容リスクが混在している。
- 持ち越し・受容リスクは本ファイル（`docs/backlog.md`）に移管済みなので、`docs/phase1-plan.md` は履歴アーカイブとして固定し、本ファイルへ誘導する形に整理しても良い。
- 優先度: 低。
