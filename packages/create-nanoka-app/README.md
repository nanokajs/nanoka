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

Generated projects require Hono `^4.13.16`, including the November 1 middleware
and form-validation fixes. Existing applications must update their own Hono
dependency and lockfile; the scaffolder does not rewrite them.

## Local Workers runtime security

Nanoka 3.0.9 scaffolds and this repository use workerd 1.20261031.1, which
[fixes RPC error stack disclosure between legacy and enhanced serializers](https://github.com/cloudflare/workerd/pull/8087).
This pin updates local multi-Worker RPC tooling. Existing applications must update
their own override and lockfile. Cloudflare controls managed Workers patching;
this local pin does not verify it.

The current runtime also [hides native TypeScript Stream handles from JavaScript reflection](https://github.com/cloudflare/workerd/pull/8095).
This affects the experimental `typescript_implemented_streams` implementation;
Nanoka's tracked application configurations do not enable it. The override keeps
local tooling patched if that feature is enabled separately. It does not enable
the feature or establish a production exploit.

Use Wrangler 4.155.0 or later for escaped terminal controls in Worker/Pages tail
and the main remote-preview log printer. Existing applications must update their
own Wrangler dependency and lockfile; updating core alone does not update it.
Wrangler 4.155.0 still contains a separate retained remote-bindings printer that
forwards controls unchanged. See the [upstream tail fix](https://github.com/cloudflare/workers-sdk/pull/16526)
for its scope; this update does not cover every logging path.

Generated projects pin pnpm 9.15.9 and include a scoped pnpm override for
workerd 1.20261031.1 (Brotli 1.2.1), addressing
[CVE-2026-111497](https://github.com/google/brotli/releases/tag/v1.2.1).
Keep these overrides until your Wrangler/Miniflare dependencies themselves require
a patched workerd. Existing projects must update their own tooling and lockfile;
upgrading the scaffold CLI does not rewrite existing projects.

Generated projects also override esbuild <=0.24.2 to 0.28.2 to cover drizzle-kit's
legacy build helper ([GHSA-67mh-4wv8-2f99](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99)).
Schema generation does not use the affected development-server feature.
