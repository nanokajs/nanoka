import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const coreRequire = createRequire(new URL('../packages/nanoka/package.json', import.meta.url))
const wranglerRequire = createRequire(coreRequire.resolve('wrangler/package.json'))
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare')

// Pure address classification with documentation addresses. No socket connects
// to any address under test, and no network allowlist is changed.
const script = `import { BlockList } from 'node:net';
export default { fetch() {
  const ipv6 = new BlockList();
  ipv6.addAddress('2001:db8::42', 'ipv6');
  const mapped = new BlockList();
  mapped.addAddress('192.0.2.42', 'ipv4');
  const range = new BlockList();
  let spanningRange = false;
  try {
    range.addRange('127.0.0.1', '200.0.0.1', 'ipv4');
    spanningRange = range.check('192.0.2.42', 'ipv4');
  } catch {}
  return Response.json({
    ipv6Case: ipv6.check('2001:DB8::42', 'ipv6'),
    mappedHex: mapped.check('::ffff:c000:22a', 'ipv6'),
    spanningRange,
    unrelatedAllowed: !ipv6.check('2001:db8::43', 'ipv6'),
  });
} };`

test('native BlockList classifies equivalent addresses consistently', {
  timeout: 120_000,
}, async (t) => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      host: '127.0.0.1',
      compatibilityDate: '2025-04-01',
      compatibilityFlags: ['nodejs_compat'],
      script,
    }),
  )
  try {
    const response = await mf.dispatchFetch('http://localhost/')
    assert.equal(response.status, 200)
    const result = await response.json()
    for (const name of ['ipv6Case', 'mappedHex', 'spanningRange', 'unrelatedAllowed']) {
      await t.test(name, () => assert.equal(result[name], true))
    }
  } finally {
    await mf.dispose()
  }
})
