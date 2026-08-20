# Production deployment

Services: web, api, worker, rpc-proxy, sandbox images.

Dockerfiles (non-root):

- `infrastructure/docker/api/Dockerfile`
- `infrastructure/docker/worker/Dockerfile`
- `infrastructure/docker/web/Dockerfile`

`NODE_ENV=production` fails closed unless:

- `AUTH_PROVIDER=oidc` with HTTPS issuer/redirect
- `SESSION_SECRET` ≥ 32 characters
- `CHAINPORT_DB_PURPOSE` is `staging` or `production`
- `WEB_ORIGIN` is public HTTPS
- `ARTIFACT_STORE=s3` with bucket + credentials
- no localhost / sample `chainport:chainport` database URLs

Migrations: `pnpm db:deploy` only. Never `migrate reset` in production.

Graceful shutdown: API `SIGINT/SIGTERM` stops the Fastify server, closes the queue, quits Redis, disconnects Prisma.

Kill switches: `ENABLE_VALIDATION`, `ENABLE_TESTNET_DEPLOYMENT`, `ENABLE_PRIVATE_REPOS`. There is no `ENABLE_MAINNET`.
