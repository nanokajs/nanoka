export const contentEn = `\
# CLI Reference

## nanoka generate

Generates a Drizzle schema file from your Nanoka model definitions and optionally runs the full migration pipeline.

\`\`\`bash
npx nanoka generate [options]
\`\`\`

**Options:**

| Option | Argument | Default | Description |
|---|---|---|---|
| \`--config\` | path | \`./nanoka.config.ts\` | Path to nanoka.config.ts |
| \`--output\` | path | (from config) | Override output file path |
| \`--no-migrate\` | — | — | Generate schema only, skip migration steps |
| \`--apply\` | — | — | Run drizzle-kit generate + wrangler d1 migrations apply |
| \`--db\` | name | (from config) | D1 database name |
| \`--remote\` | — | — | Apply migrations to remote D1 (passes --remote to wrangler) |
| \`--package-manager\` | pm | \`npx\` | Package manager: npx / pnpm / npm / yarn / bun |

### Examples

\`\`\`bash
# Generate Drizzle schema and run drizzle-kit generate
npx nanoka generate

# Use a custom config file path
npx nanoka generate --config ./custom/nanoka.config.ts

# Generate schema only, skip drizzle-kit and wrangler
npx nanoka generate --no-migrate

# Full pipeline: generate schema, run drizzle-kit, apply to local D1
npx nanoka generate --apply --db my-database

# Full pipeline with remote deploy using pnpm
npx nanoka generate --apply --db my-database --remote --package-manager pnpm
\`\`\`

## nanoka.config.ts

The config file is read by \`nanoka generate\` to discover models and configure the migration pipeline.

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| \`output\` | string | \`./drizzle/schema.ts\` | Drizzle schema output file path |
| \`models\` | Model[] | required | Array of Nanoka model definitions |
| \`migrate.drizzleConfig\` | string | \`./drizzle.config.ts\` | Path to drizzle.config.ts |
| \`migrate.database\` | string | — | D1 database name for wrangler |
| \`migrate.packageManager\` | string | \`npx\` | Package manager for CLI commands |

\`\`\`typescript
import { defineConfig } from '@nanokajs/core/config'
import { User } from './src/models/user'
import { Post } from './src/models/post'

export default defineConfig({
  output: './drizzle/schema.ts',
  models: [User, Post],
  migrate: {
    drizzleConfig: './drizzle.config.ts',
    database: 'my-database',
    packageManager: 'pnpm',
  },
})
\`\`\`

## create-nanoka-app

Scaffold a new Nanoka project with a default template.

\`\`\`bash
pnpm create nanoka-app <dir>
npx create-nanoka-app <dir>
\`\`\`

**Options:**

| Option | Argument | Description |
|---|---|---|
| \`--template\` | \`default\` | Use the default template |
| \`--force\` | — | Overwrite existing directory |
| \`--help\` | — | Show help |
| \`--version\` | — | Show version |

### Generated Files

| Path | Description |
|---|---|
| \`package.json\` | Project dependencies and scripts |
| \`wrangler.jsonc\` | Wrangler configuration with D1 binding |
| \`tsconfig.json\` | TypeScript configuration |
| \`drizzle.config.ts\` | Drizzle-kit configuration |
| \`nanoka.config.ts\` | Nanoka model and migration configuration |
| \`.gitignore\` | Standard gitignore for Node/Wrangler projects |
| \`README.md\` | Quickstart instructions |
| \`src/index.ts\` | Worker entry point with example routes |
| \`src/models/posts.ts\` | Post model as a starting example |

The \`src/models/posts.ts\` file defines a \`Post\` model with \`id\`, \`title\`, \`body\`, \`published\`, and \`createdAt\` fields. Edit or replace it with your own models.

### Next Steps

After scaffolding, run the following commands to get your project running:

\`\`\`bash
# 1. Install dependencies
pnpm install

# 2. Generate the Drizzle schema from model definitions
pnpm exec nanoka generate

# 3. Generate SQL migration files
pnpm exec drizzle-kit generate

# 4. Create the D1 database if needed
npx wrangler d1 create my-database

# 5. Apply migrations to local D1
pnpm exec wrangler d1 migrations apply my-database --local

# 6. Start the local dev server
pnpm dev
\`\`\`
`

