import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const coreRequire = createRequire(new URL('../packages/nanoka/package.json', import.meta.url))
const wranglerRequire = createRequire(coreRequire.resolve('wrangler/package.json'))
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare')

// Synthetic credentials only: requests reach the local R2 simulator, never an
// account or a remote database. Sign a small fixture with ordinary AWS SigV4.
const accessKeyId = 'nanoka-synthetic-access'
const secretAccessKey = 'nanoka-synthetic-secret'
const hash = (value) => createHash('sha256').update(value).digest('hex')
const hmac = (key, value) => createHmac('sha256', key).update(value).digest()

function signedRequest(origin, query, method, body = '') {
  const url = new URL(`/cdn-cgi/local/r2/s3/synthetic-bucket?${query}`, origin)
  const date = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')
  const day = date.slice(0, 8)
  const payloadHash = hash(body)
  const names = 'host;x-amz-content-sha256;x-amz-date'
  const headers = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${date}\n`
  const canonical = [method, url.pathname, query, headers, names, payloadHash].join('\n')
  const scope = `${day}/auto/s3/aws4_request`
  const key = ['auto', 's3', 'aws4_request'].reduce(
    (key, value) => hmac(key, value),
    hmac(`AWS4${secretAccessKey}`, day),
  )
  const signature = hmac(key, `AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`).toString(
    'hex',
  )
  return [
    url,
    {
      method,
      headers: {
        'x-amz-date': date,
        'x-amz-content-sha256': payloadHash,
        Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names}, Signature=${signature}`,
        'Content-Type': 'application/xml',
      },
      ...(method === 'POST' ? { body } : {}),
    },
  ]
}

test('local R2 S3 preserves XML validation and ordinary storage operations', {
  timeout: 120_000,
}, async (t) => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      host: '127.0.0.1',
      compatibilityDate: '2025-04-01',
      compatibilityFlags: ['nodejs_compat'],
      r2Buckets: {
        BUCKET: { id: 'synthetic-bucket', s3Credentials: { accessKeyId, secretAccessKey } },
      },
      script: 'export default { fetch() { return new Response("local fixture"); } };',
    }),
  )
  try {
    const bucket = await mf.getR2Bucket('BUCKET')
    const origin = await mf.ready
    for (const body of [
      '<Delete><Object></Delete>',
      '<Delete><Object><Key>keep</Key></Object></Delete><Extra/>',
    ]) {
      await t.test(`rejects invalid XML: ${body}`, async () => {
        await bucket.put('keep', 'original')
        const response = await mf.dispatchFetch(...signedRequest(origin, 'delete=', 'POST', body))
        assert.equal(response.status, 400, await response.clone().text())
        assert.match(await response.text(), /<Code>MalformedXML<\/Code>/)
        assert.equal(await (await bucket.get('keep')).text(), 'original')
      })
    }
    await t.test('valid deletion and XML list output remain usable', async () => {
      const response = await mf.dispatchFetch(
        ...signedRequest(
          origin,
          'delete=',
          'POST',
          '<Delete><Object><Key>keep</Key></Object></Delete>',
        ),
      )
      assert.equal(response.status, 200, await response.clone().text())
      assert.equal(await bucket.get('keep'), null)
      await bucket.put('special<&.txt', 'synthetic')
      const listing = await mf.dispatchFetch(...signedRequest(origin, 'list-type=2', 'GET'))
      assert.equal(listing.status, 200)
      assert.match(await listing.text(), /special&lt;&amp;\.txt/)
    })
  } finally {
    await mf.dispose()
  }
})
