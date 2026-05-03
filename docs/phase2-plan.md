# Phase 2 実装計画

Phase 1.5 完了後、Nanoka の中心 API である「DBモデルと API 入力/出力の境界」を確立し、`1.0.0` リリースに到達するためのフェーズ。`docs/nanoka.md` の Phase 2A（API 境界）/ 2B（型と互換性）/ 2C（OpenAPI seed）と「1.0.0 リリース判断基準」、`docs/backlog.md` §3 をマイルストーン化したもの。

Phase 2 の軸は Drizzle クエリ DSL の再発明ではなく、`passwordHash` のような DB-only フィールドやレスポンス整形を安全に・速く書けるようにすること。relation / Turso adapter / `create-nanoka-app` / VSCode 拡張は 1.0.0 の必須条件にせず、1.x 系で追加する。

進捗が変わったら本ファイルのチェックボックスを更新する。新規セッション開始時はまず本ファイルを読み、未完了の最初のマイルストーンから着手する。

---

## ゴール

1. `serverOnly()` / `writeOnly()` / `readOnly()` の意味論が確定している
2. `inputSchema('create' | 'update')` / `outputSchema()` の公開 API が安定している
3. `User.validator(...)` の用途別 preset が安定している
4. `t.json(zodSchema)` と Zod 4 対応が完了している
5. create / update input 型が実用上十分に精緻化されている
6. OpenAPI component 生成で schema 設計が破綻しないことを確認済み
7. 既知の破壊的変更候補が backlog 上で整理または解消されている

---

## マイルストーン

### M1: API 境界（Phase 2A）

`docs/backlog.md` §3.1 由来。Phase 2 の中核。

- [x] **1.1** フィールドポリシー導入: `t.string().serverOnly()` / `.writeOnly()` / `.readOnly()`
  - `serverOnly`: API input / output の両方から既定で除外。例: `passwordHash`
  - `writeOnly`: input には入るが output から既定で除外。例: `password`（handler 内で `passwordHash` に変換する設計を許す）
  - `readOnly`: output には入るが create / update input から既定で除外。例: `id`, `createdAt`
  - スコープは API 派生 schema / validator / response helper に限定する。`findMany` の戻り値や `app.db.select()` を自動変換しない
  - 既存の `{ omit: [...] }` / `{ pick: [...] }` 明示指定は引き続き効く
- [x] **1.2** 用途別スキーマ: `User.inputSchema('create')` / `User.inputSchema('update')` / `User.outputSchema()`
  - 内部は既存 `schema()` 派生でよいが、API 入力 / API 出力 / DB row の違いを明示する
  - フィールドポリシー（1.1）を反映: `serverOnly` は両方から除外 / `writeOnly` は output から除外 / `readOnly` は input から除外
- [x] **1.3** validator preset: `User.validator('json', 'create')` / `User.validator('json', 'update')`
  - 用途別スキーマ（1.2）を Hono validator に渡すショートカット
  - 既存の `User.validator('json', { omit: [...] })` 形式は維持
- [x] **1.4** 明示的レスポンス整形 helper の API 決定と実装
  - 候補: `User.outputSchema().parse(row)` または `User.toResponse(row)`
  - 自動変換は避け「80% automatic, 20% explicit」を維持
- [x] **1.5** `t.json(zodSchema)` の引数化（Phase 1 / M-1 review 指摘）
  - 現状 `t.json()` は `z.unknown()` で runtime 検証なし
  - `t.json(z.object({...}))` で create / update 時に zod parse が走るようにする

完了基準: 上記 5 件がテスト付きで実装され、`examples/basic` でフィールドポリシー（最低 1 件）と用途別スキーマが実利用される。`pnpm -C packages/nanoka test` / `typecheck` / `pnpm lint` / `pnpm -C examples/basic typecheck` / `test` がすべて green。

### M2: 型と互換性（Phase 2B）

`docs/backlog.md` §3.2 由来。Zod 4 サポート（2.2）は M1 と並行可能。

