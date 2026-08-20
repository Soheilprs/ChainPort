# Authentication

ChainPort uses **server-side sessions**, not custom password hashing.

## Providers

`AUTH_PROVIDER=oidc` — generic OIDC authorization-code flow (issuer, client id/secret, redirect URI, nonce, state, JWKS signature, audience, expiry).

`AUTH_PROVIDER=test` — deterministic test identities for development and integration tests. **Forbidden when `NODE_ENV=production`.** There is no `AUTH_DISABLED` bypass.

## Session model

- Opaque session token (32+ bytes), stored only as SHA-256 in `sessions.token_hash`
- Cookie `chainport_session`: HttpOnly, Secure in production, SameSite=Lax (dev) / None+Secure (production HTTPS)
- Cookie `chainport_csrf` (readable) + header `x-csrf-token` for cookie-authenticated mutating requests
- Bearer `Authorization: Bearer <token>` is accepted for API clients and skips CSRF (not cookie auth)
- TTL `SESSION_TTL_SECONDS` (default 12h)
- Logout revokes the row; tokens are never logged

## Endpoints

| Method | Path                  | Auth               |
| ------ | --------------------- | ------------------ |
| POST   | `/v1/auth/test/login` | test provider only |
| GET    | `/v1/auth/oidc/start` | public             |
| GET    | `/v1/auth/me`         | optional           |
| POST   | `/v1/auth/logout`     | session            |

Production fails closed if OIDC or `SESSION_SECRET` (≥32 chars) is missing.
