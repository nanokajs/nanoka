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
  '  try { await env.PEER.fail(); return Response.json({ missingFailure: true }); }',
  '  catch (error) { return Response.json({',
  '    message: error.message, stack: String(error.stack ?? ""),',
  '    causeStack: String(error.cause?.stack ?? "")',
  '  }); }',
  '} };',
].join('\n')
const calleeScript = [
  "import { WorkerEntrypoint } from 'cloudflare:workers';",
  'export default class extends WorkerEntrypoint { fail() {',
  '  const cause = new Error("synthetic cause");',
  `  cause.stack = ${JSON.stringify(`Error: synthetic cause\n at ${marker}`)};`,
  `  const error = new Error(${JSON.stringify(message)}, { cause });`,
  `  error.stack = ${JSON.stringify(`Error: synthetic RPC failure\n at ${marker}`)};`,
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
          const response = await mf.dispatchFetch('http://localhost/')
          assert.equal(response.status, 200)
          const result = await response.json()
          assert.equal(result.message, message)
          assert.equal(result.stack.includes(marker), false, 'callee stack must not reach caller')
          assert.equal(
            result.causeStack.includes(marker),
            false,
            'nested error stack must not reach caller',
          )
        } finally {
          await mf.dispose()
        }
      })
    }
  }
})
