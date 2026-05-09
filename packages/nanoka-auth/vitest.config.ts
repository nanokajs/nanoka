import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations('./test/migrations')

  return {
    test: {
      include: ['src/**/__tests__/**/*.test.ts'],
      exclude: ['src/**/__tests__/rotation.test.ts'],
      poolOptions: {
        workers: {
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
        },
      },
    },
  }
})
