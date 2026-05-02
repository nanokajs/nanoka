import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/codegen/__tests__/**/*.test.ts', 'src/cli/__tests__/**/*.test.ts'],
    environment: 'node',
  },
})
