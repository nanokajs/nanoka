import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packages = [
  { directory: 'nanoka', command: 'nanoka', target: 'dist/cli.js' },
  { directory: 'create-nanoka-app', command: 'create-nanoka-app', target: 'dist/index.js' },
]

// Build both packages first. Packing is local-only and never runs lifecycle scripts.
for (const { directory, command, target } of packages) {
  test(`${command}: packed CLI metadata and executable`, () => {
    const temporary = mkdtempSync(join(tmpdir(), 'nanoka-package-bin-'))
    try {
      const source = join(root, 'packages', directory)
      const packed = JSON.parse(
        execFileSync(
          'npm',
          ['pack', '--json', '--offline', '--ignore-scripts', '--pack-destination', temporary],
          { cwd: source, encoding: 'utf8' },
        ),
      )
      assert.equal(packed.length, 1)
      assert.ok(
        packed[0].files.some((file) => file.path === target),
        `${target} must be packed`,
      )
      execFileSync('tar', ['-xzf', join(temporary, packed[0].filename), '-C', temporary])
      const extracted = join(temporary, 'package')
      const manifestPath = join(extracted, 'package.json')
      const packedManifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

      // Use the active npm's public normalization command, also used by publication.
      // npm 11 misleadingly says "invalid and removed" when stripping a leading './'.
      execFileSync('npm', ['pkg', 'fix', '--ignore-scripts', '--offline'], { cwd: extracted })
      const normalizedManifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      const expectedBin = { [command]: target }
      assert.deepEqual(normalizedManifest.bin, expectedBin, 'npm must retain the CLI registration')
      assert.deepEqual(packedManifest.bin, expectedBin, 'bin paths must already be normalized')

      const executable = join(extracted, target)
      assert.ok(statSync(executable).isFile())
      assert.match(readFileSync(executable, 'utf8'), /^#!\/usr\/bin\/env node\r?\n/)
      assert.ok(statSync(executable).mode & 0o111, 'packed CLI must be executable')

      // Reuse installed runtime dependencies, but execute only code extracted from the tarball.
      // This is a packaging smoke test, not a fresh-install or dependency-resolution test.
      symlinkSync(join(source, 'node_modules'), join(extracted, 'node_modules'), 'dir')
      const bin = join(temporary, 'bin')
      mkdirSync(bin)
      const shim = join(bin, command)
      symlinkSync(executable, shim)
      const workingDirectory = join(temporary, 'empty')
      mkdirSync(workingDirectory)
      const help = execFileSync(shim, ['--help'], {
        cwd: workingDirectory,
        encoding: 'utf8',
        timeout: 10_000,
      })
      assert.ok(help.includes(`Usage: ${command} `), 'installed-style symlink must print help')
      assert.deepEqual(readdirSync(workingDirectory), [], '--help must not create project files')
    } finally {
      rmSync(temporary, { recursive: true, force: true })
    }
  })
}
