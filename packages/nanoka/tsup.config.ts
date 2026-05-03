import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    config: 'src/config.ts',
    cli: 'src/cli/index.ts',
  },
  format: ['esm'],
  dts: true,
  external: ['@libsql/client', 'drizzle-orm/libsql'],
  sourcemap: true, // intentional: published to npm for debuggability; no absolute paths leak (relative only)
  clean: true,
  target: 'es2022',
  treeshake: true,
})
