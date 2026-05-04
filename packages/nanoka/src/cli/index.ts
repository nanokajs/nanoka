import { promises as fs, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { generateDrizzleSchema } from '../codegen/generate'
import { loadConfig } from './load-config'
import { runDrizzleKitGenerate, runWranglerApply, validateDbName } from './run'

async function findDrizzleConfig(cwd: string): Promise<string | undefined> {
  const candidates = ['drizzle.config.ts', 'drizzle.config.js', 'drizzle.config.mjs']
  for (const name of candidates) {
    try {
      await fs.access(resolve(cwd, name))
      return resolve(cwd, name)
    } catch {
      // not found, try next
    }
  }
  return undefined
}

async function main(args: string[]): Promise<number> {
  try {
    if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
      console.log(
        'Usage: nanoka generate [--config <path>] [--output <path>] [--no-migrate] [--apply --db <name>] [--remote] [--package-manager <pm>]',
      )
      console.log('')
      console.log('Options:')
      console.log(
        '  --config <path>           Path to nanoka.config.ts (default: ./nanoka.config.ts)',
      )
      console.log('  --output <path>           Output file path (overrides config.output)')
      console.log('  --no-migrate              Skip drizzle-kit generate (schema generation only)')
      console.log(
        '  --apply                   Run wrangler d1 migrations apply after drizzle-kit generate',
      )
      console.log(
        '  --db <name>               D1 database name for wrangler (required with --apply)',
      )
      console.log(
        '  --remote                  Apply migrations to remote instead of local (used with --apply)',
      )
      console.log(
        '  --package-manager <pm>    Package manager to use: npx (default), pnpm, npm, yarn, bun',
      )
      return 0
    }

    if (args[0] !== 'generate') {
      console.error(`Error: unknown command '${args[0]}'`)
      console.error(
        'Usage: nanoka generate [--config <path>] [--output <path>] [--no-migrate] [--apply --db <name>] [--remote] [--package-manager <pm>]',
      )
      return 1
    }

    let configPath: string = './nanoka.config.ts'
    let outputPath: string | undefined
    let noMigrate = false
    let apply = false
    let dbName: string | undefined
    let remote = false
    let packageManager: string = 'npx'

    let i = 1
    while (i < args.length) {
      if (args[i] === '--config' && i + 1 < args.length) {
        const next = args[i + 1]
        if (next !== undefined) configPath = next
        i += 2
      } else if (args[i] === '--output' && i + 1 < args.length) {
        const next = args[i + 1]
        if (next !== undefined) outputPath = next
        i += 2
      } else if (args[i] === '--no-migrate') {
        noMigrate = true
        i += 1
      } else if (args[i] === '--apply') {
        apply = true
        i += 1
      } else if (args[i] === '--db' && i + 1 < args.length) {
        const next = args[i + 1]
        if (next !== undefined) dbName = next
        i += 2
      } else if (args[i] === '--remote') {
        remote = true
        i += 1
      } else if (args[i] === '--package-manager' && i + 1 < args.length) {
        const next = args[i + 1]
        if (next !== undefined) {
          const validPms = ['npx', 'pnpm', 'npm', 'yarn', 'bun']
          if (!validPms.includes(next)) {
            console.error(
              `Error: unsupported package manager '${next}'. Use one of: ${validPms.join(', ')}`,
            )
            return 1
          }
          packageManager = next
        }
        i += 2
      } else {
        console.error(`Error: unknown option '${args[i]}'`)
        return 1
      }
    }

    const cwd = process.cwd()
    const absoluteConfigPath = resolve(cwd, configPath)
    const config = await loadConfig(absoluteConfigPath)

    const finalOutputPath = outputPath ?? config.output ?? './drizzle/schema.ts'
    const absoluteOutputPath = resolve(cwd, finalOutputPath)

    const schema = generateDrizzleSchema(config.models)

    await fs.mkdir(dirname(absoluteOutputPath), { recursive: true })
    await fs.writeFile(absoluteOutputPath, schema, 'utf-8')

    console.log(`✓ Generated ${absoluteOutputPath}`)

    if (!noMigrate) {
      const drizzleConfigPath =
        config.migrate?.drizzleConfig !== undefined
          ? resolve(cwd, config.migrate.drizzleConfig)
          : await findDrizzleConfig(cwd)

      if (drizzleConfigPath !== undefined) {
        const pm = config.migrate?.packageManager ?? packageManager
        console.log('Running drizzle-kit generate...')
        await runDrizzleKitGenerate({ cwd, configPath: drizzleConfigPath, pm })
        console.log('✓ drizzle-kit generate completed')
      } else {
        console.log('No drizzle.config.ts found, skipping drizzle-kit generate')
      }
    }

    if (apply) {
      const resolvedDb = dbName ?? config.migrate?.database
      if (resolvedDb === undefined) {
        console.error(
          'Error: --db <name> を指定するか nanoka.config.ts の migrate.database に設定してください',
        )
        return 1
      }
      try {
        validateDbName(resolvedDb)
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`)
        return 1
      }

      const pm = config.migrate?.packageManager ?? packageManager
      console.log(`Running wrangler d1 migrations apply ${resolvedDb}...`)
      await runWranglerApply({ cwd, db: resolvedDb, remote, pm })
      console.log('✓ wrangler d1 migrations apply completed')
    }

    return 0
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`)
    } else {
      console.error('Unknown error:', error)
    }
    return 1
  }
}

// Entry-point detection: compare realpath-resolved argv[1] (which may be a
// symlink under pnpm/npm bin shims) with this module's URL. A naive
// `file://${argv[1]}` comparison fails whenever the package is installed via
// pnpm because node_modules entries are symlinks into the .pnpm store while
// import.meta.url is always the resolved path.
function isCliEntrypoint(): boolean {
  const argv1 = process.argv[1]
  if (!argv1) return false
  try {
    return pathToFileURL(realpathSync(argv1)).href === import.meta.url
  } catch {
    return false
  }
}

if (isCliEntrypoint()) {
  main(process.argv.slice(2)).then((code) => {
    process.exit(code)
  })
}

export { main }
