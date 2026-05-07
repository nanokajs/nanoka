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
- `refreshHandler()` reads the refresh token from the `refresh_token` cookie. If the cookie is absent, it falls back to `body.refreshToken`. This fallback exists to support non-browser clients; it means a valid refresh token in the request body is accepted even in cookie mode. If you need strict cookie-only behaviour, enforce it at the route level (e.g. reject requests that do not carry the cookie). A built-in strict mode is a future option (TODO).
- On successful refresh, the new access token is written back via `Set-Cookie` and the body is `{ ok: true }`. The refresh token is **not** rotated — `refreshHandler()` does not issue a new refresh token or overwrite the `refresh_token` cookie. If refresh token rotation is required, implement it in a custom route handler using `app.db` directly.

```ts
app.post('/login', auth.loginHandler())
app.post('/refresh', auth.refreshHandler())
```

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
