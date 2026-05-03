---
name: phase2-next
description: Phase 2 (M1〜M4) を 1 マイルストーンずつ逐次的に進めるオーケストレーション。`docs/phase2-plan.md` を読んで次の未完了マイルストーンを特定し、planner → implementer → implementation-reviewer → security-reviewer の順にサブエージェントを呼び、各ゲートでユーザー確認を取る。1 回の起動で **1 マイルストーンだけ** 進める（M1 をやったら M2 には自動で進まない）。
---

# Phase 2 を 1 マイルストーンずつ進める

このスキルは **1 マイルストーンを完了させたら止まる**。「次の M に進んでいいか」はユーザーが明示的に判断する。

Phase 1.5 完了後、Nanoka の中心 API である「DBモデルと API 入力/出力の境界」を確立し、`1.0.0` リリースに到達するためのフェーズ。軸は Drizzle クエリ DSL の再発明ではなく、`passwordHash` のような DB-only フィールドやレスポンス整形を安全に・速く書けるようにすること。relation / Turso adapter / `create-nanoka-app` / VSCode 拡張は 1.0.0 の必須条件にせず、1.x 系で追加する。

依存関係は M1 → M2 → M3 → M4 が基本ライン。ただし M2 の Zod 4 サポート（onboarding parity が検出した critical issue）は M1 と並行可能。

## 手順

### Step 1: 状況把握
1. `docs/phase2-plan.md` を Read で読み、すべてのマイルストーン（### M1: 〜 ### M4:）とそのチェックボックス状態を確認する。
2. **次に着手すべきマイルストーン** を特定する:
   - M1 から順に見て、配下のチェックボックスのうち 1 つでも未完了 (`- [ ]`) があるマイルストーンが対象。
   - 依存関係は M1 → M2 → M3 → M4 が基本ライン。ただし M2 の Zod 4 サポートは M1 と並行可能。前提マイルストーン未達のまま次に進める場合は警告を出してユーザー確認を取る。
   - すべてのマイルストーンが完了済みなら「Phase 2 完了」と報告して終了。
3. 対象マイルストーンの「完了基準」と未完了タスク一覧をユーザーに 1 メッセージで提示し、**「このマイルストーンに着手していいか」を確認**。
   - ユーザーが別マイルストーンを指定したらそれに従う。
   - ユーザーが No と言ったら、その理由を聞いて止まる。

### Step 2: プラン策定（planner エージェント）
1. `Agent` ツールで `subagent_type: "planner"` を呼び出す。プロンプトには以下を含める:
   - 対象マイルストーン名
   - そのマイルストーンの未完了チェックボックスを **すべて** 列挙
   - 「対象マイルストーンの範囲だけで計画を作ること。次の M には進まないこと」を明示
   - Phase 2 後半 / Phase 3 候補（relation / Turso・libSQL adapter / 型安全クエリビルダー / `create-nanoka-app` / route-level OpenAPI / Swagger UI / VSCode 拡張）および受容リスクは本フェーズ対象外（`docs/backlog.md` §2 / §3.5 / §4.10 の管轄）。次フェーズ機能を混入させないこと。
2. planner の返答を **そのままユーザーに見せる**（要約しない。プランは実装の契約なので原文が重要）。
3. **ユーザーの承認を取る**。修正要求があれば planner を再度呼び、確定するまで loop。

### Step 3: 実装（implementer エージェント）

#### 3-0: 実装者の選択（haiku か sonnet か）

着手前に、プランの性質を見て **どちらの実装者を呼ぶか決める**:

