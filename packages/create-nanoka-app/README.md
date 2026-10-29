# create-nanoka-app

Create a new Nanoka (Hono + Drizzle + D1) project in seconds.

## Requirements

- **Node.js 22 or later.** The generated project ships `wrangler` 4 (engines `node >= 22`), so scaffolded projects declare `"engines": { "node": ">=22" }`.

## Usage

```bash
pnpm create nanoka-app my-app
# or
npx create-nanoka-app my-app
```

## Getting started

After scaffolding:

```bash
cd my-app
pnpm install
pnpm exec nanoka generate
pnpm exec drizzle-kit generate
pnpm dev
```

## Local Workers runtime security

Use Wrangler 4.155.0 or later for escaped terminal controls in Worker/Pages tail
and the main remote-preview log printer. Existing applications must update their
own Wrangler dependency and lockfile; updating core alone does not update it.
Wrangler 4.155.0 still contains a separate retained remote-bindings printer that
forwards controls unchanged. See the [upstream tail fix](https://github.com/cloudflare/workers-sdk/pull/16526)
for its scope; this update does not cover every logging path.

Generated projects pin pnpm 9.15.9 and include a scoped pnpm override for
workerd 1.20261027.1 (Brotli 1.2.1), addressing
[CVE-2026-111497](https://github.com/google/brotli/releases/tag/v1.2.1).
Keep these overrides until your Wrangler/Miniflare dependencies themselves require
a patched workerd. Existing projects must update their own tooling and lockfile;
upgrading the scaffold CLI does not rewrite existing projects.

Generated projects also override esbuild <=0.24.2 to 0.28.2 to cover drizzle-kit's
legacy build helper ([GHSA-67mh-4wv8-2f99](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99)).
Schema generation does not use the affected development-server feature.
