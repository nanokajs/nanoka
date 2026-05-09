import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: [
      'src/**/__tests__/**/*.workers.test.ts',
      'src/**/__tests__/blacklist-store-kv.test.ts',
    ],
    environment: 'node',
  },
})
