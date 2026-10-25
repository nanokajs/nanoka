#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
PACK_DIR="$(mktemp -d)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$PACK_DIR" "$WORK_DIR"' EXIT

pnpm -C "$REPO_ROOT/packages/nanoka" build
pnpm -C "$REPO_ROOT/packages/nanoka" pack --pack-destination "$PACK_DIR"
TARBALL="$(ls "$PACK_DIR"/*.tgz | head -n1)"

cp -R "$REPO_ROOT/e2e/onboarding/fixture/." "$WORK_DIR/"
cd "$WORK_DIR"
pnpm add "@nanokajs/core@file:$TARBALL"

# pnpm can install a separate peer copy for core, so exercise the actual caller's
# schema rather than assuming strict peer resolution rejects a second version.
for unsupported in 3.25.76 4.6.5; do
  pnpm add "zod@$unsupported" --ignore-scripts
  node --input-type=module <<'NODE'
import assert from 'node:assert/strict'
import { t } from '@nanokajs/core'
import { z } from 'zod'
assert.throws(() => t.json(z.array(z.string()).max(2)), /requires Zod 4\.6\.6/)
NODE
done

# Verify the supported minimum, rather than only the latest Zod release.
pnpm add zod@4.6.6
node --input-type=module <<'NODE'
import assert from 'node:assert/strict'
import { t } from '@nanokajs/core'
import { z } from 'zod'
assert.deepEqual(t.json(z.array(z.string()).max(2)).zodBase.parse(['ok']), ['ok'])
NODE

# tsc --noEmit が **成功** することを assert
pnpm exec tsc --noEmit
echo "onboarding Zod 4.6.6 minimum and unsupported-schema checks OK"
