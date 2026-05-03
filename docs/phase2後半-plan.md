# Phase 2後半 実装計画

Phase 2 前半（M1〜M4）でリレーション・フィールドアクセサ等を実装した後、OpenAPI生成・Turso/libSQLアダプタ・CLIスキャフォールダ等を実装するフェーズ。

`docs/nanoka.md` の Phase 3 候補と `docs/backlog.md` §3.5 / §4.10 / §4.11 をマイルストーン化したもの。Phase 2C（OpenAPI seed）で確立した component 生成を route-level まで引き上げ、D1 以外の DB アダプタと `create-nanoka-app` CLI で「Nanoka エコシステム」として成立させることがゴール。

進捗が変わったら本ファイルのチェックボックスを更新する。新規セッション開始時はまず本ファイルを読み、未完了の最初のマイルストーンから着手する。

---

## ゴール

1. OpenAPI spec を自動生成できる
2. Turso/libSQL を D1 と同等に使える

---

## マイルストーン

### M1: OpenAPI生成

Phase 2C（M3）で確立したモデル単位の component 生成を、route-level まで引き上げる。`docs/backlog.md §4.11` の要件（未対応 Zod 型の扱い / strict mode）もここで解消する。

- [ ] **1.1** Hono ルート全体の自動収集
  - `app.openapi()` API の設計と実装
  - Nanoka 経由で登録した GET / POST / PATCH / DELETE ルートを走査し、path / method / requestBody / responses を収集する
- [ ] **1.2** route-level OpenAPI spec 生成エンドポイント
  - `/openapi.json` (または任意パス) で OpenAPI 3.x spec を返す middleware / ルートを追加
  - `inputSchema('create' | 'update')` / `outputSchema()` / フィールドポリシーが各 operation の schema source of truth になることを確認
- [ ] **1.3** Swagger UI 統合
  - `/docs` (または任意パス) で Swagger UI を提供する middleware 追加
  - `examples/basic` で動作確認
- [ ] **1.4** 未対応 Zod 型の処理決定（`docs/backlog.md §4.11` 持ち越し）
  - `refinement` / `preprocess` / `brand` / `discriminated union` 等の扱いを決定する
  - デフォルト: `x-nanoka-zod-unsupported` フィールドを付与してスキップ
  - `strict: true` オプション時は生成エラーにする
  - fixture スナップショットでカバーする Zod 型のリストアップ
- [ ] **1.5** スナップショットテスト拡張
  - M3 で整備したスナップショットに route-level spec を追加
  - ルート変更で diff が出ることを回帰保護として確認

完了基準: `app.openapi()` で OpenAPI 3.x spec が生成でき、`/openapi.json` から取得できる。Swagger UI で browsable。フィールドポリシー（serverOnly / writeOnly / readOnly）が OpenAPI の `readOnly` / `writeOnly` フラグに正しく反映される。未対応 Zod 型は `x-nanoka-zod-unsupported` で明示されるか strict mode でエラーになる。`docs/backlog.md §4.11` の要件が解消済みになる。`pnpm -C packages/nanoka test` / `typecheck` / `pnpm lint` がすべて green。

### M2: Turso/libSQLアダプタ

`docs/nanoka.md` §「D1ファースト、adapter設計で逃げ道を用意」と `docs/backlog.md §3.5` 由来。adapter interface は Phase 1 から分離済みのため、実装は D1 adapter と対称的に書けるはず。

- [ ] **2.1** adapter interface の確認・整理
  - `packages/nanoka/src/adapter/` の現行 D1 adapter interface を確認
  - Turso/libSQL クライアントとの差分（バッチ API・トランザクション等）を洗い出す
  - 必要なら `AdapterBase` を抽象化して D1 / Turso 共通 interface を明確にする
- [ ] **2.2** `tursoAdapter(client)` 実装
  - `@libsql/client` を `peerDependencies` に追加（`packages/nanoka/package.json`）
  - `packages/nanoka/src/adapter/turso.ts` を作成
  - D1 adapter と同一 interface を満たす実装（CRUD / batch / transaction）
- [ ] **2.3** 型テストで adapter 互換性を保証
  - `tursoAdapter(...)` が `d1Adapter(...)` と同一型として扱えることを `@ts-expect-error` / 型アサーションで確認
