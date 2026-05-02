# Backlog

`docs/phase1-plan.md` で記録した Phase 1（M0〜M8）は完了済み。`@nanokajs/core` を npm registry に公開済み。

このファイルは Phase 1 完了後の残課題を集約する。新しい課題を追加するときは該当セクションに節として追記し、解消したら該当節を削除（または `~~取り消し線~~` で残す）するか、`docs/phase1-plan.md` のような完了履歴ドキュメントへ移す。

> **Phase 1.5 として作業中**: §1（Phase 1 内の持ち越し）と §4（運用・インフラ）は `docs/phase1.5-plan.md` にマイルストーン化済み。進捗追跡はそちらが source of truth。本ファイルでは概要のみ残し、詳細・チェックボックスは Phase 1.5 計画側で更新する。

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

Phase 2 の軸は「Drizzle クエリDSLの再発明」ではなく、**DBモデルとAPI入力/出力の境界を安全に速く書けること**に置く。CRUD / where / relation の抽象化は後回しにし、まず `passwordHash` のような DB-only フィールドやレスポンス整形を扱う。

### 3.1 Phase 2A: API境界

- **フィールドポリシー**: `t.string().serverOnly()` / `.writeOnly()` / `.readOnly()` のようなマーカーを導入する。検討時の論点:
  - `serverOnly`: API input / output の両方から既定で除外する候補。例: `passwordHash`。
  - `writeOnly`: input には入るが output から除外する候補。例: `password` を受け取り、handler で `passwordHash` に変換する設計を許す場合。
  - `readOnly`: output には入るが create / update input から既定で除外する候補。例: `id`, `createdAt`。
  - スコープは API 派生 schema / validator / response helper に限定する。`findMany` の戻り値や `app.db.select()` を自動で変換しない。
  - 既存の `{ omit: [...] }` / `{ pick: [...] }` 明示指定は引き続き効く。
- **用途別スキーマ**: `User.inputSchema('create')` / `User.inputSchema('update')` / `User.outputSchema()` を導入する。内部は既存 `schema()` の派生でよいが、API入力・API出力・DB row の違いを明示する。
- **validator preset**: `User.validator('json', 'create')` / `User.validator('json', 'update')` のように、用途別スキーマを Hono validator に渡せるようにする。
- **明示的なレスポンス整形**: `User.outputSchema().parse(row)` または `User.toResponse(row)` を検討する。自動変換は避け、"80% automatic, 20% explicit" を維持する。
- **`t.json(zodSchema)` の引数化**: 現状 `t.json()` は `z.unknown()` で runtime 検証なし（M-1 review 指摘）。API境界をコア価値にするなら早めに対応する。

### 3.2 Phase 2B: 型と互換性

- **フィールドアクセサ API**: まず `{ pick: f => [f.name] }` / `{ omit: f => [f.passwordHash] }` の schema / validator 用途から導入する。`User.where(f => eq(f.email, x))` は後回し。
  - 制約: `f` は `as const` の固定オブジェクトとし、Proxy にしない（runtime コスト ゼロ要件）。
- **Zod 4 サポート**: 現状 `peerDependencies.zod: ^3.23.0`。v4 は `ZodType<Output, Def, Input>` → `ZodType<Output, Input, Internals>` に generic 順序が変わり、`packages/nanoka/src/field/factories.ts` 各 builder の `ZB extends z.ZodType<TS, z.ZodTypeDef, TS>` 制約が壊れる。結果として `Field<TS, Mods, ZB>` 由来の `InferFieldType` 条件型分岐が `never` に潰れ、`User.create({...})` で「string は undefined に代入できない」型エラーが発生する（2026-05 ユーザー報告）。対応方針:
  1. `peerDependencies.zod` を `^3.23.0 || ^4.0.0` に広げ、両対応する型シグネチャに書き換える
  2. または v4 に切り替えて v3 を切る（破壊的変更）
  - 着手時に判断。検出は §4.7 の onboarding parity E2E で担保する。
- **create / update input の必須・任意フィールド精緻化**: Phase 1 は `CreateInput = Partial<RowType>` で受容した。`readOnly` / default / optional / primary の情報を使って入力型を精緻化する。

### 3.3 Phase 2C: OpenAPI seed

- **モデル単位の JSON Schema / OpenAPI component 生成**: `inputSchema()` / `outputSchema()` / フィールドポリシーが OpenAPI の source of truth として成立するかを検証する。
- **Phase 2 では最小に留める**: Hono ルート全体の自動収集、Swagger UI、route-level OpenAPI は Phase 3 に送る。

### 3.4 1.0.0 リリース判断基準

`1.0.0` は Phase 3 の完了ではなく、Nanoka の中心 API を長期維持できると判断できた時点で切る。具体的には Phase 2A / 2B と最小 OpenAPI seed を完了し、DBモデルとAPI入力/出力の境界設計を破壊的変更なしに保てる状態を条件にする。

