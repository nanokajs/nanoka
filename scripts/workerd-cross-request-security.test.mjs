import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const coreRequire = createRequire(new URL('../packages/nanoka/package.json', import.meta.url))
const wranglerRequire = createRequire(coreRequire.resolve('wrangler/package.json'))
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare')

// Two sequential local requests exercise an ended owner's Promise. A short
// abort bounds the old hang; no CPU loop, load test, or remote service is used.
const script = `let pending, settle;
export default { async fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === '/seed') {
    pending = new Promise(resolve => { settle = resolve; });
    return new Response('seeded');
  }
  if (path === '/await') {
    settle('settled');
    try {
      return new Response(await pending);
    } catch (error) {
      return new Response(
        /created by a request that has since ended/.test(error.message)
          ? 'owner ended' : 'unexpected rejection', { status: 409 });
    }
  }
  return new Response(await Promise.resolve('healthy'));
} };`

test('an orphaned cross-request Promise finishes according to the compatibility mode', {
  timeout: 30_000,
}, async (t) => {
  for (const legacy of [false, true]) {
    await t.test(legacy ? 'explicit legacy mode' : 'current default', async (t) => {
      const mf = new Miniflare(
        convertV4MiniflareOptions({
          modules: true,
          host: '127.0.0.1',
          compatibilityDate: '2025-04-01',
          compatibilityFlags: legacy ? ['no_handle_cross_request_promise_resolution'] : [],
          script,
        }),
      )
      try {
        const seed = await mf.dispatchFetch('http://localhost/seed')
        assert.equal(seed.status, 200)
        assert.equal(await seed.text(), 'seeded')
        await t.test('settles or rejects rather than waiting forever', async () => {
          const response = await mf.dispatchFetch('http://localhost/await', {
            signal: AbortSignal.timeout(3_000),
          })
          assert.equal(response.status, legacy ? 200 : 409)
          assert.equal(await response.text(), legacy ? 'settled' : 'owner ended')
        })
        await t.test('ordinary Promise handling still works', async () => {
          const response = await mf.dispatchFetch('http://localhost/health')
          assert.equal(response.status, 200)
          assert.equal(await response.text(), 'healthy')
        })
      } finally {
        await mf.dispose()
      }
    })
  }
})
