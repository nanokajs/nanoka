---
name: issue-next
description: GitHub Issue を 1 件処理する実装オーケストレーション。Issue 番号を引数に受け取り、`gh issue view` で内容を取得してから planner → implementer → implementation-reviewer → security-reviewer の順にサブエージェントを呼ぶ。1 回の起動で **1 Issue だけ** 処理し、完了後に Issue をクローズして終了する。
---

# GitHub Issue を 1 件実装して閉じる

このスキルは **Issue 1 件を完了させたら止まる**。次の Issue に進むかはユーザーが判断する。

## 手順

### Step 1: Issueの取得とブランチ準備

1. 引数で Issue 番号が指定されていない場合、ユーザーに番号を聞く。
2. `gh issue view {番号} --json number,title,body,labels,assignees,milestone,state` で Issue を取得する。
3. デフォルトブランチ（`main`）を最新にする:
   ```bash
   git checkout main && git pull origin main
   ```
4. Issue 番号をもとに作業ブランチを切る:
   ```bash
   git checkout -b issue-{番号}-{kebab-case-summary}
   ```
   ブランチ名の `{kebab-case-summary}` は Issue タイトルから 3〜5 語程度の英語 kebab-case で付ける。

### Step 2: Issue の確認

1. Issue の内容（タイトル・本文・ラベル・マイルストーン）をユーザーに見せ、**「この Issue を実装していいか」を確認**する。
   - `state: closed` の場合は警告を出してユーザー確認。
   - ユーザーが No と言ったらその理由を聞いて終了。
2. `docs/implementation-status.md` を Read して、Issue が既存の実装済み範囲・対象外範囲と衝突していないか確認する。衝突がある場合はユーザーに提示して判断を仰ぐ。

### Step 3: プラン策定（planner エージェント）

1. `Agent` ツールで `subagent_type: "planner"` を呼び出す。プロンプトには以下を含める:
   - Issue 番号・タイトル・本文の全文
   - 「Issue のスコープだけで計画を作ること。関連しない改善や追加機能は含めないこと」を明示
   - `docs/nanoka.md` の load-bearing architectural rules を守ること
   - 「関連ファイルを先に Read してから計画を立てること」を明示
2. planner の返答を**そのままユーザーに見せる**（要約しない。プランは実装の契約なので原文が重要）。
3. **ユーザーの承認を取る**。修正要求があれば planner を再度呼び、確定するまでループ。

### Step 4: 実装（implementer エージェント）

#### 4-0: 実装者の選択（haiku か sonnet か）

着手前に、プランの性質を見て**どちらの実装者を呼ぶか決める**:

- **`implementer`（haiku, デフォルト）** — 機械的な編集、明確に一直線で書ける実装、コメント修正、ファイル名変更、簡単なテスト追加など。安くて速い。
- **`implementer-sonnet`（sonnet）** — 以下のいずれかを含む場合:
  - 型システムの設計（generic / 条件型 / `infer` / mapped types を組み立てる）
  - 複数ライブラリの型統合（Hono + Zod + Drizzle の generic を透過させる等）
  - 4 ファイル以上を横断する変更
  - 「型を `as any` で逃げず精緻型で実装する」が成否のクリティカルパスになるタスク

判断に迷ったら sonnet を選ぶ（コスト差より失敗→再実行のロスの方が大きい）。プラン承認時にユーザーに「この実装は sonnet で進めます」と一言伝えること。

#### 4-1: 実装の実行

1. `Agent` ツールで `subagent_type: "implementer"` または `subagent_type: "implementer-sonnet"` を呼ぶ。プロンプトには以下を含める:
   - 確定したプランの全文
   - 「プランに書かれた変更だけを行うこと」を明示
   - Issue 番号（後の PR 作成で使う）
2. implementer から完了報告が返ってきたら、変更ファイル一覧とテスト結果をユーザーに見せる。
3. implementer がプランから逸脱せざるを得なかった旨を報告した場合は、**そこで一度止めてユーザーに確認**。勝手に次に進まない。
4. **haiku 版が以下の失敗パターンを示したら sonnet 版に切り替える**:
   - プランで指定された型を `any` にスタブして「完了」と報告した
   - 既に行った修正を `git checkout` などで巻き戻した
   - ツールエラーを「権限がロック」のような曖昧な言葉で諦めた
   - 同じプランで 2 回続けてプラン未達を報告した