- `serverOnly()` / `writeOnly()` / `readOnly()` の意味論が確定している
- `inputSchema('create' | 'update')` / `outputSchema()` の公開 API が安定している
- `User.validator(...)` の用途別 preset が安定している
- `t.json(zodSchema)` と Zod 4 対応が完了している
- create / update input 型が実用上十分に精緻化されている
- OpenAPI component 生成で schema 設計が破綻しないことを確認済み
- onboarding parity CI により README 通りの導入が継続検証されている
- 既知の破壊的変更候補が backlog 上で整理または解消されている

relation / Turso・libSQL adapter / route-level OpenAPI / `create-nanoka-app` / VSCode拡張は `1.0.0` の必須条件にしない。これらは中心 API の上に載る拡張として、1.x 系で追加してよい。

### 3.5 Phase 2 後半または Phase 3 候補

- **Turso / libSQL adapter**
- **Relations** (`t.hasMany()` / `t.belongsTo()`)
- **型安全なクエリビルダー** (`User.where(f => eq(f.email, x)).limit(10)`)
  - Drizzle 再発明に寄りやすいため優先度を下げる。
- **`npx create-nanoka-app`**（Phase 3）

### 全 Phase でスコープ外

- 認証 / フルスタック React / Drizzleを置き換える複雑な query DSL

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

### 4.7 README onboarding parity の CI 化

- **背景**: 2026-05 にユーザーが `pnpm create hono@latest` から始めて Nanoka を入れた際、README どおりに進めても以下が次々に surface した:
  1. `zod ^4.4.2` を入れると `User.create({...})` の型推論が `never` に潰れる（peer dep `zod ^3.23.0` の警告は出るが止まらない）
  2. `drizzle-kit` が devDep に居なくて `npx drizzle-kit generate` が落ちる、`drizzle.config.ts` も無い
  3. `tsconfig.json` の `types: ["@cloudflare/workers-types"]` が無く `D1Database` / `Request` / `crypto` などの ambient 解決が壊れる
  4. `create hono` scaffold が TypeScript 自体を入れない（VS Code の bundled TS 任せ）
- **共通点**: いずれも workspace 内 (`pnpm -C packages/nanoka test` / `pnpm -C examples/basic typecheck`) では検出不可能。`workspace:*` で nanoka を参照しているため、公開済み tarball の peer-dep / scaffold parity を見ていない。
- **方針**: CI に「**公開済み (または `pnpm pack` 産出物の) tarball を空ディレクトリに `pnpm add` し、README の Quickstart どおりに最小プロジェクトを組んで `tsc --noEmit` と `wrangler dev --dry-run` を回す**」E2E を追加する。具体的には:
  1. `pnpm -C packages/nanoka pack` で tarball 生成
  2. CI のスクラッチ dir で `pnpm create hono@latest` 風の最小 scaffold を作成（または静的に同梱）
  3. tarball から `pnpm add` し、README に書かれた追加コマンド（`drizzle-kit` / `typescript` / `@cloudflare/workers-types` / `zod@^3.23.0`）も同様に流す
  4. `tsc --noEmit` が通ること、`drizzle-kit generate` が成功することを assert
- **効果**: 今回検出した 4 件すべて、これがあれば PR 段階で落ちる。今後 README に書かれた手順が崩れた瞬間に CI が赤くなる契約になる。
- **優先度**: 中（次の publish 前に入れたい）。

### 4.8 `crud.ts` の `biome-ignore` 一貫性

- **概要**: `packages/nanoka/src/model/crud.ts` の `findOneImpl` には drizzle query cast 用の `// biome-ignore lint/suspicious/noExplicitAny: drizzle query type` が付与されているが、`createImpl` / `updateImpl` の同種 `as any` cast には付与されていない。biome は `suppressions/unused` を 0 件として通すため lint は green だが、同種 cast の suppress 有無が不統一。
- **状態**: 実害なし、Phase 1.5 / M3 implementation-review (Minor) で記録。
- **対応方針**: `createImpl` / `updateImpl` にも biome-ignore を追加して揃えるか、`findOneImpl` の biome-ignore を削除して揃えるかを M4 着手前の任意タスクとして検討。
- **優先度**: 低。

### 4.9 `pnpm/action-setup@v4` SHA pinning

- **概要**: `.github/workflows/ci.yml` の `pnpm/action-setup` はメジャータグ `@v4` 固定。GitHub 公式ではない third-party action のため、M5 (publish 自動化) で `NPM_TOKEN` / OIDC を扱う前に commit SHA pinning に切り替えるのが望ましい。
- **状態**: Phase 1.5 / M3 security-review (Minor) で記録。M3 段階では許容。
- **対応方針**:
  1. `pnpm/action-setup@<40-char-sha> # v4.x.y` 形式に書き換え
  2. `.github/dependabot.yml` を追加し `package-ecosystem: github-actions`（weekly）で SHA を自動更新
  3. M5 publish workflow も同時に SHA pinning 化（`actions/checkout` / `actions/setup-node` も含めて）
  4. `--provenance` フラグ付き publish で npm provenance 有効化
- **優先度**: 中（M5 着手と同時）。
