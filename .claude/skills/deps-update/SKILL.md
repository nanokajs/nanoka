---
name: deps-update
description: 依存関係の更新調査から PR 作成・Issue 起票までを段階的に進めるワークフロー。pnpm outdated / audit を起点に「即対応可能（caret 範囲内・advisory 解消）」と「major 評価が必要」を切り分け、前者を 1 つの patch PR にまとめ、後者を個別 Issue として起票する。
---

# 依存関係更新ワークフロー

このスキルは **1 回の起動で「調査 → 即対応 PR → 残課題 Issue 化」を順に進める**。各フェーズの最後にユーザー確認ゲートを置く。

## フェーズ全体図

```
Phase 1: 調査
   ↓ ユーザー確認（即対応するか / 報告だけか）
Phase 2: 即対応 PR（caret 範囲内 + pnpm.overrides 追従）
   ↓ ユーザー確認（残課題を Issue 化するか）
Phase 3: 既存 advisory Issue 更新 + major bump Issue 起票
```

途中で停止する指示があれば、そのフェーズの完了報告だけ出してスキルを終了する。

## Phase 1: 調査

### 1-1: outdated / audit の取得

```bash
pnpm outdated -r
pnpm audit --audit-level moderate
```

出力をパースして以下のテーブル形式でユーザーに提示する：

- **🔴 修正推奨（advisory が現コードに該当）** — patched range と現バージョンの関係、`pnpm.overrides` の現値が patched を満たしているか
- **🟢 安全な patch/minor**（caret 範囲内）
- **🟡 major / pre-1.0 bump** — peer / 利用者影響あり、別途評価
- **🛡️ Accepted risk（既存 Issue）** — `gh issue list --state open` で既存トラッキング Issue を確認、advisory の patched と現 override 値の整合をチェック

### 1-2: 既存 Issue との突き合わせ

調査結果に含まれる advisory のうち、既に open Issue で受容リスクとして扱われているものは明示する：

```bash
gh issue list --state open --search "deps OR advisory OR accepted risk" --limit 30
```

過去に「受容済み」とされた override の値が、現在の advisory の patched 範囲を満たさなくなっている場合は必ず指摘する（このリポでは `devalue >=5.6.4 → >=5.8.1` のように override 値の更新で解消できるケースが過去にあった）。

### 1-3: 推奨アクション提示

調査結果と一緒に、以下を提案する：

1. **即対応 PR**: 該当 advisory の patched バージョンを満たすところまで、caret 範囲内で lockfile を最新化
2. **既存 Issue ステータス更新**: override が patched に達していない / 連動切替に依存する旨をコメントで追記
3. **major bump Issue 起票候補**: 1 つ 1 つ独立評価が必要なものを列挙

ここで「対応してください」「Issue 化してほしい」「報告だけでよい」のいずれかをユーザーに選ばせる。

---

## Phase 2: 即対応 PR

ユーザーが Phase 2 への進行を承認した場合のみ実行。

### 2-1: `pnpm.overrides` の更新

`pnpm audit` の出力から、現在の override 値が advisory の patched range を満たしていないものを見つけて、root `package.json` の `pnpm.overrides` を編集する。

```jsonc
{
  "pnpm": {
    "overrides": {
      "devalue": ">=5.8.1"  // ← patched 範囲に合わせる
    }
  }
}
```

注意：

- `wrangler: ">=X <4.0.0"` のように **意図的にメジャーを固定している override は触らない**。固定理由（vitest-pool-workers との互換等）が CLAUDE.md / コメント / 既存 Issue にあるはず。
- `undici` v6 系への切替など、transitive 依存の major 切替が必要なものは Phase 2 では扱わない（Phase 3 で Issue 化）。

### 2-2: caret 範囲内更新

```bash
pnpm update -r
```

`pnpm update -r` は `package.json` の caret 範囲を **その時点の最新解決バージョンに自動で書き上げる**（pnpm 9.x のデフォルト挙動）。これにより：

- `devDependencies` / `dependencies` の caret 最低値は新しくなる
- `peerDependencies` は **触られない**（明示確認すること）

### 2-3: peerDependencies 不変の確認

```bash
git diff packages/*/package.json examples/*/package.json | grep -A 5 peerDependencies
```

`peerDependencies` セクションに差分が出ていれば停止してユーザーに確認。利用者影響があるので patch リリースの範囲を超える。

### 2-4: 検証

順に実行し、失敗があれば修正してから次へ：

```bash
pnpm lint                              # error 0 を確認（warning は既存）
pnpm build                             # 全パッケージビルド成功
pnpm -r test                           # またはパッケージ個別の test:workers / test:node
pnpm -C packages/nanoka typecheck
pnpm -C packages/nanoka-auth typecheck
pnpm -C examples/basic typecheck
pnpm format                            # 最後に format
```

