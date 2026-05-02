# Phase 1.5 実装計画

Phase 1（M0〜M8）の完了後、Phase 2（API境界 / フィールドポリシー / フィールドアクセサ / OpenAPI seed 等）に着手する前に、**公開ライブラリとしての運用基盤・型改善・onboarding 体験の穴**を埋めるためのフェーズ。`docs/backlog.md` の §1（Phase 1 内の持ち越し）と §4（運用・インフラ）をマイルストーンに整理したもの。

- 受容リスク（`docs/backlog.md` §2）は本フェーズ対象外。
- Phase 2 候補（`docs/backlog.md` §3）は本フェーズ対象外。
- 進捗が変わったら本ファイルのチェックボックスを更新する。新規セッション開始時はまず本ファイルを読み、未完了の最初のマイルストーンから着手する。

---

## ゴール

1. README どおりに第三者が `pnpm create hono@latest` から始めて Nanoka を導入できることが CI で保証される（onboarding parity）
2. PR 単位で build/test/typecheck/lint が回り、tag push で publish できる CI/CD 基盤
3. 現状の `(c.env as Env)` キャストなど、Phase 1 で残した型の角を取る

---

## マイルストーン

### M1: 型・テストの持ち越し解消

- [x] **1.1** `Nanoka<E extends Env = BlankEnv> extends Hono<E>` 対応
  - 修正範囲: `packages/nanoka/src/router/types.ts` / `packages/nanoka/src/router/nanoka.ts` の 2 ファイル
  - 利用側で `nanoka<{ Bindings: Env }>(d1Adapter(env.DB))` と書けて `c.env` が型推論される
  - 既存呼び出し（generic 省略）は `BlankEnv` にデフォルト解決されるため破壊的変更なし
  - 回帰確認: M5 で精緻化したチェイン型推論（`Model.validator` の戻り型透過）と新 generic が干渉しないか
  - `examples/basic/src/index.ts:22` の `(c.env as Env)` キャストを除去
- [x] **1.2** `examples/basic/test/e2e.test.ts` の seed を `User.create` 経由に書き換え
  - 現状は生 SQL `INSERT INTO users` で列順依存。テーブル変更時に脆い
  - 優先度低（実害は出ていない）

完了基準: `pnpm -C packages/nanoka typecheck` / `pnpm -C examples/basic typecheck` / `pnpm -C examples/basic test` がすべて通り、`(c.env as Env)` キャストが消える。

### M2: ドキュメント整備

- [x] **4.5** `packages/nanoka/README.md` の `../../examples/basic` 相対リンクを GitHub 絶対 URL に置換
  - 置換先: `https://github.com/nanokajs/nanoka/blob/main/examples/basic/README.md`
  - 動機: npm registry 上では相対リンクが解決されない
- [x] **4.3** `CONTRIBUTING.md` を新規作成（リポジトリルート）
  - 開発フロー（pnpm install / build / test / lint / typecheck）
  - リリース手順（version bump / `prepublishOnly` 経由の publish）
  - `prepublishOnly` が pnpm 直書き（`pnpm build && pnpm test && pnpm typecheck`）であることを明記
- [x] **4.6** `docs/phase1-plan.md` を完了履歴アーカイブとして整理（任意・スキップ可）
  - 冒頭に「持ち越し・受容リスクは `docs/backlog.md` および `docs/phase1.5-plan.md` に移管済み」を明示

完了基準: npm registry 上で公開される `packages/nanoka/README.md` の全リンクが解決でき、`CONTRIBUTING.md` 単体で開発・リリース手順が追える。

### M3: CI/CD 基盤（PR ゲート）

- [x] **4.1a** GitHub Actions: PR / push to main で build / test / typecheck / lint を回す
  - Node.js 20.x（`engines.node: >=20` と整合）
  - jobs: `pnpm install` → `pnpm -C packages/nanoka build` → `pnpm -C packages/nanoka test` → `pnpm -C packages/nanoka typecheck` → `pnpm -C examples/basic typecheck` → `pnpm -C examples/basic test` → `pnpm lint`
- [x] **4.4** LICENSE 二重配置の diff チェックを CI に組み込む
  - リポジトリルート `LICENSE` と `packages/nanoka/LICENSE` の差分を検出して fail
- [x] **4.2** リポジトリテンプレ整備
  - `.github/PULL_REQUEST_TEMPLATE.md`
  - `.github/ISSUE_TEMPLATE/bug_report.md` / `feature_request.md`
  - `.github/CODEOWNERS`
  - branch protection は GitHub 管理画面で別途設定（main 直 push 禁止 / PR 必須 / CI green 必須）
