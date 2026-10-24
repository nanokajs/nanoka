import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const levels = ['info', 'low', 'moderate', 'high', 'critical']

// pnpm 9 audit exits 1 for findings. All other failures remain incomplete,
// including valid JSON with registry errors, partial counts, or unexpected exits.
export function classifyAudit(result) {
  const incomplete = (reason) => ({ status: 'incomplete', reason })
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    return incomplete('Audit process failed, timed out, or could not start.')
  }
  let report
  try {
    report = JSON.parse(result.stdout)
  } catch {
    return incomplete('Audit did not return valid JSON.')
  }
  const counts = report?.metadata?.vulnerabilities
  const advisories = report?.advisories
  if (
    report?.error ||
    !counts ||
    levels.some((level) => !Number.isSafeInteger(counts[level]) || counts[level] < 0) ||
    !advisories ||
    typeof advisories !== 'object' ||
    Array.isArray(advisories)
  ) {
    return incomplete('Registry error or unsupported audit format.')
  }
  const findings = Object.values(advisories)
  if (
    findings.some(
      (advisory) =>
        !advisory ||
        typeof advisory.module_name !== 'string' ||
        !levels.includes(advisory.severity) ||
        typeof advisory.url !== 'string' ||
        !Array.isArray(advisory.findings) ||
        advisory.findings.length === 0,
    ) ||
    levels.some((level) => findings.filter((a) => a.severity === level).length !== counts[level])
  ) {
    return incomplete('Advisory details are missing or inconsistent with severity counts.')
  }
  const hasFindings = levels.slice(1).some((level) => counts[level] > 0)
  if (result.status !== (hasFindings ? 1 : 0)) {
    return incomplete('Audit exit status is inconsistent with severity counts.')
  }
  return { status: hasFindings ? 'findings' : 'no-findings', counts, advisories }
}

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
  })
}

export function collectReport(root = process.cwd()) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const lockfile = readFileSync(resolve(root, 'pnpm-lock.yaml'))
  const tracked = run('git', ['-C', root, 'ls-files', '-z'])
  const revision = run('git', ['-C', root, 'rev-parse', 'HEAD'])
  if (tracked.status !== 0 || revision.status !== 0) {
    throw new Error('Cannot read repository inventory or revision.')
  }
  const files = tracked.stdout.split('\0').filter(Boolean)
  const manifests = files
    .filter((file) => /(^|\/)package\.json(?:\.tmpl)?$/.test(file))
    .map((file) => {
      const pkg = JSON.parse(readFileSync(resolve(root, file), 'utf8'))
      return {
        path: file,
        name: pkg.name,
        version: pkg.version,
        engines: pkg.engines,
        dependencies: pkg.dependencies,
        devDependencies: pkg.devDependencies,
        optionalDependencies: pkg.optionalDependencies,
        peerDependencies: pkg.peerDependencies,
      }
    })
  const workflowInputs = files
    .filter((file) => /^\.github\/workflows\/.*\.ya?ml$/.test(file))
    .flatMap((file) =>
      readFileSync(resolve(root, file), 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          /^\s*(?:-\s*)?(?:uses|node-version):/.test(line)
            ? [{ path: file, line: index + 1, text: line.trim() }]
            : [],
        ),
    )
  const version = run('pnpm', ['--version'])
  const expected = manifest.packageManager
  const actual = version.stdout?.trim()
  const audit =
    version.status === 0 && expected === `pnpm@${actual}`
      ? classifyAudit(
          run('pnpm', [
            '--dir',
            root,
            'audit',
            '--audit-level=low',
            '--json',
            '--registry=https://registry.npmjs.org',
          ]),
        )
      : { status: 'incomplete', reason: `Use the packageManager pin: ${expected}.` }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    revision: revision.stdout.trim(),
    lockfile: {
      path: 'pnpm-lock.yaml',
      sha256: createHash('sha256').update(lockfile).digest('hex'),
    },
    runtime: { node: process.version, expectedPackageManager: expected },
    manifests,
    workflowInputs,
    audit,
    // These require official-source retrieval and source-code impact analysis.
    pendingReview: [
      'public-advisories',
      'peer-and-template-ranges',
      'nodejs',
      'github-actions',
      'cloudflare',
    ],
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = collectReport()
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    process.exitCode = { 'no-findings': 0, findings: 1, incomplete: 2 }[report.audit.status]
  } catch {
    // Do not echo command stderr, environment variables, or credential-bearing URLs.
    process.stdout.write(
      `${JSON.stringify({ schemaVersion: 1, audit: { status: 'incomplete', reason: 'Repository inventory failed.' } })}\n`,
    )
    process.exitCode = 2
  }
}
