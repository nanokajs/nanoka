<!--
このファイルは `init-phase-skill` が生成するフェーズオーケストレーションスキルのテンプレート。
`{{PLACEHOLDER}}` 形式の変数を `init-phase-skill/SKILL.md` の手順に従って置換する。

プレースホルダ一覧:
  {{PHASE_ID}}                  スキル ID。例: `phase1-5`, `phase2`.
  {{PHASE_DISPLAY}}             人間向け表示名。例: `Phase 2`, `Phase 1.5`.
  {{MILESTONE_RANGE}}           例: `M0〜M8`, `M1〜M5`.
  {{FIRST_M}}                   起点マイルストーン。
  {{SECOND_M}}                  起点の次。
  {{PLAN_FILE}}                 例: `docs/phase2-plan.md`.
  {{PHASE_OVERVIEW}}            1〜2 段落でフェーズのスコープ・前提・特徴。
  {{MILESTONE_HEADINGS}}        例: `### M1:` 〜 `### M5:`.
  {{DEPENDENCY_RULES}}          次マイルストーン特定時に確認すべき依存関係。
  {{IMPLEMENTER_PER_MILESTONE}} 各マイルストーンの実装目安。
  {{SECURITY_SCOPE_RULES}}      セキュリティレビュー対象のルール。
  {{OUT_OF_SCOPE_NOTE}}         本フェーズの対象外項目。
-->

---
name: {{PHASE_ID}}-next
description: {{PHASE_DISPLAY}} ({{MILESTONE_RANGE}}) を 1 マイルストーンずつ進める。`{{PLAN_FILE}}` を読んで次の未完了マイルストーンを特定し、計画・実装・レビュー・必要時のセキュリティ確認を行う。1 回の起動で 1 マイルストーンだけ進める（{{FIRST_M}} をやったら {{SECOND_M}} には自動で進まない）。
---

# {{PHASE_DISPLAY}} を 1 マイルストーンずつ進める

このスキルは 1 マイルストーンを完了させたら止まる。次の M に進むかはユーザーが明示的に判断する。

{{PHASE_OVERVIEW}}

## 必須コンテキスト

リポジトリルートから、計画や編集の前に読む。

- `AGENTS.md`
- `docs/nanoka.md`
- `{{PLAN_FILE}}`
- 対象マイルストーンに関係する source / test / docs

## Step 1: 状況把握

1. `{{PLAN_FILE}}` を読み、すべてのマイルストーン（{{MILESTONE_HEADINGS}}）とチェックボックス状態を確認する。
2. `{{FIRST_M}}` から順に、未完了チェックボックスが 1 つでもあるマイルストーンを対象にする。
3. 依存関係を確認する: {{DEPENDENCY_RULES}}
4. すべて完了済みなら「{{PHASE_DISPLAY}} 完了」と報告して停止する。
5. 対象マイルストーンの完了基準と未完了タスクを提示し、着手確認を取る。

## Step 2: Plan

複数ファイル変更、公開 API 変更、設計判断がある場合は編集前に短い計画を出す。

- Goal: このマイルストーンを完了と見なす条件
- Constraints: `AGENTS.md` / `docs/nanoka.md` / フェーズ境界
- Files: 変更予定の source / test / docs
- Steps: 実装順序
- Tests: 実行する検証
- Completion criteria: 更新する `{{PLAN_FILE}}` のチェックボックス
- Deferred work: 今回混ぜない次フェーズ項目

サブエージェントはユーザーが明示的に依頼した場合だけ使う。依頼された場合は `planner` / `implementer` / `implementation-reviewer` / `security-reviewer` を Codex の `spawn_agent` 役割に対応づける。

## Step 3: Implement

選んだ 1 マイルストーンだけ実装する。`{{PLAN_FILE}}` のチェックボックスは、対応するコード・テスト・ドキュメントが実際に完了した時点で更新する。

{{PHASE_DISPLAY}} のマイルストーン別の目安:
{{IMPLEMENTER_PER_MILESTONE}}

## Step 4: Verify And Review

狭い検証から実行し、必要に応じて広げる。完了前に次を確認する。

- `docs/nanoka.md` と `AGENTS.md` の load-bearing rules に反していない。
- フェーズ境界を越えていない。
- `{{PLAN_FILE}}` のチェックボックスが実態と一致する。
- 既存の unrelated dirty worktree を巻き戻していない。

## Step 5: Security Review

{{SECURITY_SCOPE_RULES}}

外部入力、DB、validator、secret、CI/CD、公開 workflow、新規依存に触れる場合はセキュリティ観点で確認する。

## Step 6: Stop Cleanly

完了時は、対象マイルストーン、変更ファイル、更新したチェックボックス、実行した検証、次の候補マイルストーンを短く報告して停止する。次のマイルストーンには自動で進まない。

## ガードレール

- 1 回の起動で 1 マイルストーンだけ。
- `{{PLAN_FILE}}` の更新タイミングを守る。
- 依存関係を尊重する: {{DEPENDENCY_RULES}}
- 対象外: {{OUT_OF_SCOPE_NOTE}}
- 矛盾やスコープ膨張を検知したら停止してユーザーに判断を仰ぐ。

## 引数

引数で特定マイルストーンを指定された場合（例: `{{PHASE_ID}}-next M3`）は、Step 1 の自動判定を上書きする。ただし依存マイルストーンが未完了なら警告してユーザー確認を取る。
