import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2025-04-01',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: ['DB'],
      },
    }),
  ],
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      'src/codegen/__tests__/**',
      'src/cli/__tests__/**',
      'src/adapter/__tests__/turso.test.ts',
    ],
  },
})
