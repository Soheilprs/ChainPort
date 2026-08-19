# Architecture

TypeScript monorepo. Domain logic lives in packages. Apps are thin adapters.

```
apps/
  web/          Next.js UI
  api/          Fastify HTTP API
  worker/       Job process (no processors in phase 1)

packages/
  shared/       Product constants, enums, job state machine, config, GitHub URL parsing
  evm/          Address and chain ID utilities
  chain-registry/ Static catalog of source and target chains
  scanner/      Contract only
  compatibility/ Contract only
  migration/    Contract only
  sandbox/      Security policy; runner not implemented
  db/           Prisma schema and client
```

`packages/db` is an addition to the original package list so API and worker share one Prisma client.

## Principles

- Deterministic analysis wherever possible. Do not use an LLM where parsing can solve the problem.
- No fake functionality presented as production functionality.
- Jobs have explicit statuses and an allow-list of transitions.
- Retries are explicit: `FAILED → QUEUED` while `attempt < maxAttempts`.
- Idempotency keys are `projectId:sourceChainKey:targetChainKey:repoSha`.
- Errors are not swallowed. Health and readiness are separate.
- Repository execution is forbidden on the host (`@chainport/sandbox`).

## Runtime

| Service | Port | Dependencies           |
| ------- | ---- | ---------------------- |
| Web     | 3000 | none for catalog pages |
| API     | 3001 | PostgreSQL, Redis      |
| Worker  | —    | PostgreSQL, Redis      |

`GET /health` is process liveness and does not touch dependencies. `GET /ready` checks PostgreSQL
and Redis and returns HTTP 503 on failure without leaking connection strings.

## Chain registry

The registry is the source of truth for chain identity and declared capabilities. The API exposes
it at `/v1/chains`. The web app reads the package directly so the catalog remains available if the
API is down.

Infrastructure availability is `available`, `partial`, `missing`, or `unknown`. Unknown is preferred
over invented coverage.

## Data

See [DATABASE.md](DATABASE.md). Persistence exists for organizations, projects, jobs, findings,
plans, sandbox runs, and deployments. Phase 1 does not write application jobs.
