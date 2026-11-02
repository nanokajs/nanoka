import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const coreRequire = createRequire(join(root, 'packages/nanoka/package.json'))

test('Pages ASSETS reads stay inside the configured directory', { timeout: 120_000 }, async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), 'nanoka-assets-'))
  const abort = new AbortController()
  const oldLogPath = process.env.WRANGLER_LOG_PATH
  process.env.WRANGLER_LOG_PATH = join(scratch, 'wrangler.log')
  try {
    const directory = join(scratch, 'site')
    await mkdir(directory)
    await mkdir(join(scratch, 'site-adjacent'))
    await writeFile(join(directory, 'inside.txt'), 'public fixture')
    await writeFile(join(directory, '..notes.txt'), 'public dotted filename')
    const outside = 'synthetic outside-directory fixture'
    await writeFile(join(scratch, 'site-adjacent', 'payload.txt'), outside)
    await writeFile(join(scratch, 'site.txt'), outside)
    await writeFile(join(scratch, 'outside.txt'), outside)

    // Use the installed helper, without starting a CLI, logging in, or deploying.
    // The only files that requests can encounter are synthetic local fixtures.
    const { unstable_generateASSETSBinding } = coreRequire('wrangler')
    const fetchAsset = await unstable_generateASSETSBinding({
      directory,
      signal: abort.signal,
      log: {
        log() {},
        warn() {},
        error(error) {
          throw error
        },
      },
    })
    const cases = [
      ['/inside.txt', 200, 'public fixture'],
      ['/..notes.txt', 200, 'public dotted filename'],
      ['/missing.txt', 404],
      ['/..%2fsite-adjacent/payload.txt', 404],
      ['/..%2fsite.txt', 404],
      ['/nested%2f..%2f..%2fsite-adjacent/payload.txt', 404],
      ['/..%2foutside.txt', 404],
    ]
    for (const [path, status, content] of cases) {
      await t.test(path, async () => {
        const response = await fetchAsset(new Request(`http://localhost${path}`))
        const body = await response.text()
        assert.equal(response.status, status)
        assert.equal(body.includes(outside), false, 'must not disclose a neighboring fixture')
        if (content !== undefined) assert.equal(body, content)
      })
    }
  } finally {
    abort.abort()
    if (oldLogPath === undefined) delete process.env.WRANGLER_LOG_PATH
    else process.env.WRANGLER_LOG_PATH = oldLogPath
    await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})