### 2-5: バージョン bump と CHANGELOG

CLAUDE.md の versioning policy に従う：

- `packages/nanoka` と `packages/create-nanoka-app` は **同じバージョン番号** を共有
- `packages/nanoka-auth` は **独立**（タグ prefix も `auth-v`）
- 依存更新は **patch bump**（tooling / 内部依存変更）

該当する 3 つの `package.json` の `version` を patch bump し、各 `CHANGELOG.md` 先頭に追記：

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Security

- `<pkg>` を A.B.C → X.Y.Z に更新（advisory ID と内容を 1 行で）。実害評価を 1 文。

### Changed

- devDep / 内部依存の lockfile を caret 範囲内の最新へ追従（具体名を 2〜3 個列挙）。peerDependencies の範囲は変更なし。
```

`packages/create-nanoka-app` には CHANGELOG が存在しない場合がある（今回時点では未作成）。その場合は版数 bump のみで OK。

### 2-6: ブランチ作成とコミット

main から新ブランチを切る。CLAUDE.md / 既存運用に合わせて `chore/deps-update-{YYYY-MM}` のような命名：

```bash
git fetch origin main
git checkout main && git pull --ff-only origin main
git checkout -b chore/deps-update-{YYYY-MM}
```

作業ツリーが既に dirty な場合は `git stash` → branch 切り替え → `git stash pop` で移動する。

コミットは Conventional Commits：

```
chore(deps): bump <主要パッケージ> + lockfile refresh within caret ranges

- <pkg> X → Y で moderate advisory N 件解消（advisory ID）
- pnpm.overrides の <pkg> を A → B（advisory 解消）
- caret 範囲内で lockfile 最新化（具体名）
- @nanokajs/core A.B.C → A.B.D, ... の patch bump

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

### 2-7: push と PR 作成

```bash
git push -u origin chore/deps-update-{YYYY-MM}
```

PR 作成は `gh pr create` を HEREDOC body で（このリポは `gh` を使うフロー。GitHub MCP も可だが、依存更新は一括処理する都合上 `gh` の方が CI ログ確認等と同じ系統で扱いやすい）。

PR body の必須セクション：

1. **Summary**: 一段落で「caret 範囲内の更新だけ / peerDeps 無変更 / patched に達していない override は更新」を明示
2. **Security fixes**: advisory ID と patched range
3. **Lockfile refresh (caret 範囲内)**: 主要な bump を列挙
4. **Version bumps**: 各パッケージの before → after
5. **Out of scope**: Phase 3 で Issue 化する major bump 候補
6. **Test plan**: 実行したコマンドのチェックリスト + audit の advisory 件数差分

### 2-8: CI 失敗時の典型パターン

PR を push した直後に CI が落ちる場合、最頻ケースは以下：

**症状**: `ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date`

**原因**: `pnpm update -r` 後の lockfile の `importers` セクションで、`pnpm.overrides` 対象パッケージの specifier が override **適用前** の caret 表記（例 `^3.114.17`）のまま記録されているが、CI 側の `pnpm install --frozen-lockfile` は override **適用後** の specifier（例 `>=3.114.17 <4.0.0`）と比較するため不一致。

**修正**:

```bash
pnpm install --lockfile-only
git add pnpm-lock.yaml
git commit -m "chore(deps): sync lockfile importers spec for <pkg> override"
git push
```

これで lockfile の importers spec が override 適用後の値で再書き込みされ、CI のチェックを通過する。同じ症状を 2 回踏んだら根本原因（pnpm のバージョン差、override 設定）を疑う。

### 2-9: CI 完了待ち

```bash
gh pr checks {PR番号} --watch
```

background 実行で待ち、全 job 緑を確認したらユーザーに報告。失敗があれば該当ログを取得して原因切り分け：

```bash
gh run view {run-id} --log-failed | tail -100
```

---

## Phase 3: 既存 advisory Issue 更新 + major bump Issue 起票

Phase 2 完了後、ユーザーが Issue 化を承認した場合のみ実行。

### 3-1: 既存 advisory Issue へのステータスコメント

Phase 1 で見つかった「既存 Issue があるが override が patched に達していない / 連動切替に依存する」ものに、コメントで現状評価を追記：

