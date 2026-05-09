import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations('./drizzle/migrations')

  return {
    test: {
      include: ['test/**/*.test.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.jsonc' },
          miniflare: {
            compatibilityDate: '2025-04-01',
            compatibilityFlags: ['nodejs_compat'],
            d1Databases: ['DB'],
            bindings: {
              TEST_MIGRATIONS: migrations,
              // テスト専用のダミー秘密鍵。本番・staging の `wrangler.jsonc` `vars` や
              // `wrangler secret put` の値として絶対に流用しないこと。
              AUTH_SECRET: 'test-only-32-byte-secret-for-vitest-environment-x',
            },
          },
        },
      },
    },
  }
})
