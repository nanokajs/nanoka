#!/usr/bin/env node
import { realpathSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export type Options = { targetDir: string; template: 'default'; force: boolean }
export type ParseResult = Options | { kind: 'help' } | { kind: 'version' }

export function parseArgs(argv: string[]): ParseResult {
  const args = argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' }
  }
  if (args.includes('--version') || args.includes('-v')) {
    return { kind: 'version' }
  }

  let targetDir = ''
  let template: 'default' = 'default'
  let force = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string
    if (arg === '--template') {
      const next = args[i + 1]
      if (next !== 'default') {
        throw new Error(`Unknown template: "${next ?? ''}". Available templates: default`)
      }
      template = next
      i++
    } else if (arg === '--force') {
      force = true
    } else if (!arg.startsWith('-')) {
      targetDir = arg
    }
  }

  if (!targetDir) {
    throw new Error('Please specify a project directory: create-nanoka-app <dir>')
  }

  return { targetDir, template, force }
}

export async function copyTemplate(
  srcDir: string,
  destDir: string,
  vars: Record<string, string>,
): Promise<void> {
  await mkdir(destDir, { recursive: true })

  const entries = await readdir(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name)
    const isTmpl = extname(entry.name) === '.tmpl'
    const destName = isTmpl ? basename(entry.name, '.tmpl') : entry.name
    const destPath = join(destDir, destName)

    if (entry.isDirectory()) {
      await copyTemplate(srcPath, destPath, vars)
    } else if (isTmpl) {
      let content = await readFile(srcPath, 'utf-8')
      for (const [key, value] of Object.entries(vars)) {
        content = content.replaceAll(`{{${key}}}`, value)
      }
      await writeFile(destPath, content, 'utf-8')
    } else {
      await cp(srcPath, destPath)
    }
  }
}

export async function scaffold(opts: Options): Promise<void> {
  const targetDir = resolve(process.cwd(), opts.targetDir)

  const packageName = basename(targetDir)

  // Validate packageName against npm naming rules
  const packageNameRegex = /^[a-z0-9][a-z0-9\-_.]*$/
  if (!packageNameRegex.test(packageName)) {
    throw new Error(
      `Invalid package name: '${packageName}'. Must match /^[a-z0-9][a-z0-9-_.]*$/ (lowercase letters, digits, hyphens, dots, underscores).`,
    )
  }

  try {
    const entries = await readdir(targetDir)
    if (entries.length > 0 && !opts.force) {
      throw new Error(
        `Directory "${opts.targetDir}" already exists and is not empty. Use --force to overwrite.`,
      )
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err
    }
  }

  const selfDir = dirname(fileURLToPath(import.meta.url))
  const templateDir = join(selfDir, '../templates', opts.template)

  const require = createRequire(import.meta.url)
  const { version } = require('../package.json') as { version: string }
  const vars: Record<string, string> = {
    packageName,
    nanokaVersion: version,
  }

  await copyTemplate(templateDir, targetDir, vars)

  console.log(`\nCreated "${packageName}" at ${targetDir}`)
  console.log('\nNext steps:')
  console.log(`  cd ${opts.targetDir}`)
  console.log('  pnpm install')
  console.log('  pnpm exec nanoka generate')
  console.log('  pnpm exec drizzle-kit generate')
  console.log('  pnpm dev')
}

async function main(): Promise<void> {
  const result = parseArgs(process.argv)

  if ('kind' in result) {
    if (result.kind === 'help') {
      console.log('Usage: create-nanoka-app <dir> [--template default] [--force]')
      console.log('\nOptions:')
      console.log('  --template <name>  Template to use (default: default)')
      console.log('  --force            Overwrite existing directory')
      console.log('  --help, -h         Show this help message')
      console.log('  --version, -v      Show version number')
      return
    }
    if (result.kind === 'version') {
      const require = createRequire(import.meta.url)
      const { version } = require('../package.json') as { version: string }
      console.log(version)
      return
    }
  }

  await scaffold(result as Options)
}

if (process.argv[1] != null && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error((err as Error).message ?? err)
    process.exit(1)
  })
}
