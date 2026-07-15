import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations('./drizzle/migrations')

      return {
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
      }
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
  },
})
