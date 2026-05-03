import { access, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { copyTemplate, parseArgs, scaffold } from '../src/index'

async function makeTmpDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'create-nanoka-app-test-'))
}

test('scaffold creates package.json with correct name', async () => {
  const tmp = await makeTmpDir()
  const targetDir = join(tmp, 'my-project')

  await scaffold({ targetDir, template: 'default', force: false })

  const content = await readFile(join(targetDir, 'package.json'), 'utf-8')
  const pkg = JSON.parse(content) as { name: string; dependencies: Record<string, string> }

  expect(pkg.name).toBe('my-project')
  expect(pkg.dependencies['@nanokajs/core']).toBeDefined()
  expect(pkg.dependencies['@nanokajs/core']).not.toContain('{{')
})

test('scaffold creates wrangler.toml with packageName substituted', async () => {
  const tmp = await makeTmpDir()
  const targetDir = join(tmp, 'my-app')

  await scaffold({ targetDir, template: 'default', force: false })

  const content = await readFile(join(targetDir, 'wrangler.toml'), 'utf-8')
  expect(content).toContain('name = "my-app"')
  expect(content).toContain('database_name = "my-app"')
  expect(content).not.toContain('{{packageName}}')
})

test('scaffold creates src/index.ts', async () => {
  const tmp = await makeTmpDir()
  const targetDir = join(tmp, 'my-worker')

  await scaffold({ targetDir, template: 'default', force: false })

  await expect(access(join(targetDir, 'src', 'index.ts'))).resolves.toBeUndefined()
})

test('scaffold src/index.ts contains User.findMany and User.validator', async () => {
  const tmp = await makeTmpDir()
  const targetDir = join(tmp, 'my-worker')

  await scaffold({ targetDir, template: 'default', force: false })

  const content = await readFile(join(targetDir, 'src', 'index.ts'), 'utf-8')
  expect(content).toContain('User.findMany')
  expect(content).toContain('User.validator')
})

test('scaffold fails without --force on non-empty directory', async () => {
  const tmp = await makeTmpDir()
  const targetDir = join(tmp, 'existing')

  await scaffold({ targetDir, template: 'default', force: false })

  await expect(scaffold({ targetDir, template: 'default', force: false })).rejects.toThrow(
    'already exists and is not empty',
  )
})

test('scaffold succeeds with --force on non-empty directory', async () => {
  const tmp = await makeTmpDir()
  const targetDir = join(tmp, 'existing2')

  await scaffold({ targetDir, template: 'default', force: false })
  await expect(scaffold({ targetDir, template: 'default', force: true })).resolves.toBeUndefined()
})

test('parseArgs: --help returns kind:help', () => {
  expect(parseArgs(['node', 'create-nanoka-app', '--help'])).toEqual({ kind: 'help' })
  expect(parseArgs(['node', 'create-nanoka-app', '-h'])).toEqual({ kind: 'help' })
})

test('parseArgs: --version returns kind:version', () => {
  expect(parseArgs(['node', 'create-nanoka-app', '--version'])).toEqual({ kind: 'version' })
  expect(parseArgs(['node', 'create-nanoka-app', '-v'])).toEqual({ kind: 'version' })
})

test('parseArgs: invalid template throws', () => {
  expect(() => parseArgs(['node', 'create-nanoka-app', 'my-app', '--template', 'unknown'])).toThrow(
    'Unknown template',
  )
})

test('parseArgs: no dir throws', () => {
  expect(() => parseArgs(['node', 'create-nanoka-app'])).toThrow('Please specify')
})

test('parseArgs: basic args', () => {
  const result = parseArgs(['node', 'create-nanoka-app', 'my-app'])
  expect(result).toEqual({ targetDir: 'my-app', template: 'default', force: false })
})

test('parseArgs: --force flag', () => {
  const result = parseArgs(['node', 'create-nanoka-app', 'my-app', '--force'])
  expect(result).toEqual({ targetDir: 'my-app', template: 'default', force: true })
})

test('scaffold rejects invalid package names', async () => {
  const tmp = await makeTmpDir()

  // Test invalid package names
  const invalidNames = ['My-App', '@invalid', 'app!', '-start-with-dash', 'app@', 'app#']
  for (const invalidName of invalidNames) {
    await expect(
      scaffold({ targetDir: join(tmp, invalidName), template: 'default', force: false }),
    ).rejects.toThrow('Invalid package name')
  }
})

test('scaffold accepts valid package names', async () => {
  const tmp = await makeTmpDir()

  // Test valid package names
  const validNames = ['my-app', 'my_app', 'my.app', 'myapp', 'app123', 'a']
  for (const validName of validNames) {
    const targetDir = join(tmp, validName)
    await expect(
      scaffold({ targetDir, template: 'default', force: false }),
    ).resolves.toBeUndefined()
  }
})

test('copyTemplate substitutes all placeholders', async () => {
  const tmp = await makeTmpDir()
  const srcDir = join(tmp, 'src')
  const destDir = join(tmp, 'dest')

  const { mkdir, writeFile } = await import('node:fs/promises')
  await mkdir(srcDir, { recursive: true })
  await writeFile(join(srcDir, 'hello.txt.tmpl'), 'Hello {{name}}, version {{version}}!')

  await copyTemplate(srcDir, destDir, { name: 'world', version: '1.0.0' })

  const content = await readFile(join(destDir, 'hello.txt'), 'utf-8')
  expect(content).toBe('Hello world, version 1.0.0!')
})
