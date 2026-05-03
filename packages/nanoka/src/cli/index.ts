import { promises as fs, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { generateDrizzleSchema } from '../codegen/generate'
import { loadConfig } from './load-config'

async function main(args: string[]): Promise<number> {
  try {
    if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
      console.log('Usage: nanoka generate [--config <path>] [--output <path>]')
      console.log('')
      console.log('Options:')
      console.log('  --config <path>   Path to nanoka.config.ts (default: ./nanoka.config.ts)')
      console.log('  --output <path>   Output file path (overrides config.output)')
      return 0
    }

    if (args[0] !== 'generate') {
      console.error(`Error: unknown command '${args[0]}'`)
      console.error('Usage: nanoka generate [--config <path>] [--output <path>]')
      return 1
    }

    let configPath: string = './nanoka.config.ts'
    let outputPath: string | undefined

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
      } else {
        console.error(`Error: unknown option '${args[i]}'`)
        return 1
      }
    }

    const absoluteConfigPath = resolve(process.cwd(), configPath)
    const config = await loadConfig(absoluteConfigPath)

    const finalOutputPath = outputPath ?? config.output ?? './drizzle/schema.ts'
    const absoluteOutputPath = resolve(process.cwd(), finalOutputPath)

    const schema = generateDrizzleSchema(config.models)

    await fs.mkdir(dirname(absoluteOutputPath), { recursive: true })
    await fs.writeFile(absoluteOutputPath, schema, 'utf-8')

    console.log(`✓ Generated ${absoluteOutputPath}`)
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