- [ ] **2.4** Turso 向けテスト追加
  - `@libsql/client` の in-memory mode (`libsql::memory:`) を使い、D1 adapter と同等のテストスイートを追加
  - CI でも green になることを確認（`pnpm -C packages/nanoka test`）
- [ ] **2.5** `examples/` に Turso 接続サンプル追加
  - `examples/turso/` または `examples/basic` の README に Turso 接続手順を追記

完了基準: `tursoAdapter(createClient({ url: 'libsql:...' }))` で D1 と同等の CRUD（`findMany` / `findOne` / `create` / `update` / `delete` / batch）が動作する。`pnpm -C packages/nanoka test` で Turso adapter のテストが green。アダプタ差し替えがコンパイルエラーなし。`pnpm lint` / `typecheck` が green。

### M3: CLIスキャフォールダ

`docs/nanoka.md` Phase 3 "`npx create-nanoka-app`" 由来。`docs/backlog.md §4.7` で整備した onboarding parity CI と連携させることで、scaffold 産出物の parity を自動保証する。

- [ ] **3.1** `packages/create-nanoka-app` の新規パッケージ追加
  - `pnpm-workspace.yaml` に `packages/create-nanoka-app` を追加
  - `package.json` に `bin: { "create-nanoka-app": "dist/index.js" }` を設定
  - `tsup` でビルド、`pnpm -C packages/create-nanoka-app build` が通ること
- [ ] **3.2** scaffold テンプレート実装
  - Hono + D1 + Nanoka の最小構成（`src/index.ts` / `drizzle.config.ts` / `wrangler.toml` / `tsconfig.json`）を `templates/default/` に用意
  - README の Quickstart と完全に一致する構成にする
  - `@nanokajs/core` のバージョン指定は `package.json` から動的に取得
- [ ] **3.3** CLI 実装（対話 or 非対話）
  - `pnpm create nanoka-app <dir>` / `npx create-nanoka-app <dir>` でプロジェクト生成
  - 最小オプション: `--template default`（現時点は default のみ）
- [ ] **3.4** onboarding parity CI との連携
  - `e2e/onboarding/` の既存スクリプトを `create-nanoka-app` 産出物に対して回すよう拡張
  - scaffold 産出物で `tsc --noEmit` / `drizzle-kit generate` が成功することを assert
- [ ] **3.5** `create-nanoka-app` を npm registry に publish
  - `packages/create-nanoka-app/package.json` に publish 設定
  - `publish.yml` / `publish-dry-run.yml` に `create-nanoka-app` を追加

完了基準: `pnpm create nanoka-app my-app` でプロジェクトが生成される。生成されたプロジェクトで `tsc --noEmit` と `drizzle-kit generate` が成功する。onboarding parity CI が scaffold 産出物に対して green。`create-nanoka-app` が npm registry に publish される。

---

## マイルストーンの依存関係

すべてのマイルストーンが独立で並行可。

ただし M1 は Phase 2C（M3）で整備した component 生成を前提とするため、`packages/nanoka/src/openapi/generate.ts` の API が安定していることを着手前に確認すること。

---

## 対象外

次フェーズ候補と受容リスクは本フェーズ対象外。`docs/backlog.md` §2 / §3 の管轄。

- **Relations**（`t.hasMany()` / `t.belongsTo()`）は `docs/backlog.md §3.5` に残置。cascade / N+1 / join 型推論の設計負荷が大きいため本フェーズには含めない
- **型安全クエリビルダー**（`User.where(f => eq(f.email, x))`）は Drizzle 再発明に寄りやすいため優先度を下げ、`docs/backlog.md §3.5` に残置
- **VSCode 拡張 / Claude Code プラグイン**は Phase 3 以降
- **全 Phase 外**: 認証 / フルスタック React / Drizzle を置き換える複雑な query DSL（`docs/nanoka.md`「Nanokaがやらないこと」）

---

## 着手前チェック（再開時用）

新規セッションで本計画から再開する場合、以下を確認:

1. `git status` と `git log` で前回の到達点を把握
2. 本ファイルのチェックボックスと実コードの差分を照合（チェックが正しいか）
3. `docs/backlog.md` に新規項目が増えていないか確認（増えていれば本計画への取り込み要否を判断）
4. 直近完了マイルストーンの「完了基準」を実行して回帰を検出
5. 次の未完了マイルストーンに着手
