import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { main } from '../index'

vi.mock('../run', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../run')>()
  return {
    ...actual,
    runDrizzleKitGenerate: vi.fn().mockResolvedValue(undefined),
    runWranglerApply: vi.fn().mockResolvedValue(undefined),
  }
})

import * as runModule from '../run'

describe('CLI', () => {
  it('shows help with no arguments', async () => {
    const exitCode = await main([])
    expect(exitCode).toBe(0)
  })

  it('shows help with --help', async () => {
    const exitCode = await main(['--help'])
    expect(exitCode).toBe(0)
  })

  it('returns error for unknown command', async () => {
    const exitCode = await main(['unknown'])
    expect(exitCode).toBe(1)
  })

  it('returns error for missing required config', async () => {
    const exitCode = await main(['generate', '--config', '/nonexistent/path/nanoka.config.ts'])
    expect(exitCode).toBe(1)
  })

  it('returns error with missing --output if config.output is not defined', async () => {
    const exitCode = await main(['generate', '--config', '/tmp/fake.ts'])
    expect(exitCode).toBe(1)
  })
})

describe('CLI generate with migrate flags', () => {
  const runDrizzleKitGenerate = vi.mocked(runModule.runDrizzleKitGenerate)
  const runWranglerApply = vi.mocked(runModule.runWranglerApply)

  let originalCwd: string

  beforeEach(() => {
    vi.clearAllMocks()
    originalCwd = process.cwd()
  })

  afterEach(() => {
    process.chdir(originalCwd)
    vi.restoreAllMocks()
  })

  it('calls runDrizzleKitGenerate when drizzle.config.ts exists', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')

    const dir = await mkdtemp(join(tmpdir(), 'nanoka-test-'))

    const configContent = `export default { models: [], output: '${dir}/schema.ts' }`
    await writeFile(join(dir, 'nanoka.config.ts'), configContent)
    await writeFile(join(dir, 'drizzle.config.ts'), '// drizzle config')

    process.chdir(dir)
    const resolvedCwd = process.cwd()

    const exitCode = await main(['generate'])
    expect(exitCode).toBe(0)
    expect(runDrizzleKitGenerate).toHaveBeenCalledOnce()
    expect(runDrizzleKitGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: resolvedCwd }),
    )
  })

  it('does not call runDrizzleKitGenerate with --no-migrate', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')

    const dir = await mkdtemp(join(tmpdir(), 'nanoka-test-'))

    const configContent = `export default { models: [], output: '${dir}/schema.ts' }`
    await writeFile(join(dir, 'nanoka.config.ts'), configContent)
    await writeFile(join(dir, 'drizzle.config.ts'), '// drizzle config')

    process.chdir(dir)

    const exitCode = await main(['generate', '--no-migrate'])
    expect(exitCode).toBe(0)
    expect(runDrizzleKitGenerate).not.toHaveBeenCalled()
  })

  it('calls both runDrizzleKitGenerate and runWranglerApply with --apply --db foo', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')

    const dir = await mkdtemp(join(tmpdir(), 'nanoka-test-'))

    const configContent = `export default { models: [], output: '${dir}/schema.ts' }`
    await writeFile(join(dir, 'nanoka.config.ts'), configContent)
    await writeFile(join(dir, 'drizzle.config.ts'), '// drizzle config')

    process.chdir(dir)

    const exitCode = await main(['generate', '--apply', '--db', 'foo'])
    expect(exitCode).toBe(0)
    expect(runDrizzleKitGenerate).toHaveBeenCalledOnce()
    expect(runWranglerApply).toHaveBeenCalledOnce()
    expect(runWranglerApply).toHaveBeenCalledWith(
      expect.objectContaining({ db: 'foo', remote: false }),
    )
  })

  it('returns exit 1 when --db contains invalid characters (argument smuggling)', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')

    const dir = await mkdtemp(join(tmpdir(), 'nanoka-test-'))

    const configContent = `export default { models: [], output: '${dir}/schema.ts' }`
    await writeFile(join(dir, 'nanoka.config.ts'), configContent)
    await writeFile(join(dir, 'drizzle.config.ts'), '// drizzle config')

    process.chdir(dir)

    const exitCode = await main(['generate', '--apply', '--db', 'mydb --remote'])
    expect(exitCode).toBe(1)
    expect(runWranglerApply).not.toHaveBeenCalled()
  })

  it('returns exit 1 when --apply given but no --db and no config.migrate.database', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')

    const dir = await mkdtemp(join(tmpdir(), 'nanoka-test-'))

    const configContent = `export default { models: [], output: '${dir}/schema.ts' }`
    await writeFile(join(dir, 'nanoka.config.ts'), configContent)
    await writeFile(join(dir, 'drizzle.config.ts'), '// drizzle config')

    process.chdir(dir)

    const exitCode = await main(['generate', '--apply'])
    expect(exitCode).toBe(1)
    expect(runWranglerApply).not.toHaveBeenCalled()
  })

  it('skips runDrizzleKitGenerate but still calls runWranglerApply with --no-migrate --apply --db foo', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')

    const dir = await mkdtemp(join(tmpdir(), 'nanoka-test-'))

    const configContent = `export default { models: [], output: '${dir}/schema.ts' }`
    await writeFile(join(dir, 'nanoka.config.ts'), configContent)
    await writeFile(join(dir, 'drizzle.config.ts'), '// drizzle config')

    process.chdir(dir)

    const exitCode = await main(['generate', '--no-migrate', '--apply', '--db', 'foo'])
    expect(exitCode).toBe(0)
    expect(runDrizzleKitGenerate).not.toHaveBeenCalled()
    expect(runWranglerApply).toHaveBeenCalledOnce()
    expect(runWranglerApply).toHaveBeenCalledWith(expect.objectContaining({ db: 'foo' }))
  })

  it('passes remote: true to runWranglerApply with --apply --remote', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')

    const dir = await mkdtemp(join(tmpdir(), 'nanoka-test-'))

    const configContent = `export default { models: [], output: '${dir}/schema.ts' }`
    await writeFile(join(dir, 'nanoka.config.ts'), configContent)
    await writeFile(join(dir, 'drizzle.config.ts'), '// drizzle config')

    process.chdir(dir)

    const exitCode = await main(['generate', '--apply', '--db', 'mydb', '--remote'])
    expect(exitCode).toBe(0)
    expect(runWranglerApply).toHaveBeenCalledWith(expect.objectContaining({ remote: true }))
  })
})