- [x] **4.1c** lint green 化（CI workflow 4.1a の真の完了条件）
  - `pnpm exec biome check .` が報告する 3 errors（package.json format / codegen/generate.ts format / model/types.ts organizeImports）を `biome check --write` で解消
  - 副作用なく解消できる warnings（`suppressions/unused` 4 件、`noUnusedImports`/`noUnusedVariables`/`noUnusedFunctionParameters` 計 5 件）も併せて整理
  - `noExplicitAny` 87 件 / `noNonNullAssertion` 10 件は本サブタスク対象外（warnings のままでも CI は green）。Phase 2 で精緻型化（`docs/nanoka.md` Phase 2B 参照）
- [x] **4.2b** `.github/ISSUE_TEMPLATE/config.yml` を追加（Discussions 誘導）
  - `blank_issues_enabled: false` + Discussions リンク
  - 4.2 完了後に Discussions が有効化されたため追加
- [x] **4.1d** `docs/nanoka.md` Phase 2B に「Phase 1.5 持ち越しの型精緻化」項目を追記
  - `noExplicitAny` 87 件 / `noNonNullAssertion` 10 件を Phase 2 で解消する旨を記録
  - 実装は Phase 2 で行う。本タスクは **計画記述の追加のみ**

完了基準: PR 作成時に CI が走り、build/test/typecheck/lint と LICENSE 同期チェックがすべて exit 0 で通る。lint は warnings 残存を許容するが errors はゼロ。`docs/nanoka.md` Phase 2B に型精緻化項目が記載されている。

### M4: Onboarding parity CI

- [ ] **4.7** README どおりの最小プロジェクトを CI で組み立て、`tsc --noEmit` と `drizzle-kit generate` を回す E2E
  - 手順:
    1. `pnpm -C packages/nanoka pack` で tarball 生成
    2. CI のスクラッチ dir で最小 scaffold を作成（`pnpm create hono@latest` 風または静的同梱）
    3. tarball を `pnpm add` し、README 記載の追加コマンド（`drizzle-kit` / `typescript` / `@cloudflare/workers-types` / `zod@^3.23.0`）を流す
    4. `tsc --noEmit` が通り、`drizzle-kit generate` が成功することを assert
  - 契約: 2026-05 ユーザー報告の 4 件（`zod ^4` 入れたら `User.create({...})` 型崩壊 / `drizzle-kit` 不在 / `@cloudflare/workers-types` 不足 / TypeScript 自体の不在）がすべて本 CI で落ちる
  - 動機: workspace 内 (`pnpm -C ...`) では検出不可能なため、公開済み tarball / scaffold parity を別レーンで見る必要がある

完了基準: README の Quickstart 通りに進めた最小プロジェクトが CI で `tsc --noEmit` を通る。

### M5: Publish 自動化

- [ ] **4.1b** tag push (`v*`) で `pnpm publish` を自動化する GitHub Actions
  - npm 2FA 有効時の方針を着手時に確定: `NPM_TOKEN` 利用 or trusted publisher / OIDC のどちらか
  - `prepublishOnly`（`pnpm build && pnpm test && pnpm typecheck`）はローカル保険として残す
  - リリース手順を `CONTRIBUTING.md`（M2 §4.3）と整合させる

完了基準: `git tag v0.1.x && git push --tags` で npm registry に自動 publish される（dry-run で先に検証）。

---

## マイルストーンの依存関係

- M1 / M2 は独立。並行可。
- M3 は M1 / M2 と独立だが、`CONTRIBUTING.md` のリリース手順記述（M2 §4.3）は M5 の自動化方針が決まってから書き直す可能性あり。M5 着手時に再点検する。
- M4 は M3 のワークフロー基盤を再利用するため、M3 の後に着手する。
- M5 は M3 + M4 が green になってから着手する。

---

## 着手前チェック（再開時用）

新規セッションで本計画から再開する場合、以下を確認:

1. `git status` と `git log` で前回の到達点を把握
2. 本ファイルのチェックボックスと実コードの差分を照合（チェックが正しいか）
3. `docs/backlog.md` に新規項目が増えていないか確認（増えていれば本計画への取り込み要否を判断）
4. 直近完了マイルストーンの「完了基準」を実行して回帰を検出
5. 次の未完了マイルストーンに着手
