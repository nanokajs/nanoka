---
name: phase1-5-next
description: Phase 1.5 (M1〜M5) を 1 マイルストーンずつ進める。`docs/phase1.5-plan.md` を読んで次の未完了マイルストーンを特定し、計画・実装・検証・レビューを行う。M1 / M2 は独立、M3 → M4 → M5 は依存あり。
---

# Phase 1.5 を 1 マイルストーンずつ進める

このスキルは Claude Code の `phase1-5-next` を Codex 向けに移植したもの。1 マイルストーンを完了したら止まり、次の M には自動で進まない。

Phase 1.5 は Phase 1 完了後の運用基盤・型改善・onboarding parity を埋めるフェーズ。詳細は `docs/phase1.5-plan.md` を参照。

## 必須コンテキスト

- `AGENTS.md`
- `docs/nanoka.md`
- `docs/phase1.5-plan.md`
- `docs/backlog.md`
- 対象マイルストーンに関係する source / test / docs

## Step 1: 状況把握

1. `docs/phase1.5-plan.md` を読み、`### M1:` 〜 `### M5:` のチェックボックス状態を確認する。
2. M1 から順に、未完了チェックボックスが 1 つでもあるマイルストーンを対象にする。
3. M1 / M2 が両方未完了の場合は独立なので、どちらから着手するかユーザーに確認する。
4. M3 着手時は M2 §4.3 (`CONTRIBUTING.md`) との整合確認が必要。M4 は M3 完了、M5 は M3 + M4 完了が前提。前提未達なら警告して確認する。
5. すべて完了済みなら「Phase 1.5 完了」と報告して停止する。

## Step 2: Plan

編集前に対象マイルストーンの計画を出す。Phase 2 機能や受容リスクを混ぜない。M1.1 では `Nanoka<E extends Env = BlankEnv>` の後方互換と、Phase 1 M5 で精緻化した validator chain 型推論を壊さないことを明示的に確認する。

サブエージェントはユーザーが明示的に依頼した場合だけ使う。通常はローカルで計画・実装・レビューする。

## Step 3: Implement

選んだ 1 マイルストーンだけ実装する。`docs/phase1.5-plan.md` のチェックボックスは、対応するコード・テスト・ドキュメントが実際に完了した時点で更新する。

マイルストーン別の実装目安:

- M1.1 Bindings generic 対応: 複雑な型変更。深い型検証が必要。
- M1.2 e2e seed の `User.create` 化: 機械的変更。
- M2 README / CONTRIBUTING / phase1-plan archive: ドキュメント中心。
- M3 GitHub Actions / LICENSE diff / repository template: CI 設定中心。
- M4 Onboarding parity CI: scaffold の動的構築なら複雑、静的同梱なら比較的単純。
- M5 Publish 自動化: publish flow、OIDC、`NPM_TOKEN` 周辺に注意。

## Step 4: Verify And Review

狭い検証から実行し、必要に応じて広げる。完了前に `docs/nanoka.md` / `docs/phase1.5-plan.md` / `docs/backlog.md` との整合、Phase 境界、チェックボックスの実態一致、unrelated dirty worktree を巻き戻していないことを確認する。

## Step 5: Security Review

CI/CD、secret、外部から取得する依存、公開 workflow に触れる場合はセキュリティ観点で確認する。

- M3: GitHub Actions 新規作成。`pull_request_target`、secret 露出、checkout 設定に注意。
- M4: CI 内で外部 npm package を fetch / install / execute する可能性に注意。
- M5: `NPM_TOKEN` / Trusted Publisher / tag push trigger を必ず確認。
- M1 / M2: 通常スキップ可。ただし依存追加やビルド設定変更があれば確認する。

## Step 6: Stop Cleanly

完了時は、対象マイルストーン、変更ファイル、更新したチェックボックス、実行した検証、次の候補マイルストーンを短く報告して停止する。M1 / M2 が両方残る場合は両方を候補として提示する。

## ガードレール

- 1 回の起動で 1 マイルストーンだけ。
- M4 着手前に M3 完了、M5 着手前に M3 + M4 完了を確認する。
- Phase 2 機能（relation / field accessor / OpenAPI / Turso / Zod 4 / `t.json(zodSchema)` 等）や受容リスク（`undici@5.29.0` 等）は `docs/backlog.md` §2 / §3 の管轄。

## 引数

特定マイルストーンを指定された場合（例: `phase1-5-next M3`）は自動判定を上書きする。ただし依存マイルストーンが未完了なら警告してユーザー確認を取る。
