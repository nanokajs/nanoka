# @nanokajs/auth

Authentication utilities for Nanoka on Cloudflare Workers.

Provides credential validation, JWT issuance, and Hono middleware — built on `crypto.subtle`, zero runtime dependencies beyond Hono.

## Install

```bash
pnpm add @nanokajs/auth
```

Peer dependencies: `@nanokajs/core ^1.0.0`, `hono ^4.0.0`.

## Usage

### Basic (JSON body)

```ts
import { createAuth } from '@nanokajs/auth'
import { nanoka, d1Adapter } from '@nanokajs/core'

const app = nanoka(d1Adapter(env.DB))
const User = app.model('users', { /* fields */ })

const auth = createAuth({
  model: User,
  secret: env.AUTH_SECRET,        // must be >= 32 chars
  fields: { identifier: 'email', password: 'passwordHash' },
})

app.post('/login', auth.loginHandler())    // returns { accessToken, refreshToken }
app.post('/refresh', auth.refreshHandler()) // returns { accessToken }
app.use('/api/*', auth.middleware())
```

### Cookie mode

Pass `cookie: {}` to enable HttpOnly cookie delivery. The `cookie` option is entirely optional — omitting it preserves the existing JSON body behavior.

```ts
const auth = createAuth({
  model: User,
  secret: env.AUTH_SECRET,
  fields: { identifier: 'email', password: 'passwordHash' },
  cookie: {
    httpOnly: true,      // default: true
    sameSite: 'Lax',    // default: 'Lax'  ('Strict' | 'Lax' | 'None')
    secure: true,        // default: true
    path: '/',           // default: '/'
    accessTokenName: 'access_token',   // default: 'access_token'
    refreshTokenName: 'refresh_token', // default: 'refresh_token'
  },
})
```

When `cookie` is set:

- `loginHandler()` sets two `Set-Cookie` headers (`access_token`, `refresh_token`) and returns `{ ok: true }` — tokens are not in the response body.
- `refreshHandler()` reads the refresh token from the `refresh_token` cookie. If the cookie is absent and `jwt.rotation` is `false`, it falls back to `body.refreshToken` to support non-browser clients. When `jwt.rotation` is `true`, the body fallback is **disabled** — the cookie must be present or the request is rejected with 401. This prevents XSS-obtained refresh tokens from bypassing the `SameSite` cookie defence by sending them directly as JSON.
- On successful refresh, the new access token is written back via `Set-Cookie` and the body is `{ ok: true }`. When `jwt.rotation` is `true`, the refresh token is also rotated and written back via `Set-Cookie: refresh_token=<new>`. When rotation is disabled (the default), the `refresh_token` cookie is not overwritten.

```ts
app.post('/login', auth.loginHandler())
app.post('/refresh', auth.refreshHandler())
```

## Refresh token rotation

Refresh token rotation replaces the refresh token on every use, making stolen token reuse detectable on a best-effort basis.

> **Note:** With the KV-backed `BlacklistStore`, detection is eventually consistent — a small race window exists where two simultaneous refreshes from different regions may both succeed. For strong consistency, see Issue #115 (D1-backed store, planned).

### Enabling rotation

```ts
import { createAuth, kvBlacklistStore } from '@nanokajs/auth'

const auth = createAuth({
  model: User,
  secret: env.AUTH_SECRET,
  fields: { identifier: 'email', password: 'passwordHash' },
  jwt: { rotation: true },
  blacklist: kvBlacklistStore(env.REFRESH_BLACKLIST_KV),
})
```

- `jwt.rotation` defaults to `false`. When rotation is disabled, refresh tokens remain valid until their `exp` and can be reused any number of times. If stolen token detection is required, enable `rotation: true` together with a `BlacklistStore`.
- `blacklist` is **required** when `rotation: true`. Passing `rotation: true` without `blacklist` throws an error at `createAuth` call time (fail-fast).
- When rotation is enabled, `loginHandler` embeds a `jti` claim in the refresh token. `refreshHandler` verifies the `jti`, rejects it if it is already blacklisted, blacklists the old `jti`, and issues a new refresh token with a fresh `jti`.

### Response shape

| Mode | `refreshHandler` response |
|---|---|
| rotation disabled (default) | `{ accessToken }` |
| rotation enabled (JSON body) | `{ accessToken, refreshToken }` |
| rotation enabled (cookie mode) | `{ ok: true }` + `Set-Cookie: access_token=<new>; Set-Cookie: refresh_token=<new>` |

