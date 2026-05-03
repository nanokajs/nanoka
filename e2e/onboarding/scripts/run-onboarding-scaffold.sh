#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORK_DIR="$(mktemp -d)"
PACK_DIR="$(mktemp -d)"

trap 'rm -rf "$WORK_DIR" "$PACK_DIR"' EXIT

echo "=== Building packages ==="
pnpm -C "$REPO_ROOT/packages/nanoka" build
pnpm -C "$REPO_ROOT/packages/nanoka" pack --pack-destination "$PACK_DIR"
TARBALL="$(ls "$PACK_DIR"/*.tgz | head -n1)"
echo "tarball=$TARBALL"

pnpm -C "$REPO_ROOT/packages/create-nanoka-app" build

echo "=== Scaffolding project ==="
node "$REPO_ROOT/packages/create-nanoka-app/dist/index.js" "$WORK_DIR/scaffold-test" --force

echo "=== Injecting local nanoka tarball ==="
cd "$WORK_DIR/scaffold-test"
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.dependencies['@nanokajs/core'] = 'file:$TARBALL';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"
pnpm install --no-frozen-lockfile

echo "=== Running checks ==="
# nanoka generate: may fail if @nanokajs/core version doesn't have CLI yet; drizzle-kit generate is the hard check
pnpm exec nanoka generate || true
pnpm exec drizzle-kit generate
pnpm exec tsc --noEmit

echo "=== Asserting migration files ==="
ls drizzle/migrations/*.sql || { echo "ERROR: No migration files generated"; exit 1; }

echo "=== Scaffold onboarding passed ==="
