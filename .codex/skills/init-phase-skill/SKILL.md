---
name: init-phase-skill
description: 新しいフェーズ（Phase 2 / Phase 3 など）の進行オーケストレーションスキルを Phase next 系と同形で生成する。テンプレート (`template.md`) を読み、フェーズ識別子・表示名・計画ファイル・依存関係・実装者選択指針・セキュリティスコープ・対象外を確認して `.codex/skills/{phase-id}-next/SKILL.md` を書き出す。
---

# 新フェーズのオーケストレーションスキルを生成する

`phase1-next` / `phase1-5-next` と同じ「計画 → 実装 → 実装レビュー → セキュリティレビュー」の流れを、新しいフェーズ向けに複製・カスタマイズして配置する。

このスキルは 1 つの Codex skill を書き出して終わる。生成後に新スキルを実際に走らせるかはユーザーの判断。

## 重要な制約

- スキル名（`{{PHASE_ID}}`）に `.` は使わない。ユーザー入力に `.` があったら `-` に置換する。
- `{{PHASE_DISPLAY}}` と `{{PLAN_FILE}}` の `.` はそのまま残す。
- 既存スキルを上書きしない。出力先 `.codex/skills/{{PHASE_ID}}-next/SKILL.md` が存在する場合はユーザーに確認する。
- Codex ではサブエージェント利用はユーザーが明示した場合だけ。生成スキルには、通常はローカル実装し、明示依頼時のみ `spawn_agent` を使う方針を書く。

## 手順

### Step 1: フェーズ識別子の決定

ユーザー入力 `RAW` を正規化する。

- `{{PHASE_DISPLAY}}`: `Phase ` + 数字部分。例: `Phase 1.5`, `Phase 2`
- `{{PHASE_ID}}`: `phase` + 数字部分、`.` は `-` に置換。例: `phase1-5`, `phase2`
- `{{PLAN_FILE}}`: `docs/phase{数字部分}-plan.md`。例: `docs/phase1.5-plan.md`, `docs/phase2-plan.md`

正規化結果を提示し、確認を取る。`{{PLAN_FILE}}` はユーザーが上書きできる。

### Step 2: 計画ファイルからマイルストーン情報を抽出

1. `{{PLAN_FILE}}` が存在しなければ停止し、先に計画ファイルを作るよう伝える。
2. `^### M[0-9.]+:` でマイルストーン見出しを抽出する。
3. 次の値を導出する:
   - `{{MILESTONE_RANGE}}`: 例 `M0〜M8`, `M1〜M5`
   - `{{FIRST_M}}`: 最小マイルストーン
   - `{{SECOND_M}}`: その次
   - `{{MILESTONE_HEADINGS}}`: 例 `### M1:` 〜 `### M5:`
4. 抽出結果をユーザーに見せて確認する。

### Step 3: フェーズ固有情報の聞き取り

以下を 1 メッセージで質問する。計画ファイルから妥当な draft を提示し、ユーザーが省略したらそれを採用する。

- `{{PHASE_OVERVIEW}}`: 1〜2 段落でスコープ・前提・特徴。
- `{{DEPENDENCY_RULES}}`: マイルストーン間の依存関係。
- `{{IMPLEMENTER_PER_MILESTONE}}`: 各マイルストーンの実装難易度と、ローカル実装 / 明示依頼時の subagent 利用の目安。
- `{{SECURITY_SCOPE_RULES}}`: どのマイルストーンでセキュリティレビューを行うか。
- `{{OUT_OF_SCOPE_NOTE}}`: 本フェーズの対象外項目と参照先。

### Step 4: テンプレートを読んで置換

1. `.codex/skills/init-phase-skill/template.md` を読む。
2. 先頭コメントブロックは削除し、frontmatter から始まるようにする。
3. すべての `{{PLACEHOLDER}}` を確定値で置換する。
4. `rg '{{'` で置換漏れを確認する。

### Step 5: 書き出し

1. 出力先は `.codex/skills/{{PHASE_ID}}-next/SKILL.md`。
2. `agents/openai.yaml` も作成し、display name / short description / default prompt を `SKILL.md` と整合させる。
3. 生成パス、主要変数、次のステップを報告する。

## ガードレール

- `template.md` の構造を勝手に変えない。
- `{{PHASE_ID}}` の `.` → `-` 置換を忘れない。
- 計画ファイルの存在確認を飛ばさない。
- 既存スキルを上書きするときは必ず確認する。
- 意図が読み切れない場合は補完せず質問する。
