import { describe, it, expect } from 'vitest'
import { main } from '../index'

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

  it('returns error with missing --out if config.out is not defined', async () => {
    const exitCode = await main(['generate', '--config', '/tmp/fake.ts'])
    expect(exitCode).toBe(1)
  })
})