### KV blacklist store

`kvBlacklistStore(kv, opts?)` stores blacklisted JTIs in a Workers KV namespace. TTL is derived from the token's `exp` claim, with a minimum of 60 seconds (KV lower bound).

```ts
kvBlacklistStore(env.REFRESH_BLACKLIST_KV, { prefix: 'my-app:bl:' })
```

| Option | Default |
|---|---|
| `prefix` | `'nanoka-auth:bl:'` |

A D1-backed blacklist store is planned as a follow-up.

## Rate limiting

`loginHandler()` does not include built-in rate limiting or brute-force protection. Protect the login endpoint at the infrastructure or middleware layer before deploying to production. Options include:

- Cloudflare WAF rate limiting rules (recommended for Workers deployments)
- A Hono middleware that tracks failed attempts per IP or identifier and returns `429 Too Many Requests`

Without rate limiting, an attacker can enumerate passwords against any valid identifier at the speed the Worker allows.

## CSRF considerations

`middleware()` only accepts `Authorization: Bearer <token>`. Cookie-based access tokens are **not** read by the middleware — they are intended for browser clients that forward the cookie through a backend-for-frontend (BFF) pattern, or for setups where `httpOnly: false` is explicitly configured so that JavaScript can read the token and attach it as a Bearer header.

When using `SameSite` cookies for browser flows, apply CSRF protection appropriate to your deployment:

| Scenario | Recommended approach |
|---|---|
| Same-site (same eTLD+1) | `sameSite: 'Strict'` — browser refuses cross-site cookie send |
| Cross-origin API | `sameSite: 'Lax'` + Double Submit Cookie (send a readable CSRF token in a separate non-HttpOnly cookie; validate it server-side on state-changing requests) |

`SameSite: None` requires `secure: true` and is only needed for explicitly cross-site embedded contexts. Avoid it unless you have a specific cross-origin embedding requirement.

## API reference

### `createAuth(opts)`

| Option | Type | Default | Description |
|---|---|---|---|
| `model` | `NanokaModel<any>` | required | The user model |
| `secret` | `string` | required | HS256 signing secret (min 32 chars) |
| `fields.identifier` | `string` | required | Field name used as the login identifier (e.g. `'email'`) |
| `fields.password` | `string` | required | Field name storing the password hash |
| `hasher` | `Hasher` | `pbkdf2Hasher` | Custom hasher interface (`hash` / `verify`) |
| `jwt.expiresIn` | `number` | `900` | Access token TTL in seconds |
| `jwt.refreshExpiresIn` | `number` | `604800` | Refresh token TTL in seconds |
| `jwt.rotation` | `boolean` | `false` | Enable refresh token rotation (requires `blacklist`) |
| `blacklist` | `BlacklistStore` | `undefined` | Blacklist store for rotation (required when `rotation: true`) |
| `cookie` | `CookieOptions` | `undefined` | Cookie delivery options (see below) |

### `CookieOptions`

| Field | Type | Default |
|---|---|---|
| `httpOnly` | `boolean` | `true` |
| `sameSite` | `'Strict' \| 'Lax' \| 'None'` | `'Lax'` |
| `secure` | `boolean` | `true` |
| `path` | `string` | `'/'` |
| `accessTokenName` | `string` | `'access_token'` |
| `refreshTokenName` | `string` | `'refresh_token'` |

### `authMiddleware({ secret })`

Standalone middleware (also available as `auth.middleware()`). Reads `Authorization: Bearer <token>`, verifies the HS256 signature, and calls `c.set('user', payload)`.

Rejects requests that:
- have no `Authorization` header
- use a scheme other than `Bearer` (case-insensitive)
- carry an expired or tampered token
- carry a refresh token where an access token is expected

## Limitations

- **`Set-Cookie` overwrite is browser-dependent.** When rotation is enabled in cookie mode, `refreshHandler` writes a new `refresh_token` via `Set-Cookie`. Whether the browser replaces the old cookie depends on cookie attribute matching (name, domain, path, secure). Ensure your `cookie` options are consistent across all endpoints.
- **No built-in rate limiting.** `loginHandler` does not throttle requests. Protect the endpoint at the infrastructure layer.
- **D1 blacklist store not yet available.** The current blacklist implementation is KV-only. A D1-backed implementation is planned as a follow-up issue.