```bash
gh issue comment {番号} --body "$(cat <<'EOF'
## ステータス更新（YYYY-MM-DD）

PR #XXX で依存関係を caret 範囲内で更新した時点での再評価。

### 現状

- `pnpm audit --audit-level moderate` で <pkg> < X.Y.Z 系 advisory が依然として残る：
  - GHSA-xxx — <内容> — severity
  - ...
- 残るパスは全て <transitive 経路>。
- 現在の `pnpm.overrides` は `"<pkg>": "..."` で固定中（patched 範囲 `>=X.Y.Z` を満たさない）。これは <理由> のため、override 解除は <連動切替> と同時に行う必要がある。

### 結論

<pkg> の解消は <連動切替 Issue> に強く依存する。本 Issue は `[新規 Issue #YYY] <連動切替>` の完了をもってクローズ対象とする。受容理由は変更なし（dev/CI 限定、本番 Workers runtime には影響しない）。

EOF
)"
```

### 3-2: major bump 候補の Issue 起票

Phase 1 の 🟡 リストに上がった major bump を、独立評価が可能な単位で 1 Issue ずつ起票する。連動関係がある場合は 1 Issue にまとめる（例：wrangler v4 + vitest 4 + @cloudflare/vitest-pool-workers 0.16）。

各 Issue の本文テンプレ：

```markdown
## 背景

<現バージョンと最新バージョンの差、連動関係、利用者影響の概要>

| パッケージ | 現在 | 最新 | 備考 |
|---|---|---|---|
| `pkg` | X.Y | A.B | 連動制約 |

## やること

- 破壊的変更を changelog で確認
- 該当機能（特定の API / config / テスト）が動作するか検証
- peerDependencies / 利用者影響の評価
- 関連 docs / README の更新

## 完了条件

- 全パッケージで <検証コマンド> が通る
- 利用者向け <docs / CHANGELOG> 更新

## 関連

- Issue #XX — 連動切替・依存トラッカー
- PR #YY — caret 内のみ更新、本 Issue で major を扱う
```

連動関係（例）：

- `wrangler v4` ↔ `vitest 4` ↔ `@cloudflare/vitest-pool-workers 0.16` ↔ `undici v6` ↔ `ws 8.20+` ↔ `vite 6` — 1 Issue にまとめる
- `zod v4` ↔ `@hono/zod-validator 0.8` — peer 範囲で結合、同 Issue または親子関係で
- `@libsql/client 0.17` — 単独（Turso adapter テスト）
- `drizzle-kit 0.31` — 単独
- `typescript 6` — 単独

### 3-3: Issue 起票結果のまとめ

ユーザーに以下のテーブル形式で報告：

| # | タイトル | 種別 |
|---|---|---|
| #XX（コメント） | <既存 advisory ステータス更新> | comment |
| #YY | <major bump 候補1> | new issue |
| ... | ... | ... |

---

## ガードレール

- **ユーザー確認ゲートを必ず置く**: Phase 1 → 2、Phase 2 → 3 の境界で「次に進むか」を確認する。`pnpm update -r` を実行する前、Issue 起票する前は必ず承認を取る。
- **peerDependencies は触らない**。caret 範囲内更新後に diff で必ず確認。peer に差分が出ていたら停止してユーザーに確認。
- **意図的な override は解除しない**。`wrangler: ">=3.114.17 <4.0.0"` のような major 固定 override は、固定理由（vitest-pool-workers 互換等）の文脈で設定されているので Phase 2 では触らない。Phase 3 の Issue で扱う。
- **pnpm.overrides の値が advisory の patched range を満たしているか必ず確認**。過去に「override 設定済みだから受容リスク」とされていても、現 advisory の patched にバージョンが達していないことがある。
- **CLAUDE.md の versioning policy を破らない**。`packages/nanoka` と `packages/create-nanoka-app` は同期、`packages/nanoka-auth` は独立、依存更新は patch bump。
- **CI 失敗時は最後までログを読む**。`pnpm install --frozen-lockfile` の lockfile importers spec 不整合は `pnpm install --lockfile-only` で解消。同じ症状を 2 回踏んだら根本原因を疑う（CLAUDE.md の「2 回失敗したら代替案を提案」ルールに従う）。
- **`pnpm update -r` の影響範囲を要約しすぎない**。caret 内更新でも 100 行超の lockfile diff になるのが普通。`git diff --stat` をユーザーに提示する。
- **Issue 起票テンプレ**は背景 / やること / 完了条件 / 関連 の 4 セクション。各セクションは具体的な根拠（patched range、連動制約、検証コマンド）を含める。
- **既存 Issue のクローズはしない**。advisory トラッカーは「解消をもってクローズ」が前提。Phase 3 のコメントは状態更新であってクローズではない。

## 引数

`/deps-update` を引数なしで起動した場合、Phase 1 から順に進む。

以下のショートカット引数も受け付ける（任意実装）：

- `/deps-update --report-only` — Phase 1 だけ実行して終了
- `/deps-update --apply` — Phase 1 → 2 まで進めて停止
- `/deps-update --full` — Phase 1 → 2 → 3 まで進める（各境界でユーザー確認は維持）

引数指定がない場合のデフォルトは「各フェーズ末でユーザーに確認」。
