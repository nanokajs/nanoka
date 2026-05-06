# Changelog

All notable changes to `@nanokajs/auth` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] — 2026-05-07

### Added

- `createAuth(opts)` — factory that returns `loginHandler()`, `refreshHandler()`, and `middleware()` from a single configuration object.
  - `loginHandler()`: validates credentials against a `NanokaModel`, issues HS256 access and refresh tokens. Applies a timing-safe dummy hash comparison when the identifier is not found.
  - `refreshHandler()`: accepts a refresh token and issues a new access token. Rejects access tokens used as refresh tokens.
  - `middleware()`: thin wrapper around `authMiddleware({ secret })`.
  - Configurable `hasher` (defaults to `pbkdf2Hasher`), `jwt.expiresIn` (default 900 s), and `jwt.refreshExpiresIn` (default 604 800 s).

## [1.2.0] — 2026-05-06

### Added

- `authMiddleware({ secret })`: Hono Bearer token validation middleware with generics + Hono `Variables` support.

## [1.1.0] — 2026-05-05

### Added

- `sign` / `verify`: HS256 JWT utilities using `crypto.subtle` (zero-dependency).

## [1.0.0] — 2026-05-04

### Added

- `Hasher` interface (`hash` / `verify`).
- `pbkdf2Hasher`: zero-dependency PBKDF2 implementation using `crypto.subtle` (SHA-256, 310 000 iterations, timing-safe comparison).
