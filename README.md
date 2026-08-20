# ChainPort

EVM application portability, compatibility, migration, and ecosystem intelligence.

ChainPort tells a network and its developers what prevents an existing application from working on
a target chain, and how to migrate it safely.

It is not an RPC provider, explorer, indexer, generic AI coding assistant, generic GitHub scanner,
or generic CI/CD tool.

> **CURRENT STATUS: PHASE 11 — PILOT HARDENING**
>
> Authentication, authorization, rate limits, audit, and production fail-closed configuration are
> in place so a controlled network pilot can start. External gates (real OIDC, GitHub App, object
> storage, public testnet funder) may still be unconfigured.

## Prerequisites

- Node.js 22 or newer
- pnpm 10 or newer
- Docker with Docker Compose

## Local setup

```bash
cp .env.example .env
pnpm install
pnpm infra:up
pnpm db:deploy
pnpm db:prepare-local
pnpm dev
```

Sample PostgreSQL and Redis credentials are for local development only. Local Compose publishes
PostgreSQL on port 5433. Replace these credentials in any shared or deployed environment. No
secret values have application defaults.

`pnpm dev` builds workspace packages and launches the API, worker, and web application together.

## Service URLs

| Service                | URL                                                 |
| ---------------------- | --------------------------------------------------- |
| Web                    | <http://localhost:3000>                             |
| API health             | <http://localhost:3001/health>                      |
| API readiness          | <http://localhost:3001/ready>                       |
| Product metadata       | <http://localhost:3001/v1/meta>                     |
| Chain catalog          | <http://localhost:3001/v1/chains>                   |
| Create project         | `POST /v1/projects`                                 |
| Get project            | `GET /v1/projects/:id`                              |
| Project jobs           | `GET /v1/projects/:id/jobs`                         |
| Get job                | `GET /v1/jobs/:id`                                  |
| Create analysis        | `POST /v1/projects/:id/analyses`                    |
| Get analysis           | `GET /v1/analyses/:id`                              |
| Create compatibility   | `POST /v1/projects/:id/compatibility-runs`          |
| Get compatibility      | `GET /v1/compatibility-runs/:id`                    |
| Create migration plan  | `POST /v1/compatibility-runs/:id/migration-plans`   |
| Get migration plan     | `GET /v1/migration-plans/:id`                       |
| Create ChangeSet       | `POST /v1/migration-plans/:id/change-sets`          |
| Get ChangeSet          | `GET /v1/change-sets/:id`                           |
| Accept / reject        | `POST /v1/change-sets/:id/changes/:changeId/accept` |
| Finalize / rollback    | `POST /v1/change-sets/:id/finalize`                 |
| Validate revision      | `POST /v1/revisions/:id/validations`                |
| Get validation         | `GET /v1/validations/:id`                           |
| Prepare deployment     | `POST /v1/revisions/:id/deployments`                |
| Confirm broadcast      | `POST /v1/deployments/:id/confirm`                  |
| Get deployment         | `GET /v1/deployments/:id`                           |
| Network partners       | `GET /v1/network-partners`                          |
| Partner overview       | `GET /v1/network-partners/:id/overview`             |
| Public partner config  | `GET /v1/public/partners/:slug`                     |
| Partner project create | `POST /v1/public/partners/:slug/projects`           |

`/health` does not touch PostgreSQL or Redis. `/ready` returns HTTP 503 when either is unavailable.

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm format
pnpm format:check
pnpm infra:up
pnpm infra:down
pnpm db:deploy
pnpm db:studio
```

## Documentation

- [Product](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Phases](docs/PHASES.md)
- [Compatibility engine](docs/COMPATIBILITY_ENGINE.md)
- [Migration planner](docs/MIGRATION_PLANNER.md)
- [ChangeSet engine](docs/CHANGESET_ENGINE.md)
- [Revision storage](docs/REVISION_STORAGE.md)
- [Validation engine](docs/VALIDATION_ENGINE.md)
- [Sandbox security](docs/SANDBOX_SECURITY.md)
- [Repository ingest](docs/INGEST.md)
- [Scanner](docs/SCANNER.md)
