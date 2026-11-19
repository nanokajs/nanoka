import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const coreRequire = createRequire(new URL('../packages/nanoka/package.json', import.meta.url))
const wranglerRequire = createRequire(coreRequire.resolve('wrangler/package.json'))
const miniflareRequire = createRequire(wranglerRequire.resolve('miniflare/package.json'))
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare')
const WebSocket = miniflareRequire('ws')

// Exercise a real local HTTP upgrade and both client shutdown paths. The native
// CPU-limit/microtask ownership race has upstream C++ coverage; this bounded
// compatibility test does not reproduce that race or run an unbounded worker.
const script = `export default { fetch(request) {
  if (request.headers.get('Upgrade') === 'websocket') {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    server.addEventListener('message', event => server.send(event.data));
    server.addEventListener('close', () => server.close(1000, 'done'));
    return new Response(null, { status: 101, webSocket: client });
  }
  return new Response('healthy');
} };`

test('local WebSocket upgrade remains usable across client shutdowns', {
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
    const httpUrl = await mf.ready
    const wsUrl = new URL(httpUrl)
    wsUrl.protocol = 'ws:'
    for (const shutdown of ['close handshake', 'client disconnect']) {
      await t.test(shutdown, async () => {
        const socket = new WebSocket(wsUrl)
        try {
          await once(socket, 'open', { signal: AbortSignal.timeout(10_000) })
          const message = once(socket, 'message', { signal: AbortSignal.timeout(10_000) })
          socket.send('synthetic message')
          const [data] = await message
          assert.equal(data.toString(), 'synthetic message')
          const closed = once(socket, 'close', { signal: AbortSignal.timeout(10_000) })
          if (shutdown === 'close handshake') socket.close(1000, 'done')
          else socket.terminate()
          const [code] = await closed
          assert.equal(code, shutdown === 'close handshake' ? 1000 : 1006)
          const response = await fetch(httpUrl, { signal: AbortSignal.timeout(10_000) })
          assert.equal(response.status, 200)
          assert.equal(await response.text(), 'healthy')
        } finally {
          socket.terminate()
        }
      })
    }
  } finally {
    await mf.dispose()
  }
})
