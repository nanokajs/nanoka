import { defineConfig } from 'vitest/config'
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineConfig({
  test: {
    projects: [
      defineWorkersConfig({
        test: {
          name: 'workers',
          include: [
            'src/**/__tests__/**/*.test.ts',
            '!src/codegen/__tests__/**',
            '!src/cli/__tests__/**',
          ],
          poolOptions: {
            workers: {
              miniflare: {
                compatibilityDate: '2025-04-01',
                compatibilityFlags: ['nodejs_compat', 'export_commonjs_default'],
                d1Databases: ['DB'],
              },
            },
          },
        },
      }),
      {
        test: {
          name: 'node',
          include: [
            'src/codegen/__tests__/**/*.test.ts',
            'src/cli/__tests__/**/*.test.ts',
          ],
          environment: 'node',
        },
      },
    ],
  },
})

