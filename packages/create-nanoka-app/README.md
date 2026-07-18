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
