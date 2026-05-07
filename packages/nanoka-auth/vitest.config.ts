// TODO(#110): defineWorkersConfig を非同期ファクトリ形式に変更する。
//   readD1Migrations を '@cloudflare/vitest-pool-workers/config' からインポートして
//   migrations を await readD1Migrations('./test/migrations') で読み込み、
//   miniflare.bindings に { TEST_MIGRATIONS: migrations } として渡す。
//   これにより e2e.workers.test.ts 内で env.TEST_MIGRATIONS が利用可能になる。
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

// TODO(#110): d1Databases の設定を追加する。
//   miniflare に d1Databases: ['DB'] を追加することで、Workers ランタイム上で
//   env.DB として D1Database にアクセスできるようになる。
//   D1 binding 名は 'DB' とし、e2e.workers.test.ts の ProvidedEnv 宣言と一致させる。
export default defineWorkersConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: '2025-04-01',
          compatibilityFlags: ['nodejs_compat'],
          // TODO(#110): ここに d1Databases と bindings を追加する。
          //   d1Databases: ['DB'],
          //   bindings: { TEST_MIGRATIONS: migrations },
          //   migrations は上位の async ファクトリ関数内で readD1Migrations により読み込む。
        },
      },
    },
  },
})