### Step 5: 実装レビュー（implementation-reviewer エージェント）

1. `Agent` ツールで `subagent_type: "implementation-reviewer"` を呼ぶ。プロンプトには:
   - Issue 番号・タイトル
   - 確定したプラン
   - implementer の完了報告（変更ファイル一覧）
   - 参照すべきドキュメント: `docs/nanoka.md` / `docs/implementation-status.md`
2. レビュー結果をユーザーに見せる。
3. **Critical / Major 指摘がある場合**: 修正のために implementer を再度呼ぶ。修正後、再レビュー。Critical / Major がゼロになるまで繰り返す。
4. Minor 指摘のみなら、ユーザーに「Minor 指摘を反映するか / 後回しにするか」を確認。

### Step 6: セキュリティレビュー（security-reviewer エージェント）

以下のいずれかに触れる変更がある場合のみ実行:
- HTTP body / params / query / headers の処理
- Zod バリデータや Hono バリデーション
- DB クエリ構築・Drizzle エスケープハッチ・D1/Turso アダプタ・バッチ動作
- OpenAPI 生成（バリデーション/強制のソースとして扱われる可能性がある場合）
- 認証・認可・セッション・トークン・API キー・シークレット
- CORS・リダイレクト・外部 fetch・ロギング・エラーメッセージ
- 新しい npm 依存関係

判断に迷ったら実行する。

1. `Agent` ツールで `subagent_type: "security-reviewer"` を呼ぶ。プロンプトには変更ファイル一覧と Issue 概要を伝える。
2. Critical / Major 指摘があれば implementer を呼んで修正、再レビュー。
3. 結果をユーザーに見せる。

### Step 7: 完了処理

1. `docs/implementation-status.md` に変更が反映すべき内容があれば更新する（shipped API 変更・新機能追加時など）。
2. 完了確認コマンドがある場合（テスト・typecheck など）、ユーザーに「実行して回帰確認していいか」を聞く。実行する場合は Bash で実行。
3. **ユーザーに以下のサマリを 1 メッセージで提示し、PR を出していいか確認する**:
   ```
   ✅ #{Issue番号} {タイトル} 完了
   - 変更ファイル: ...
   - テスト: ...
   - docs 更新: ...
   PR を作成してよいですか？
   ```
4. ユーザーが Yes なら:
   - 変更をコミット（未コミットの場合）:
     ```bash
     git add <変更ファイル>
     git commit -m "feat/fix/...: {タイトル} (#{番号})"
     ```
   - ブランチを push:
     ```bash
     git push -u origin {ブランチ名}
     ```
   - PR を作成（`Closes #{番号}` を body に含める）:
     ```bash
     gh pr create --title "..." --body "..."
     ```
   - PR URL をユーザーに見せる。
5. **ここで停止**。Issue のクローズは PR マージ時に自動で行われる（`Closes #番号` による）。次の Issue に進むかはユーザーが判断する。

## ガードレール

- **1 回の起動で 1 Issue だけ**。複数 Issue を跨いではいけない。
- **ユーザー確認ゲートを飛ばさない**:
  - Step 1 の着手確認
  - Step 2 のプラン承認
  - Step 4 / 5 のレビュー結果確認
  - Step 6 の PR 作成確認
- **planner / implementer / reviewer の役割を混同しない**。このスキルを実行する Claude はオーケストレータ。コードを直接書かず、レビューも直接行わない。サブエージェントの結果を仲介する。
- **エージェントの返答を要約しすぎない**。特に planner のプランは実装の契約なので、ユーザーが原文を見られるようにする。
- Issue のスコープを超えた改善・リファクタリングは提案に留め、実装しない。
- 途中でエラー・矛盾・スコープ膨張を検知したら、自動で続行せず**ユーザーに判断を仰ぐ**。
- `docs/nanoka.md` の load-bearing architectural rules に反する変更を検知したらブロックしてユーザーに確認。

## 引数

`/issue-next {番号}` の形式で Issue 番号を直接渡せる。番号を省略した場合は Step 1 で質問する。

例:
- `/issue-next 42` — Issue #42 を処理
- `/issue-next` — Issue 番号を対話的に確認
