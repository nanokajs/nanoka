import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const coreRequire = createRequire(join(root, 'packages/nanoka/package.json'))
const wranglerRequire = createRequire(coreRequire.resolve('wrangler/package.json'))
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare')

// Exercise the installed native runtime, including the mixed-mode boundary that
// an npm audit cannot inspect. Only synthetic error frames cross local services.
const marker = 'callee-private-fixture.js'
const message = 'synthetic RPC failure'
const callerScript = [
  'export default { async fetch(request, env) {',
  '  const describe = error => Response.json({',
  '    message: error.message, stack: String(error.stack ?? ""),',
  '    causeStack: String(error.cause?.stack ?? "")',
  '  });',
  '  try { return describe(await env.PEER.fail(new URL(request.url).pathname)); }',
  '  catch (error) { return describe(error); }',
  '} };',
].join('\n')
const calleeScript = [
  "import { WorkerEntrypoint } from 'cloudflare:workers';",
  'export default class extends WorkerEntrypoint { fail(path) {',
  '  const cause = new Error("synthetic cause");',
  `  cause.stack = ${JSON.stringify(`Error: synthetic cause\n at ${marker}`)};`,
  `  const error = path.startsWith('/dom') ? new DOMException(${JSON.stringify(message)}, 'AbortError') : new Error(${JSON.stringify(message)}, { cause });`,
  `  error.stack = ${JSON.stringify(`Error: synthetic RPC failure\n at ${marker}`)};`,
  "  if (path === '/dom-value') return error;",
  '  throw error;',
  '} }',
].join('\n')

test('RPC error stacks stay within the callee across serialization modes', {
  timeout: 120_000,
}, async (t) => {
  for (const caller of ['enhanced', 'legacy']) {
    for (const callee of ['enhanced', 'legacy']) {
      await t.test(`${caller} caller / ${callee} callee`, async () => {
        const worker = (name, mode, script) => ({
          name,
          modules: true,
          compatibilityDate: '2025-04-01',
          compatibilityFlags: ['nodejs_compat', `${mode}_error_serialization`],
          script,
        })
        const mf = new Miniflare(
          convertV4MiniflareOptions({
            workers: [
              { ...worker('caller', caller, callerScript), serviceBindings: { PEER: 'callee' } },
              worker('callee', callee, calleeScript),
            ],
          }),
        )
        try {
          for (const path of ['/', '/dom', '/dom-value']) {
            const response = await mf.dispatchFetch(`http://localhost${path}`)
            assert.equal(response.status, 200)
            const result = await response.json()
            assert.equal(result.message, message)
            assert.equal(
              result.stack.includes(marker),
              false,
              `${path}: callee stack must not reach caller`,
            )
            assert.equal(
              result.causeStack.includes(marker),
              false,
              'nested error stack must not reach caller',
            )
          }
        } finally {
          await mf.dispose()
        }
      })
    }
  }
})

// Two callback invocations share one Durable Object critical section. The outer
// request has a short abort, so an old runtime's gate deadlock stays bounded.
test('repeated RPC callbacks reenter the same Durable Object critical section', {
  timeout: 20_000,
}, async (t) => {
  const script = `import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';
export class Peer extends WorkerEntrypoint {
  async invoke(callback, count) {
    const values = [];
    for (let i = 0; i < count; i++) values.push(await callback());
    return values;
  }
}
export class Actor extends DurableObject {
  async call(count) {
    return this.ctx.blockConcurrencyWhile(async () => {
      let calls = 0;
      const values = await this.env.PEER.invoke(() => ++calls, count);
      return { values, calls };
    });
  }
}
export default {
  async fetch(request, env) {
    const actor = env.ACTORS.get(env.ACTORS.idFromName(new URL(request.url).pathname));
    return Response.json(await actor.call(Number(new URL(request.url).searchParams.get('count'))));
  }
};`
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'caller',
          modules: true,
          script,
          host: '127.0.0.1',
          compatibilityDate: '2025-04-01',
          serviceBindings: { PEER: { name: 'caller', entrypoint: 'Peer' } },
          durableObjects: { ACTORS: 'Actor' },
        },
      ],
    }),
  )
  try {
    for (const count of [1, 2]) {
      await t.test(`${count} callback invocation(s)`, async () => {
        const response = await mf.dispatchFetch(`http://localhost/case-${count}?count=${count}`, {
          signal: AbortSignal.timeout(3_000),
        })
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), {
          values: Array.from({ length: count }, (_, i) => i + 1),
          calls: count,
        })
      })
    }
  } finally {
    await mf.dispose()
  }
})
