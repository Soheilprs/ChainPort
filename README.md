# ChainPort

EVM application portability, compatibility, migration, and ecosystem intelligence.

ChainPort tells a network and its developers what prevents an existing application from working on
a target chain, and how to migrate it safely.

It is not an RPC provider, explorer, indexer, generic AI coding assistant, generic GitHub scanner,
or generic CI/CD tool.

> **CURRENT STATUS: PHASE 3 — REPOSITORY INTELLIGENCE**
>
> Ingested repositories can be scanned at their stored commit SHA. The scanner records frameworks,
> contracts, dependencies, and network assumptions with evidence. It does not execute repository
> code or score target-chain compatibility.

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

| Service          | URL                               |
| ---------------- | --------------------------------- |
| Web              | <http://localhost:3000>           |
| API health       | <http://localhost:3001/health>    |
| API readiness    | <http://localhost:3001/ready>     |
| Product metadata | <http://localhost:3001/v1/meta>   |
| Chain catalog    | <http://localhost:3001/v1/chains> |
| Create project   | `POST /v1/projects`               |
| Get project      | `GET /v1/projects/:id`            |
| Project jobs     | `GET /v1/projects/:id/jobs`       |
| Get job          | `GET /v1/jobs/:id`                |
| Create analysis  | `POST /v1/projects/:id/analyses`  |
| Get analysis     | `GET /v1/analyses/:id`            |

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
- [Repository ingest](docs/INGEST.md)
- [Scanner](docs/SCANNER.md)
