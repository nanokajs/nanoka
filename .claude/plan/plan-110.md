# Plan #110: @nanokajs/auth Workers ランタイム E2E テスト追加

Branch: issue-110-auth-workers-e2e

## 実装ステップ

- [x] `packages/nanoka-auth/test/migrations/0000_users.sql` を新規作成（id / email / passwordHash / createdAt の最小スキーマ）
- [x] `packages/nanoka-auth/vitest.config.ts` を編集（D1 binding と migrations 読み込みを追加）
- [x] `packages/nanoka-auth/package.json` を編集（devDependencies に drizzle-orm / zod を追加、version を patch bump）
- [x] `packages/nanoka-auth/src/__tests__/e2e.workers.test.ts` を新規作成（D1 + createAuth 全レイヤー E2E テスト 4 シナリオ）
- [x] `packages/nanoka-auth/tsconfig.json` を確認・必要なら編集（e2e.workers.test.ts が型チェック対象に含まれることを確認）
