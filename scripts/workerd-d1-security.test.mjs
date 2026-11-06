import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const coreRequire = createRequire(new URL('../packages/nanoka/package.json', import.meta.url))
const wranglerRequire = createRequire(coreRequire.resolve('wrangler/package.json'))
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare')

// Only a synthetic, local D1 database is used. No underlying service method is
// invoked through a leaked handle, and no account credentials are needed.
const script = `export default { async fetch(request, env) {
  const session = env.DB.withSession('first-primary');
  const statement = env.DB.prepare('SELECT ? AS value').bind(17);
  const sessionStatement = session.prepare('SELECT ? AS value').bind(23);
  const objects = { database: env.DB, session, statement, sessionStatement };
  const privateNames = ['fetcher', 'alwaysPrimarySession', 'dbSession'];
  const leakedFields = Object.fromEntries(Object.entries(objects).map(([name, value]) =>
    [name, privateNames.filter(key => value[key] !== undefined || Reflect.ownKeys(value).includes(key))]
  ));
  return Response.json({ leakedFields, values: [
    await statement.first('value'), await sessionStatement.first('value')
  ] });
} };`

test('D1 bindings expose SQL operations without internal service handles', {
  timeout: 120_000,
}, async (t) => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      compatibilityDate: '2025-04-01',
      compatibilityFlags: ['nodejs_compat'],
      d1Databases: ['DB'],
      script,
    }),
  )
  try {
    const response = await mf.dispatchFetch('http://localhost/')
    assert.equal(response.status, 200)
    const result = await response.json()
    for (const name of ['database', 'session', 'statement', 'sessionStatement']) {
      await t.test(name, () => assert.deepEqual(result.leakedFields[name], []))
    }
    await t.test('documented queries and bound parameters remain usable', () => {
      assert.deepEqual(result.values, [17, 23])
    })
  } finally {
    await mf.dispose()
  }
})
