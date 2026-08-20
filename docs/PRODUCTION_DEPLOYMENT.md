# Production deployment

Services: web, API, worker, rpc-proxy, sandbox images. Staging uses the same production safety
assertions (`NODE_ENV=production`, `CHAINPORT_DB_PURPOSE=staging` or `production`). See
[STAGING.md](STAGING.md).

## Images (non-root)

- `infrastructure/docker/api/Dockerfile` — `node apps/api/dist/server.js`, `/health`
- `infrastructure/docker/worker/Dockerfile` — `node apps/worker/dist/main.js`, docker CLI for sandboxes
- `infrastructure/docker/web/Dockerfile` — `next start`, `NEXT_PUBLIC_API_URL` baked at build (default `/backend`)
- `infrastructure/docker/rpc-proxy/Dockerfile`
- `infrastructure/docker/sandbox/Dockerfile.foundry` / `node20` / `node22`

Tag `chainport-<service>:<git-sha>`. Do not deploy `latest` as the only identifier.

`NODE_ENV=production` fails closed unless:

- `AUTH_PROVIDER=oidc` with HTTPS issuer/redirect
- `SESSION_SECRET` ≥ 32 characters
- `CHAINPORT_DB_PURPOSE` is `staging` or `production`
- `WEB_ORIGIN` is public HTTPS (not localhost)
- `ARTIFACT_STORE=s3` with bucket + credentials
- `DATABASE_URL` / `REDIS_URL` are not localhost / `host.docker.internal` / sample `chainport:chainport`
- GitHub App id + private key when `ENABLE_PRIVATE_REPOS=true`

Migrations: `pnpm db:deploy` only. Never `migrate reset` or `db push` against staging/production.

Graceful shutdown: API `SIGINT/SIGTERM` stops Fastify, closes the queue, quits Redis, disconnects
Prisma. Worker `stop()` closes BullMQ workers.

Kill switches: `ENABLE_VALIDATION`, `ENABLE_TESTNET_DEPLOYMENT`, `ENABLE_PRIVATE_REPOS`. There is no
`ENABLE_MAINNET`.

TLS terminates at the reverse proxy / load balancer. API `trustProxy` is on in production so
`X-Forwarded-For` and `X-Forwarded-Proto` are honored for rate limits and cookies.

Secrets come from the platform secret manager. Do not copy `.env` into images (`.dockerignore`
excludes them).
