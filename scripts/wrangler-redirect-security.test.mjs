import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const coreRequire = createRequire(new URL('../packages/nanoka/package.json', import.meta.url))
const { unstable_dev, unstable_generateASSETSBinding } = coreRequire('wrangler')

// Only synthetic local assets are served. Inspect Location without following it;
// the .invalid names below never receive a connection or credentials.
test('Pages and Workers keep relative redirects on the local site', {
  timeout: 120_000,
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nanoka-redirect-'))
  const directory = join(root, 'public')
  const abort = new AbortController()
  const oldLogPath = process.env.WRANGLER_LOG_PATH
  process.env.WRANGLER_LOG_PATH = join(root, 'wrangler.log')
  let worker
  try {
    await mkdir(directory)
    await writeFile(join(directory, 'index.html'), 'synthetic public asset')
    const suffix = '?next=https://control.invalid/a//b#part//one'
    await writeFile(
      join(directory, '_redirects'),
      [
        '/repeat/* /:splat 302',
        '/triple/* ///:splat 302',
        '/mixed/* //\\:splat 302',
        `/suffix/* /:splat${suffix} 302`,
        '/external/* //offsite.invalid/:splat 302',
        '/normal/* /:splat 302',
      ].join('\n'),
    )
    const config = join(root, 'wrangler.json')
    await writeFile(
      config,
      JSON.stringify({
        name: 'nanoka-redirect-fixture',
        compatibility_date: '2025-04-01',
        assets: { directory: './public', binding: 'ASSETS' },
      }),
    )
    const script = join(root, 'worker.js')
    await writeFile(
      script,
      'export default { fetch() { return new Response("fallback", {status:404}) } }',
    )
    const pages = await unstable_generateASSETSBinding({
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
    worker = await unstable_dev(script, {
      config,
      envFiles: [],
      ip: '127.0.0.1',
      port: 0,
      inspectorPort: 0,
      local: true,
      persist: false,
      logLevel: 'none',
      experimental: { disableExperimentalWarning: true, disableDevRegistry: true },
    })
    const cases = [
      ['/repeat//offsite.invalid/item', '/offsite.invalid/item'],
      ['/triple/offsite.invalid/item', '/offsite.invalid/item'],
      ['/mixed/offsite.invalid/item', '/offsite.invalid/item'],
      ['/suffix/images//logo.png', `/images/logo.png${suffix}`],
      ['/external//images/logo.png', '//offsite.invalid//images/logo.png'],
      ['/normal/item', '/item'],
      ['/repeat/%2Fimages/logo.png', '/%2Fimages/logo.png'],
    ]
    for (const [name, fetchAsset] of [
      ['Pages', (request) => pages(request)],
      ['Workers', (request) => worker.fetch(request.url, { redirect: 'manual' })],
    ]) {
      await t.test(name, async (t) => {
        for (const [path, expected] of cases) {
          await t.test(path, async () => {
            const request = new Request(`http://localhost${path}`, { redirect: 'manual' })
            const response = await fetchAsset(request)
            assert.equal(response.status, 302)
            const location = response.headers.get('Location')
            assert.notEqual(location, null)
            const target = new URL(location, request.url)
            const wanted = new URL(expected, request.url)
            assert.equal(target.href, wanted.href)
            if (!path.startsWith('/external/')) assert.equal(target.origin, 'http://localhost')
          })
        }
      })
    }
  } finally {
    try {
      await worker?.stop()
    } finally {
      abort.abort()
      if (oldLogPath === undefined) delete process.env.WRANGLER_LOG_PATH
      else process.env.WRANGLER_LOG_PATH = oldLogPath
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  }
})
