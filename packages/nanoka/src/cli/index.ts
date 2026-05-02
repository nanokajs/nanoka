import { promises as fs } from 'fs'
import { dirname, resolve } from 'path'
import { generateDrizzleSchema } from '../codegen/generate'
import { loadConfig } from './load-config'

async function main(args: string[]): Promise<number> {
  try {
    if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
      console.log('Usage: nanoka generate [--config <path>] [--out <path>]')
      console.log('')
      console.log('Options:')
      console.log('  --config <path>   Path to nanoka.config.ts (default: ./nanoka.config.ts)')
      console.log('  --out <path>      Output file path (overrides config.out)')
      return 0
    }

    if (args[0] !== 'generate') {
      console.error(`Error: unknown command '${args[0]}'`)
      console.error('Usage: nanoka generate [--config <path>] [--out <path>]')
      return 1
    }

    let configPath: string = './nanoka.config.ts'
    let outPath: string | undefined = undefined

    let i = 1
    while (i < args.length) {
      if (args[i] === '--config' && i + 1 < args.length) {
        configPath = args[i + 1]!
        i += 2
      } else if (args[i] === '--out' && i + 1 < args.length) {
        outPath = args[i + 1]!
        i += 2
      } else {
        console.error(`Error: unknown option '${args[i]}'`)
        return 1
      }
    }

    const absoluteConfigPath = resolve(process.cwd(), configPath)
    const config = await loadConfig(absoluteConfigPath)

    const finalOutPath = outPath ?? config.out ?? './drizzle/schema.ts'
    const absoluteOutPath = resolve(process.cwd(), finalOutPath)

    const schema = generateDrizzleSchema(config.models)

    await fs.mkdir(dirname(absoluteOutPath), { recursive: true })
    await fs.writeFile(absoluteOutPath, schema, 'utf-8')

    console.log(`✓ Generated ${absoluteOutPath}`)
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((code) => {
    process.exit(code)
  })
}

export { main }