- [ ] **2.1** フィールドアクセサ API（schema / validator 用途のみ）
  - `User.schema({ pick: f => [f.name] })` / `User.schema({ omit: f => [f.passwordHash] })`
  - `f` は `as const` の固定オブジェクト。Proxy 禁止（runtime コスト ゼロ要件）
  - 既存の文字列配列形式 `{ pick: ['name'] }` も維持（後方互換）
  - クエリ側 `User.where(f => ...)` は対象外（Phase 2 後半 / Phase 3 候補）
- [ ] **2.2** Zod 4 サポートの方針決定と実装
  - 現状 `peerDependencies.zod: ^3.23.0`。v4 は `ZodType<Output, Def, Input>` → `ZodType<Output, Input, Internals>` の generic 順序変更で `Field<TS, Mods, ZB>` 由来の型推論が `never` に潰れる（2026-05 ユーザー報告）
  - 対応方針: (a) `^3.23.0 || ^4.0.0` に拡張して両対応、または (b) v4 に切り替えて v3 を切る（破壊的変更）
  - 着手時に判断。検出は `docs/backlog.md` §4.7 onboarding parity E2E で担保
- [ ] **2.3** create / update input 型の精緻化
  - Phase 1 は `CreateInput = Partial<RowType>` で受容した
  - `readOnly` / default / optional / primary の情報を使って入力型を精緻化
  - 例: `readOnly` は `CreateInput` から除外 / default 持ちは optional / primary かつ default なしは required
  - **M1 より持ち越し**: `inputSchema('create' | 'update')` / `outputSchema()` の戻り型を Phase 2A では `z.ZodObject<z.ZodRawShape>` に緩めた（判断 B）。`policy` 由来の自動 omit を型レベルで反映する精緻化（`ApplyShape` への組み込み）を本タスク 2.3 に含める。`validator('json', preset)` 経由の `c.req.valid('json')` の型推論は M1 時点でも preset が `MiddlewareHandler` として緩く推論される（精緻な shape は 2.3 で解消）。
- [ ] **2.4** Phase 1.5 持ち越しの型精緻化（`docs/nanoka.md` Phase 2B 由来）
  - `noExplicitAny` 87 件 / `noNonNullAssertion` 10 件の削減
  - 主な箇所: `packages/nanoka/src/model/crud.ts` / `model/types.ts` / `router/types.ts` / `__tests__/*`
  - フィールドアクセサ API（2.1）導入時に `Field<any, any, any>` を精緻型へ置換
  - `!` non-null assertion は型ガードまたは zod parse 経由で解消
  - 完了基準は緩く「Phase 2 完了時点で warnings が大幅に減ること」（ゼロ化必須ではない）
  - テストコード内の意図的な `as any`（`@ts-expect-error` 周辺）は `// biome-ignore` 個別抑制を許容

完了基準: フィールドアクセサ API でタイポが型エラーになる（`@ts-expect-error` テスト付き）。Zod 3 / 4 両対応 or v4 切り替えで onboarding parity CI が green。`pnpm lint` の `noExplicitAny` warnings が Phase 1.5 完了時点から有意に減少。

### M3: OpenAPI seed（Phase 2C）

`docs/backlog.md` §3.3 由来。M1（フィールドポリシー / 用途別スキーマ）完了後に着手するのが自然。

- [ ] **3.1** モデル単位の JSON Schema / OpenAPI component 生成 API
  - `User.toOpenAPIComponent()` または `User.toJSONSchema()`（命名は着手時に決定）
  - `inputSchema('create')` / `inputSchema('update')` / `outputSchema()` から JSON Schema / OpenAPI 3.x component を生成
  - フィールドポリシー（1.1）が `required` / `readOnly` / `writeOnly` に正しく反映されることを assert
- [ ] **3.2** OpenAPI source of truth として成立するかの検証
  - `examples/basic` の `User` モデルから生成した OpenAPI component を fixture として保存し、スキーマ変更時に diff が出るスナップショットテスト
  - フィールドポリシーの追加 / 変更が OpenAPI に正しく反映されることを保証
  - 設計が破綻する場合は M1 のフィールドポリシー API に差し戻す
