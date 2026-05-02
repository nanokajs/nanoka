#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
PACK_DIR="$(mktemp -d)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$PACK_DIR" "$WORK_DIR"' EXIT

pnpm -C "$REPO_ROOT/packages/nanoka" build
pnpm -C "$REPO_ROOT/packages/nanoka" pack --pack-destination "$PACK_DIR"
TARBALL="$(ls "$PACK_DIR"/*.tgz | head -n1)"
echo "tarball=$TARBALL"

cp -R "$REPO_ROOT/e2e/onboarding/fixture/." "$WORK_DIR/"

cd "$WORK_DIR"
pnpm add "@nanokajs/core@file:$TARBALL"

pnpm exec nanoka generate
pnpm exec drizzle-kit generate
pnpm exec tsc --noEmit

test -d drizzle/migrations
test "$(find drizzle/migrations -maxdepth 1 -name '*.sql' | wc -l)" -gt 0

echo "onboarding happy path OK"
