import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations('./test/migrations')

      return {
        miniflare: {
          compatibilityDate: '2025-04-01',
          compatibilityFlags: ['nodejs_compat'],
          d1Databases: ['DB'],
          kvNamespaces: ['BLACKLIST_KV'],
          bindings: {
            TEST_MIGRATIONS: migrations,
            AUTH_SECRET: 'test-secret-for-e2e-testing-32chars!!',
          },
        },
      }
    }),
  ],
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: ['src/**/__tests__/rotation.test.ts'],
  },
})
