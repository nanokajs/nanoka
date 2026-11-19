import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

// CVE-2026-106071: a trailing wildcard must not grant the shorter radix prefix.
// Use only two synthetic local files; do not grant the child any write access.
test('filesystem permission wildcard keeps the shorter prefix private', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nanoka-permission-'))
  const denied = join(dir, 'entry')
  const allowed = join(dir, 'entry.allowed')
  try {
    await writeFile(denied, 'private fixture')
    await writeFile(allowed, 'allowed fixture')
    const result = spawnSync(
      process.execPath,
      [
        '--permission',
        `--allow-fs-read=${denied}.*`,
        '--input-type=module',
        '-e',
        `import assert from 'node:assert/strict';
         import { readFileSync } from 'node:fs';
         const [denied, allowed] = process.argv.slice(1);
         assert.equal(process.permission.has('fs.read', allowed), true);
         assert.equal(readFileSync(allowed, 'utf8'), 'allowed fixture');
         assert.equal(process.permission.has('fs.read', denied), false);
         assert.throws(() => readFileSync(denied), { code: 'ERR_ACCESS_DENIED' });`,
        denied,
        allowed,
      ],
      { encoding: 'utf8', timeout: 10_000 },
    )
    assert.ifError(result.error)
    assert.equal(result.signal, null)
    assert.equal(result.status, 0, result.stderr)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
