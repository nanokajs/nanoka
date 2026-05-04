import { spawn } from 'node:child_process'

const D1_DATABASE_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/

export function validateDbName(db: string): void {
  if (!D1_DATABASE_NAME_RE.test(db)) {
    throw new Error(
      `Invalid D1 database name: "${db}". Only alphanumerics, hyphens, and underscores are allowed (max 64 chars).`,
    )
  }
}

function resolveRunner(pm: string): { cmd: string; prefix: string[] } {
  switch (pm) {
    case 'pnpm':
      return { cmd: 'pnpm', prefix: ['exec'] }
    case 'npm':
      return { cmd: 'npm', prefix: ['exec'] }
    case 'yarn':
      return { cmd: 'yarn', prefix: ['dlx'] }
    case 'bun':
      return { cmd: 'bunx', prefix: [] }
    case 'npx':
      return { cmd: 'npx', prefix: [] }
    default:
      throw new Error(
        `Unsupported package manager: "${pm}". Use one of: npx, pnpm, npm, yarn, bun.`,
      )
  }
}

function runProcess(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false, cwd })
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command '${cmd} ${args.join(' ')}' exited with code ${code}`))
      }
    })
    child.on('error', (err) => {
      reject(new Error(`Failed to spawn '${cmd}': ${err.message}`))
    })
  })
}

export async function runDrizzleKitGenerate(opts: {
  cwd: string
  configPath?: string
  pm: string
}): Promise<void> {
  const { cmd, prefix } = resolveRunner(opts.pm)
  const args = [...prefix, 'drizzle-kit', 'generate']
  if (opts.configPath) {
    args.push('--config', opts.configPath)
  }
  await runProcess(cmd, args, opts.cwd)
}

export async function runWranglerApply(opts: {
  cwd: string
  db: string
  remote: boolean
  pm: string
}): Promise<void> {
  validateDbName(opts.db)
  const { cmd, prefix } = resolveRunner(opts.pm)
  const args = [...prefix, 'wrangler', 'd1', 'migrations', 'apply', opts.db]
  args.push(opts.remote ? '--remote' : '--local')
  await runProcess(cmd, args, opts.cwd)
}
