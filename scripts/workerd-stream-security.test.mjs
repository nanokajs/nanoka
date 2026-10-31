import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const coreRequire = createRequire(join(root, 'packages/nanoka/package.json'))
const wranglerRequire = createRequire(coreRequire.resolve('wrangler/package.json'))
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare')

// Only reflect on synthetic streams; never invoke an exposed native hook.
// The experimental flag is confined to this fixture, not application configs.
const script = [
  'export default { async fetch() {',
  '  const chunks = [];',
  '  const readable = new ReadableStream({ start(c) { c.enqueue(new Uint8Array([65])); c.close(); } });',
  '  const writable = new WritableStream({ write(chunk) { chunks.push(chunk); } });',
  '  const response = new Response("synthetic stream body");',
  '  const internals = Object.fromEntries(Object.entries({ readable, writable, body: response.body }).map(([name, stream]) => [',
  '    name, Reflect.ownKeys(stream).filter(key => typeof key === "symbol").map(String)',
  '  ]));',
  '  const writer = writable.getWriter();',
  '  await writer.write("synthetic write");',
  '  await writer.close();',
  '  return Response.json({ internals, text: await response.text(), read: await new Response(readable).text(), chunks });',
  '} };',
].join('\n')

test('stream internals are private while ordinary stream operations work', {
  timeout: 120_000,
}, async (t) => {
  for (const experimental of [false, true]) {
    await t.test(experimental ? 'experimental TypeScript Streams' : 'default streams', async () => {
      const mf = new Miniflare(
        convertV4MiniflareOptions({
          modules: true,
          compatibilityDate: '2025-04-01',
          compatibilityFlags: [
            'nodejs_compat',
            ...(experimental ? ['typescript_implemented_streams'] : []),
          ],
          script,
        }),
      )
      try {
        const response = await mf.dispatchFetch('http://localhost/')
        assert.equal(response.status, 200)
        const result = await response.json()
        for (const [name, symbols] of Object.entries(result.internals)) {
          assert.deepEqual(
            symbols.filter((symbol) =>
              /^Symbol\(k(?:ReadableStreamBrand|WritableStreamBrand|ExtractNativeSource|ExtractNativeSink)\)$/.test(
                symbol,
              ),
            ),
            [],
            `${name} must not expose native stream internals`,
          )
        }
        assert.equal(result.text, 'synthetic stream body')
        assert.equal(result.read, 'A')
        assert.deepEqual(result.chunks, ['synthetic write'])
      } finally {
        await mf.dispose()
      }
    })
  }
})
