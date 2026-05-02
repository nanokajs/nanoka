import { promises as fs } from 'fs'
import { chmodSync } from 'fs'
import { join } from 'path'

async function prependShebang() {
  const cliPath = join(process.cwd(), 'dist/cli.js')

  try {
    const content = await fs.readFile(cliPath, 'utf-8')
    const withShebang = content.startsWith('#!/')
      ? content
      : `#!/usr/bin/env node\n${content}`
    await fs.writeFile(cliPath, withShebang, 'utf-8')
    chmodSync(cliPath, 0o755)
    console.log(`✓ Added shebang to ${cliPath}`)
  } catch (error) {
    console.error('Error prepending shebang:', error)
    process.exit(1)
  }
}

prependShebang()
