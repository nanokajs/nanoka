---
name: phase2-next
description: Phase 2 (M1〜M4) を 1 マイルストーンずつ進める。`docs/phase2-plan.md` を読んで次の未完了マイルストーンを特定し、計画・実装・検証・レビューを行う。M1 → M2 → M3 → M4 が基本ラインで、M2 の Zod 4 サポートは M1 と並行可能。
---

# Phase 2 を 1 マイルストーンずつ進める

このスキルは Claude Code の `phase2-next` を Codex 向けに移植したもの。1 マイルストーンを完了したら止まり、次の M には自動で進まない。

Phase 2 は、Nanoka の中心 API である「DB モデルと API 入力/出力の境界」を確立し、`1.0.0` リリースに到達するためのフェーズ。Drizzle クエリ DSL の再発明ではなく、`passwordHash` のような DB-only フィールドやレスポンス整形を安全に・速く書けるようにする。

## 必須コンテキスト

- `AGENTS.md`
- `docs/nanoka.md`
- `docs/phase2-plan.md`
- `docs/backlog.md`
- 対象マイルストーンに関係する source / test / docs

## Step 1: 状況把握

1. `docs/phase2-plan.md` を読み、`### M1:` 〜 `### M4:` のチェックボックス状態を確認する。
2. M1 から順に、未完了チェックボックスが 1 つでもあるマイルストーンを対象にする。
3. 依存関係は M1 → M2 → M3 → M4 が基本ライン。ただし M2 の Zod 4 サポートは M1 と並行可能。前提未達なら警告してユーザー確認を取る。
4. すべて完了済みなら「Phase 2 完了」と報告して停止する。

## Step 2: Plan

編集前に対象マイルストーンの計画を出す。Phase 2 後半 / Phase 3 候補（relation、Turso/libSQL adapter、型安全クエリビルダー、`create-nanoka-app`、route-level OpenAPI、Swagger UI、VSCode 拡張）および受容リスクは混ぜない。

サブエージェントはユーザーが明示的に依頼した場合だけ使う。通常はローカルで計画・実装・レビューする。

## Step 3: Implement

選んだ 1 マイルストーンだけ実装する。`docs/phase2-plan.md` のチェックボックスは、対応するコード・テスト・ドキュメントが実際に完了した時点で更新する。

マイルストーン別の実装目安:

- M1 API 境界: `serverOnly` / `writeOnly` / `readOnly` の意味論を `inputSchema` / `outputSchema` / validator preset に透過させる。型・runtime の両面で慎重に扱う。
- M2 型と互換性: field accessor API、Zod 4、`CreateInput` / `UpdateInput` 精緻化、`noExplicitAny` 削減が中心。
- M3 OpenAPI seed: JSON Schema / OpenAPI component 生成。policy が `required` / `readOnly` / `writeOnly` に正しく落ちる必要がある。
- M4 1.0.0 リリース準備: CHANGELOG / README / version bump / publish dry-run など機械的タスク中心。ただし破壊的変更候補は個別確認。

## Step 4: Verify And Review

狭い検証から実行し、必要に応じて広げる。完了前に `docs/nanoka.md` / `docs/phase2-plan.md` / `docs/backlog.md` との整合、Phase 境界、チェックボックスの実態一致、unrelated dirty worktree を巻き戻していないことを確認する。

## Step 5: Security Review

Phase 2 は API 境界・外部入力検証・機密フィールドの取り扱いが中心なので、M1〜M3 は原則セキュリティ観点で確認する。

- M1: `serverOnly` 機密フィールドが API output から除外されること、外部入力が runtime 検証されること。
- M2: Zod 4 移行で validator 挙動が変わらないこと、field accessor が意図しないフィールド公開につながらないこと。
- M3: OpenAPI component に `serverOnly` フィールドが漏れないこと。
- M4: publish flow（npm Trusted Publisher OIDC / tag push）周辺のみ対象。

## Step 6: Stop Cleanly

完了時は、対象マイルストーン、変更ファイル、更新したチェックボックス、実行した検証、次の候補マイルストーンを短く報告して停止する。次のマイルストーンには自動で進まない。

## ガードレール

- 1 回の起動で 1 マイルストーンだけ。
- 前提マイルストーン未達のまま次に進めない。ただし M2 の Zod 4 サポートは M1 と並行可能。
- Phase 2 後半 / Phase 3 候補と受容リスクは `docs/backlog.md` §2 / §3.5 / §4.10 の管轄。

## 引数

特定マイルストーンを指定された場合（例: `phase2-next M3`）は自動判定を上書きする。ただし依存マイルストーンが未完了なら警告してユーザー確認を取る。