export const contentJa = `\
# CLI Reference

## nanoka generate

Nanoka モデル定義から Drizzle スキーマファイルを生成し、オプションでマイグレーションパイプライン全体を実行します。

\`\`\`bash
npx nanoka generate [options]
\`\`\`

**オプション:**

| オプション | 引数 | デフォルト | 説明 |
|---|---|---|---|
| \`--config\` | path | \`./nanoka.config.ts\` | nanoka.config.ts へのパス |
| \`--output\` | path | （config から）| 出力ファイルパスを上書き |
| \`--no-migrate\` | — | — | スキーマ生成のみ、マイグレーション手順をスキップ |
| \`--apply\` | — | — | drizzle-kit generate + wrangler d1 migrations apply を実行 |
| \`--db\` | name | （config から）| D1 データベース名 |
| \`--remote\` | — | — | リモート D1 にマイグレーションを適用（wrangler に --remote を渡す）|
| \`--package-manager\` | pm | \`npx\` | パッケージマネージャ: npx / pnpm / npm / yarn / bun |

### 使用例

\`\`\`bash
# Drizzle スキーマを生成して drizzle-kit generate を実行
npx nanoka generate

# カスタム設定ファイルパスを使用
npx nanoka generate --config ./custom/nanoka.config.ts

# スキーマ生成のみ、drizzle-kit と wrangler をスキップ
npx nanoka generate --no-migrate

# フルパイプライン: スキーマ生成・drizzle-kit 実行・ローカル D1 への適用
npx nanoka generate --apply --db my-database

# pnpm を使ってリモートデプロイするフルパイプライン
npx nanoka generate --apply --db my-database --remote --package-manager pnpm
\`\`\`

## nanoka.config.ts

設定ファイルは \`nanoka generate\` がモデルを検出してマイグレーションパイプラインを設定するために読み込まれます。

**オプション:**

| オプション | 型 | デフォルト | 説明 |
|---|---|---|---|
| \`output\` | string | \`./drizzle/schema.ts\` | Drizzle スキーマの出力ファイルパス |
| \`models\` | Model[] | 必須 | Nanoka モデル定義の配列 |
| \`migrate.drizzleConfig\` | string | \`./drizzle.config.ts\` | drizzle.config.ts へのパス |
| \`migrate.database\` | string | — | wrangler 用 D1 データベース名 |
| \`migrate.packageManager\` | string | \`npx\` | CLI コマンド用パッケージマネージャ |

\`\`\`typescript
import { defineConfig } from '@nanokajs/core/config'
import { User } from './src/models/user'
import { Post } from './src/models/post'

export default defineConfig({
  output: './drizzle/schema.ts',
  models: [User, Post],
  migrate: {
    drizzleConfig: './drizzle.config.ts',
    database: 'my-database',
    packageManager: 'pnpm',
  },
})
\`\`\`

## create-nanoka-app

デフォルトテンプレートで新しい Nanoka プロジェクトをスキャフォールドします。

\`\`\`bash
pnpm create nanoka-app <dir>
npx create-nanoka-app <dir>
\`\`\`

**オプション:**

| オプション | 引数 | 説明 |
|---|---|---|
| \`--template\` | \`default\` | デフォルトテンプレートを使用 |
| \`--force\` | — | 既存ディレクトリを上書き |
| \`--help\` | — | ヘルプを表示 |
| \`--version\` | — | バージョンを表示 |

### 生成されるファイル

| パス | 説明 |
|---|---|
| \`package.json\` | プロジェクトの依存パッケージとスクリプト |
| \`wrangler.jsonc\` | D1 バインディングを含む Wrangler 設定 |
| \`tsconfig.json\` | TypeScript 設定 |
| \`drizzle.config.ts\` | Drizzle-kit 設定 |
| \`nanoka.config.ts\` | Nanoka モデルとマイグレーション設定 |
| \`.gitignore\` | Node/Wrangler プロジェクト用の標準 gitignore |
| \`README.md\` | クイックスタート手順 |
| \`src/index.ts\` | サンプルルート付きの Worker エントリポイント |
| \`src/models/posts.ts\` | 開始例としての Post モデル |

\`src/models/posts.ts\` には \`id\`・\`title\`・\`body\`・\`published\`・\`createdAt\` フィールドを持つ \`Post\` モデルが定義されています。自分のモデルに編集または置き換えてください。

### 次のステップ

スキャフォールド後、以下のコマンドでプロジェクトを起動します:

\`\`\`bash
# 1. 依存パッケージをインストール
pnpm install

# 2. モデル定義から Drizzle スキーマを生成
pnpm exec nanoka generate

# 3. SQL マイグレーションファイルを生成
pnpm exec drizzle-kit generate

# 4. 必要に応じて D1 データベースを作成
npx wrangler d1 create my-database

# 5. ローカル D1 にマイグレーションを適用
pnpm exec wrangler d1 migrations apply my-database --local

# 6. ローカル開発サーバを起動
pnpm dev
\`\`\`
`