- [ ] **3.3** Hono ルート全体の自動収集 / Swagger UI / route-level OpenAPI は **本マイルストーン対象外**（Phase 3 送り）

完了基準: モデル単位で OpenAPI component が生成でき、フィールドポリシーの意味論が JSON Schema 上に正しく現れる。スナップショットテストで回帰検出可能。`docs/nanoka.md`「OpenAPI component 生成で schema 設計が破綻しない」が確認済み。

### M4: 1.0.0 リリース準備

`docs/nanoka.md`「1.0.0 リリース判断基準」由来。M1 / M2 / M3 完了後に着手。

- [ ] **4.1** 1.0.0 リリース判断基準の最終確認
  - `docs/nanoka.md` の判断基準 8 項目を M1〜M3 の実装結果と逐一突き合わせ
  - 抜けがあれば該当マイルストーンに差し戻し
- [ ] **4.2** 既知の破壊的変更候補の整理 / 解消
  - `docs/backlog.md` §3 / §4 を全件レビュー
  - 1.0.0 で破壊的変更として取り込みたい項目はこのタイミングで実装
  - 保留分は `docs/backlog.md` 上で 1.x 系候補として整理
- [ ] **4.3** CHANGELOG.md / リリースノートの整備
  - 0.x 系からの破壊的変更点を明示
  - 安定 API 一覧（フィールドポリシー / inputSchema / outputSchema / validator preset / フィールドアクセサ）を README に反映
- [ ] **4.4** version bump と publish dry-run
  - `packages/nanoka/package.json` を `1.0.0` に bump
  - Phase 1.5 / M5 で整備した tag push publish flow（`v1.0.0` push → npm Trusted Publisher OIDC）が green であることを `publish-dry-run.yml` で確認
- [ ] **4.5** README の 1.0.0 安定化セクション追記
  - 中心 API の安定宣言
  - 1.x 系で追加予定（relation / Turso・libSQL adapter / `create-nanoka-app` / route-level OpenAPI / VSCode 拡張）を明示

完了基準: `docs/nanoka.md` の 1.0.0 リリース判断基準 8 項目すべてに ✓ が付く。`v1.0.0` tag push で publish が走り、`@nanokajs/core@1.0.0` が npm registry に出る。onboarding parity CI が `1.0.0` に対して green。`docs/backlog.md` 上に 1.0.0 ブロッカーがゼロ。

---

## マイルストーンの依存関係

M1（API 境界の意味論確定）→ M2（型精緻化）→ M3（OpenAPI source of truth として成立確認）→ M4（リリース）が基本ライン。

ただし M2 の Zod 4 サポート（`docs/backlog.md` §4.7 の onboarding parity が検出した critical issue）は M1 と並行可能。

---

## 対象外

- **Phase 2 後半 / Phase 3 候補**（relation / Turso・libSQL adapter / 型安全クエリビルダー / `npx create-nanoka-app` / route-level OpenAPI / Swagger UI / VSCode 拡張）は 1.0.0 必須条件にしない。`docs/backlog.md` §3.5 / §4.10 の管轄。
- **全 Phase 外**: 認証 / フルスタック React / Drizzle を置き換える複雑な query DSL（`docs/nanoka.md`「Nanokaがやらないこと」）。
- **受容リスク**（`docs/backlog.md` §2）も本フェーズ対象外。状況が変われば該当節で更新する。

---

## 着手前チェック（再開時用）

新規セッションで本計画から再開する場合、以下を確認:

1. `git status` と `git log` で前回の到達点を把握
2. 本ファイルのチェックボックスと実コードの差分を照合（チェックが正しいか）
3. `docs/backlog.md` に新規項目が増えていないか確認（増えていれば本計画への取り込み要否を判断）
4. 直近完了マイルストーンの「完了基準」を実行して回帰を検出
5. 次の未完了マイルストーンに着手
