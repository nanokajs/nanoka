import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

const run = promisify(execFile)
const coreRequire = createRequire(new URL('../packages/nanoka/package.json', import.meta.url))
const wranglerBin = path.join(
  path.dirname(coreRequire.resolve('wrangler/package.json')),
  'bin/wrangler.js',
)

test('Wrangler sends synthetic credentials only to the local mock and redacts diagnostics', {
  timeout: 120_000,
}, async (t) => {
  // Never load a project or use account credentials. The mock validates that
  // redacting the diagnostic copy does not alter the actual API request.
  const root = await mkdtemp(path.join(tmpdir(), 'nanoka-header-test-'))
  const key = 'nanoka-synthetic-request-key'
  const email = 'nanoka-synthetic@example.invalid'
  const responseKey = 'nanoka-synthetic-response-key'
  const cookie = 'nanoka-synthetic-cookie'
  const requests = []
  const server = createServer((request, response) => {
    requests.push({
      url: request.url,
      key: request.headers['x-auth-key'],
      email: request.headers['x-auth-email'],
    })
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Auth-Key': responseKey,
      'Set-Cookie': `session=${cookie}`,
    })
    response.end(
      JSON.stringify({ success: true, result: { buckets: [] }, errors: [], messages: [] }),
    )
  })
  try {
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const baseUrl = `http://127.0.0.1:${server.address().port}/client/v4`
    for (const sanitize of ['true', 'false']) {
      await t.test(`WRANGLER_LOG_SANITIZE=${sanitize}`, async () => {
        const before = requests.length
        const { stdout, stderr } = await run(
          process.execPath,
          [wranglerBin, 'r2', 'bucket', 'list'],
          {
            cwd: root,
            timeout: 30_000,
            maxBuffer: 2 * 1024 * 1024,
            env: {
              ...process.env,
              CI: 'true',
              CLOUDFLARE_API_BASE_URL: baseUrl,
              CLOUDFLARE_API_HEADERS: '{}',
              CLOUDFLARE_ACCOUNT_ID: '00000000000000000000000000000000',
              CLOUDFLARE_API_KEY: key,
              CLOUDFLARE_EMAIL: email,
              WRANGLER_SEND_METRICS: 'false',
              WRANGLER_LOG: 'debug',
              WRANGLER_LOG_SANITIZE: sanitize,
              WRANGLER_LOG_PATH: path.join(root, `logs-${sanitize}`),
              XDG_CONFIG_HOME: path.join(root, 'config'),
              XDG_DATA_HOME: path.join(root, 'data'),
              XDG_CACHE_HOME: path.join(root, 'cache'),
            },
          },
        )
        assert.ok(requests.length > before)
        for (const request of requests.slice(before)) {
          assert.match(request.url, /^\/client\/v4\/accounts\/0+\/r2\/buckets(?:\?|$)/)
          assert.equal(request.key, key)
          assert.equal(request.email, email)
        }
        const diagnostics = stdout + stderr
        for (const value of [key, email, responseKey, cookie]) {
          assert.equal(
            diagnostics.includes(value),
            false,
            'synthetic credential appeared in diagnostics',
          )
        }
        if (sanitize === 'false') {
          assert.match(diagnostics, /HEADERS:/)
          assert.match(diagnostics, /\[REDACTED\]/)
          assert.match(diagnostics, /application\/json/)
        }
      })
    }
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})
