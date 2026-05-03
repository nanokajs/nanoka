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

# zod を ^4 に上書き
pnpm add zod@^4.0.0

# tsc --noEmit が **成功** することを assert
pnpm exec tsc --noEmit
echo "onboarding zod4 OK (typecheck passes with zod@^4)"
