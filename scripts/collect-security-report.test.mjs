import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { classifyAudit } from './collect-security-report.mjs'

function response(counts = {}, advisories = {}, status = 0) {
  return {
    status,
    stdout: JSON.stringify({
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, ...counts },
      },
      advisories,
    }),
  }
}

test('zero counts with a successful complete report are no dependency findings', () => {
  assert.equal(classifyAudit(response()).status, 'no-findings')
})

test('exit 1 with matching advisory details is a finding, not a transport failure', () => {
  const result = classifyAudit(
    response(
      { high: 1 },
      {
        1: {
          module_name: 'example',
          severity: 'high',
          url: 'https://github.com/advisories/GHSA-example',
          findings: [{ version: '1.0.0', paths: ['project > example'] }],
        },
      },
      1,
    ),
  )
  assert.equal(result.status, 'findings')
  assert.deepEqual(result.advisories[1].findings[0].paths, ['project > example'])
})

test('process failure, timeout, and missing executable never become no-findings', () => {
  for (const failure of [
    { status: 2 },
    { status: null, signal: 'SIGTERM' },
    { status: null, error: new Error('ENOENT') },
  ]) {
    assert.equal(classifyAudit({ ...response(), ...failure }).status, 'incomplete')
  }
})

test('registry errors, HTML, null, and unsupported report shapes remain incomplete', () => {
  for (const stdout of [
    '<html>502 Bad Gateway</html>',
    'null',
    JSON.stringify({ error: { code: 'ECONNRESET' } }),
    JSON.stringify({ metadata: { vulnerabilities: { high: 0 } }, advisories: {} }),
    JSON.stringify({ metadata: { vulnerabilities: { high: -1 } }, advisories: {} }),
    JSON.stringify({ ...JSON.parse(response().stdout), error: 'Registry unavailable' }),
  ]) {
    assert.equal(classifyAudit({ status: 0, stdout }).status, 'incomplete')
  }
})

test('partial advisory details and inconsistent exit codes cannot hide findings', () => {
  for (const result of [
    response({}, {}, 1),
    response({ high: 1 }, {}, 1),
    response({ high: 1 }, { 1: null }, 1),
    response({}, [], 0),
  ]) {
    assert.equal(classifyAudit(result).status, 'incomplete')
  }
})

test('CLI inventories peer/template/workflow inputs and rejects the wrong pnpm before auditing', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'nanoka-security-report-'))
  const collector = resolve('scripts/collect-security-report.mjs')
  try {
    mkdirSync(join(temporary, 'bin'))
    mkdirSync(join(temporary, '.github/workflows'), { recursive: true })
    mkdirSync(join(temporary, 'templates/default'), { recursive: true })
    writeFileSync(
      join(temporary, 'package.json'),
      JSON.stringify({ name: 'fixture', packageManager: 'pnpm@9.15.9' }),
    )
    writeFileSync(join(temporary, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n")
    writeFileSync(
      join(temporary, 'templates/default/package.json.tmpl'),
      JSON.stringify({ peerDependencies: { hono: '^4.0.0' } }),
    )
    writeFileSync(
      join(temporary, '.github/workflows/check.yml'),
      'steps:\n  - uses: actions/checkout@abc\n    with:\n      node-version: 22.23.4\n',
    )
    const fakePnpm = join(temporary, 'bin/pnpm')
    writeFileSync(
      fakePnpm,
      '#!/usr/bin/env node\nif (process.argv[2] === "--version") console.log("11.0.0"); else process.exit(99)\n',
    )
    chmodSync(fakePnpm, 0o755)
    execFileSync('git', ['init', '-q', temporary])
    execFileSync('git', ['-C', temporary, 'add', '.'])
    execFileSync('git', [
      '-C',
      temporary,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'fixture',
    ])
    let result
    try {
      execFileSync(process.execPath, [collector], {
        cwd: temporary,
        env: { ...process.env, PATH: `${join(temporary, 'bin')}:${process.env.PATH}` },
        encoding: 'utf8',
      })
      assert.fail('Wrong pnpm must exit nonzero')
    } catch (error) {
      assert.equal(error.status, 2)
      result = JSON.parse(error.stdout)
    }
    assert.equal(result.audit.status, 'incomplete')
    assert.match(result.audit.reason, /pnpm@9.15.9/)
    assert.equal(result.manifests[1].path, 'templates/default/package.json.tmpl')
    assert.equal(result.manifests[1].peerDependencies.hono, '^4.0.0')
    assert.equal(result.workflowInputs.length, 2)
    assert.match(result.lockfile.sha256, /^[a-f0-9]{64}$/)
    assert.ok(result.pendingReview.includes('cloudflare'))

    writeFileSync(
      fakePnpm,
      `#!/usr/bin/env node\nif (process.argv[2] === '--version') console.log('9.15.9');\nelse if (process.argv.includes('audit')) console.log(${JSON.stringify(response().stdout)});\nelse process.exit(99)\n`,
    )
    const complete = JSON.parse(
      execFileSync(process.execPath, [collector], {
        cwd: temporary,
        env: { ...process.env, PATH: `${join(temporary, 'bin')}:${process.env.PATH}` },
        encoding: 'utf8',
      }),
    )
    assert.equal(complete.audit.status, 'no-findings')
    assert.equal(
      complete.pendingReview.length,
      5,
      'npm success still requires public-source review',
    )
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})