- **`implementer`（haiku, デフォルト）** — 機械的な編集、明確に一直線で書ける実装、コメント/JSDoc 修正、ファイル名変更、簡単なテスト追加、YAML / Markdown 編集など。安くて速い。
- **`implementer-sonnet`（sonnet）** — 以下のいずれかを含むプランで使う:
  - 型システムの設計（generic / 条件型 / `infer` / mapped types を組み立てる）
  - 複数ライブラリの型統合（Hono + Zod + Drizzle の generic を透過させる等）
  - 4 ファイル以上を横断する変更
  - 「型を `as any` で逃げず精緻型で実装する」が成否のクリティカルパスになるタスク
  - 過去に haiku 版で失敗した類似タスク（`docs/phase1-plan.md` の M5 の経緯参照）

Phase 2 のマイルストーン別の目安:
- **M1（API 境界）**: `implementer-sonnet`。`serverOnly` / `writeOnly` / `readOnly` の意味論を `inputSchema` / `outputSchema` / validator preset に透過させる必要があり、Hono + Zod + Drizzle の generic 統合と多ファイル横断（model / router / schema 派生）が必須。
- **M2（型と互換性）**: `implementer-sonnet`。フィールドアクセサ API（`as const` 固定、Proxy 禁止）、Zod 4 の generic 順序変更対応、`CreateInput` / `UpdateInput` の精緻化、`noExplicitAny` 削減と完全に型システム中心。
- **M3（OpenAPI seed）**: `implementer-sonnet`。モデル単位の JSON Schema / OpenAPI component 生成。フィールドポリシーが `required` / `readOnly` / `writeOnly` に正しく落ちる必要があり、snapshot test と schema 派生が複数モジュールに跨る。
- **M4（1.0.0 リリース準備）**: `implementer`（haiku）が原則。CHANGELOG / README 整備 / `package.json` の version bump / publish dry-run など機械的タスクが中心。ただし「破壊的変更候補の取り込み」が出てきたら個別に sonnet 判断。

判断に迷ったら sonnet を選ぶ（コスト差より失敗→再実行のロスの方が大きい）。プラン承認時にユーザーに「この実装は sonnet で進めます」と一言伝えること。

#### 3-1: 実装の実行

1. `Agent` ツールで `subagent_type: "implementer"` または `subagent_type: "implementer-sonnet"` を呼ぶ。プロンプトには以下を含める:
   - 確定したプランの全文
   - 「プランに書かれた変更だけを行うこと」を明示
   - 「サブタスク完了ごとに `docs/phase2-plan.md` の該当チェックボックスを更新すること」を明示
2. implementer から完了報告が返ってきたら、変更ファイル一覧とテスト結果をユーザーに見せる。
3. implementer がプランから逸脱せざるを得なかった旨を報告した場合は、**そこで一度止めてユーザーに確認**。勝手に次に進まない。
4. **haiku 版が以下の失敗パターンを示したら sonnet 版に切り替える**:
   - プランで指定された型を `any` にスタブして「完了」と報告した
   - 既に行った修正を `git checkout` などで巻き戻した
   - ツールエラーを「権限がロック」のような曖昧な言葉で諦めた
   - 同じプランで 2 回続けてプラン未達を報告した

### Step 4: 実装レビュー（implementation-reviewer エージェント）
1. `Agent` ツールで `subagent_type: "implementation-reviewer"` を呼ぶ。プロンプトには:
   - 対象マイルストーン名
   - 確定したプラン
   - implementer の完了報告（変更ファイル一覧）
   - 参照すべきドキュメント: `docs/nanoka.md` / `docs/phase2-plan.md` / `docs/backlog.md`
2. レビュー結果をユーザーに見せる。
3. **Critical / Major 指摘がある場合**: 修正のために implementer を再度呼ぶ。修正後、再レビュー。Critical / Major がゼロになるまで繰り返す。
4. Minor 指摘のみなら、ユーザーに「Minor 指摘を反映するか / 後回しにするか」を確認。

### Step 5: セキュリティレビュー（security-reviewer エージェント）

