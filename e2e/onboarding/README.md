# Onboarding parity E2E

This directory contains an E2E fixture that verifies Nanoka's onboarding experience when installed from a published tarball (equivalent to `npm install @nanokajs/core`).

The `fixture/` subdirectory is a minimal Nanoka project scaffold that mimics the result of `pnpm create hono@latest` plus the install steps from `packages/nanoka/README.md`. It does not use workspace symlinks; instead, CI passes a locally-built tarball to verify that the published package works standalone.

## Rationale

`examples/basic/` runs within the workspace, so it uses symlinks and workspace resolution. `e2e/onboarding/fixture/` simulates a fresh install on a user's machine, catching regressions that symlinks would mask (missing `bin` exports, broken `nanoka generate` paths, missing peer dependencies, etc.).

### Why @nanokajs/core is not in fixture/package.json

`@nanokajs/core` is intentionally **not listed** in `fixture/package.json`. The CI scripts (`run-onboarding.sh` / `run-onboarding-zod4.sh`) run `pnpm pack` on the in-repo `packages/nanoka` and inject the resulting tarball via `pnpm add file:...` at runtime. This ensures the E2E always exercises the current source tree, not a stale npm release.

## Hand-run verification

From the repo root, run:

```bash
bash e2e/onboarding/scripts/run-onboarding.sh
bash e2e/onboarding/scripts/run-onboarding-zod4.sh
```

The first script exercises the happy path: `nanoka generate`, `drizzle-kit generate`, and `tsc --noEmit` must all succeed.

The second script verifies the zod@^4 regression: after installing `zod@^4.0.0`, `tsc --noEmit` must fail (the script inverts the exit code, so a typecheck failure is a script success).

## Updating the fixture

When you modify `packages/nanoka/README.md` Install or Quickstart sections, also update `fixture/package.json`, `fixture/tsconfig.json`, `fixture/src/`, etc. to match. The Onboarding parity CI workflow will fail if they drift.

## CI

See `.github/workflows/onboarding.yml`. This workflow runs on `push` to `main` and on all pull requests.
