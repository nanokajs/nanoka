import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const coreRequire = createRequire(new URL('../packages/nanoka/package.json', import.meta.url))
const wranglerRequire = createRequire(coreRequire.resolve('wrangler/package.json'))
const miniflareRequire = createRequire(wranglerRequire.resolve('miniflare/package.json'))
const { fetch } = miniflareRequire('undici')
const body = 'synthetic integrity fixture'
const url = `data:text/plain,${encodeURIComponent(body)}`
const digest = (value) => `sha256-${createHash('sha256').update(value).digest('base64')}`

test('installed undici verifies SRI across ASCII whitespace', async (t) => {
  for (const whitespace of [' ', '\t', '\n', '\r', '\f', '\t \n']) {
    await t.test(JSON.stringify(whitespace), async () => {
      const integrity = `${whitespace}${digest(body)}${whitespace}`
      assert.equal(await (await fetch(url, { integrity })).text(), body)
      await assert.rejects(fetch(url, { integrity: `${whitespace}${digest('different fixture')}` }))
    })
  }
})