Phase 2 は API 境界・外部入力検証・機密フィールドの取り扱いが中心。以下のマイルストーンで `security-reviewer` を呼ぶ:
- **M1（必須）**: `serverOnly` で機密フィールド（`passwordHash` 等）が API output から確実に除外されること、`t.json(zodSchema)` で外部入力が runtime 検証されること、validator preset が用途に応じた制限を正しくかけることを確認。
- **M2（必須）**: Zod 4 移行で validator の挙動が変わる可能性、フィールドアクセサ API がタイポで意図しないフィールドを公開しないことを確認。
- **M3（必須）**: OpenAPI component に `serverOnly` フィールドが漏れていないこと、`required` / `readOnly` / `writeOnly` の意味論が正しく反映されることを確認（漏えい経路になりうる）。
- **M4（限定）**: 主に publish flow（npm Trusted Publisher OIDC / tag push）周辺のみ対象。CHANGELOG / README 整備自体はスキップ可。

1. `Agent` ツールで `subagent_type: "security-reviewer"` を呼ぶ。プロンプトには変更ファイル一覧と該当マイルストーンを伝える。
2. Critical / Major 指摘があれば implementer を呼んで修正、再レビュー。
3. 結果をユーザーに見せる。

### Step 6: 完了処理
1. `docs/phase2-plan.md` の該当マイルストーンのチェックボックスがすべて埋まっていることを確認。埋まっていなければ更新。
2. マイルストーン直下の「完了基準」のコマンドが実行可能なら、ユーザーに「完了基準を実行して回帰確認していいか」を聞く。実行する場合は Bash で実行。
3. ユーザーに以下のサマリを 1 メッセージで提示し、**ここで停止**:
   ```
   ✅ {マイルストーン名} 完了
   - 変更ファイル: ...
   - チェックボックス: N 件すべて埋め
   - 次のマイルストーン候補: {次のM 候補} — 着手しますか？
   ```
4. **次のマイルストーンには自動で進まない**。ユーザーが「次へ」と言ったら、このスキルをもう一度起動してもらう（または新しい指示を出してもらう）。

## ガードレール

- **1 回の起動で 1 マイルストーンだけ**。複数マイルストーンを跨いではいけない。
- **ユーザー確認ゲートを飛ばさない**:
  - Step 1 の着手確認
  - Step 2 のプラン承認
  - Step 4 / 5 のレビュー結果確認
  - Step 6 の完了サマリ後の次マイルストーン判断
- **planner / implementer / reviewer の役割を混同しない**。あなた（このスキルを実行する Claude）はオーケストレータ。コードを直接書かず、レビューも直接行わない。サブエージェントの結果を仲介する。
- **エージェントの返答を要約しすぎない**。特に planner のプランは実装の契約なので、ユーザーが原文を見られるようにする。
- **`docs/phase2-plan.md` の更新タイミングを守る**: implementer がサブタスク単位で更新する。オーケストレータが事前に勝手にチェックを入れない。
- **依存関係を尊重する**: 前提マイルストーン未達のまま次に進めない（依存関係は M1 → M2 → M3 → M4 が基本ライン。ただし M2 の Zod 4 サポートは M1 と並行可能。前提マイルストーン未達のまま次に進める場合は警告を出してユーザー確認を取る。）。
- **Phase 2 後半 / Phase 3 候補（relation / Turso・libSQL adapter / 型安全クエリビルダー / `create-nanoka-app` / route-level OpenAPI / Swagger UI / VSCode 拡張）および受容リスクは本フェーズ対象外（`docs/backlog.md` §2 / §3.5 / §4.10 の管轄）。次フェーズ機能を混入させないこと。**
- 途中でエラー・矛盾・スコープ膨張を検知したら、自動で続行せず **ユーザーに判断を仰ぐ**。

## 引数

引数で特定マイルストーンを指定された場合（例: `/phase2-next M3`）は、Step 1 の自動判定を上書きしてそのマイルストーンを対象にする。ただし依存マイルストーンが未完了なら警告を出してユーザー確認。
