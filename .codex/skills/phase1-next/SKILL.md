---
name: phase1-next
description: Phase 1 (M0〜M8) を 1 マイルストーンずつ進める。`docs/phase1-plan.md` と `docs/nanoka.md` を読み、次の未完了マイルストーンを特定し、計画・実装・検証・レビューを行う。1 回の起動で 1 マイルストーンだけ進める。
---

# Phase 1 を 1 マイルストーンずつ進める

このスキルは Claude Code の `phase1-next` を Codex 向けに移植したもの。1 マイルストーンを完了したら止まり、次の M には自動で進まない。

## 必須コンテキスト

リポジトリルートから、計画や編集の前に読む。

- `AGENTS.md`
- `docs/nanoka.md`
- `docs/phase1-plan.md`
- 対象マイルストーンに関係する source / test / docs

## Step 1: 状況把握

1. `docs/phase1-plan.md` を読み、`### M0:` 〜 `### M8:` のチェックボックス状態を確認する。
2. M0 から順に、未完了チェックボックスが 1 つでもある最初のマイルストーンを対象にする。
3. すべて完了済みなら「Phase 1 完了」と報告して停止する。
4. 対象マイルストーンの完了基準と未完了タスクを提示し、着手確認を取る。ユーザーが別 M を指定した場合は従うが、前の M が未完了なら警告する。

## Step 2: Plan

複数ファイル変更、公開 API 変更、設計判断がある場合は編集前に短い計画を出す。

- Goal: このマイルストーンを完了と見なす条件
- Constraints: `AGENTS.md` / `docs/nanoka.md` の load-bearing rules と Phase 1 境界
- Files: 変更予定の source / test / docs
- Steps: 実装順序
- Tests: 実行する検証
- Completion criteria: 更新する `docs/phase1-plan.md` のチェックボックス
- Deferred work: Phase 2 項目

ユーザーが明示的にサブエージェント利用を依頼した場合だけ、planner / implementer / implementation-reviewer / security-reviewer を Codex の `spawn_agent` 役割に対応づける。通常はローカルで計画・実装・レビューする。

## Step 3: Implement

選んだ 1 マイルストーンだけ実装する。`docs/phase1-plan.md` のチェックボックスは、対応するコード・テスト・ドキュメントが実際に完了した時点で更新する。

Phase 1 境界:

- Relations、field-accessor API、OpenAPI、Turso/libSQL adapter、CLI scaffolder、auth、complex query DSL は混ぜない。
- Hono idioms、adapter layer、raw Drizzle escape hatch、`schema()` / `validator()` 分離、`findMany` の required `limit`、D1 batch 直接公開を守る。

## Step 4: Verify And Review

狭い検証から実行する。代表例:

- `pnpm -C packages/nanoka test`
- `pnpm -C packages/nanoka typecheck`
- `pnpm -C packages/nanoka build`
- `pnpm lint`

完了前に、設計準拠、Phase 境界、チェックボックスの実態一致、unrelated dirty worktree を巻き戻していないことを確認する。

## Step 5: Security Review

外部入力、DB クエリ、adapter、D1 batch、validator、auth/secrets、CORS、redirect、logging、error response、新規依存に触れる場合はセキュリティ観点で確認する。

Phase 1 の目安:

- 対象: M3 Adapter 層、M4 CRUD クエリ、M5 ルーター、M7 統合
- 通常スキップ可: M0 scaffold、M1 field DSL、M2 型派生、M6 CLI 生成器、M8 README。ただし依存追加やビルド設定変更があれば確認する。

## Step 6: Stop Cleanly

完了時は、対象マイルストーン、変更ファイル、更新したチェックボックス、実行した検証、次の候補マイルストーンを短く報告して停止する。次のマイルストーンには自動で進まない。

## 引数

特定マイルストーンを指定された場合（例: `phase1-next M3`）は自動判定を上書きする。ただしそれ以前の M に未完了があれば警告してユーザー確認を取る。
