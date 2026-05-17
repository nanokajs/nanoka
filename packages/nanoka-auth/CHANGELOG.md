# Changelog

All notable changes to `@nanokajs/auth` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] — 2026-05-17

### Added

- `BlacklistStore` interface に optional な `addWithSubject(jti, sub, expiresAt)` / `hasForSubject(jti, sub)` を追加。実装すれば `refreshHandler` が自動で sub 一致チェックを行い、jti 単独でのログアウト攻撃に対する防御の深さが向上する。既存実装は無影響（後方互換）。

### Security

- `kvBlacklistStore` のキーを生 jti から `SHA-256(jti)` ハッシュへ変更。KV `list()` での jti 列挙を遮断。
- `kvBlacklistStore` に `addWithSubject` / `hasForSubject` を実装。値に sub を JSON 形式で格納。
- `refreshHandler` の `HTTPException(401, …)` から `cause` プロパティを削除し、verify 内部エラーがユーザーカスタム `onError` 経由でレスポンスに漏洩するリスクを遮断。`middleware()` 側も同様の対応。サーバー側ログには `console.warn` で残す。
- `refreshHandler` で cookie モードの空文字列 (`refresh_token=`) を `undefined` と同等扱いし、適切な fallback / 401 経路へ振り分ける。
- `refreshHandler` で `payload.jti` の長さ上限 256 文字、文字種 `[A-Za-z0-9_-]+` の検証を追加。KV キー上限と異常値混入対策。
- `jwt.ts` の `verify()` で `alg` 検証順序を整理。`'none'` を大文字小文字非依存で拒否してから `'HS256'` ホワイトリストを適用。

### Breaking notes

- 既存の `kvBlacklistStore` で v1.5.x 以前に格納された KV エントリ（生 jti キー）は v1.6.0 移行後に無効化される。Workers 移行後、blacklist は実質クリア状態となる。短命なエントリ（refresh token TTL 期間内）のみ影響するため、ほとんどのユーザーは追加対応不要。

## [1.5.1] — 2026-05-10

### Fixed

- `authMiddleware`: reject tokens without `type: 'access'` claim. Previously a refresh token passed via `Authorization: Bearer` could pass through standalone `authMiddleware`, since the `type` claim check was only present in `createAuth().middleware()`. Now both code paths enforce `payload.type === 'access'` and return 401 otherwise. Affects users of standalone `authMiddleware` only; `createAuth().middleware()` was unaffected. Security fix; aligns runtime with the behavior already documented in the README.

<!--
[1.5.0] entry is missing here. v1.5.0 changes shipped without a changelog entry; the gap will be backfilled in a follow-up. See git history for the v1.5.0 release.
-->

## [1.4.0] — 2026-05-07

### Added

- `CookieOptions` interface and `cookie?` field on `CreateAuthOptions`.
  - `loginHandler()`: when `cookie` is set, writes `access_token` and `refresh_token` as `Set-Cookie` headers (`HttpOnly`, `SameSite=Lax`, `Secure` by default) and returns `{ ok: true }` instead of tokens in the body.
  - `refreshHandler()`: when `cookie` is set, reads the refresh token from the cookie (falls back to `body.refreshToken` if absent); on success writes the new access token via `Set-Cookie` and returns `{ ok: true }`.
  - All cookie attributes (`httpOnly`, `sameSite`, `secure`, `path`, `accessTokenName`, `refreshTokenName`) are configurable with sensible secure defaults.
  - Omitting `cookie` preserves the existing JSON body behavior — no breaking change.

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
