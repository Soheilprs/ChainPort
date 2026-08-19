# Architecture

TypeScript monorepo. Domain logic lives in packages. Apps are thin adapters.

```
apps/
  web/          Next.js UI
  api/          Fastify HTTP API
  worker/       BullMQ ingest processor

packages/
  shared/       Product constants, enums, job state machine, config, GitHub URL parsing
  evm/          Address and chain ID utilities
  chain-registry/ Static catalog of source and target chains
  ingest/       Workspace manager and safe Git clone
  scanner/      Contract only
  compatibility/ Contract only
  migration/    Contract only
  sandbox/      Security policy; runner not implemented
  db/           Prisma schema and client
```

`packages/db` shares one Prisma client between API and worker. `packages/ingest` owns clone and
workspace isolation so API/UI cannot reach the filesystem.

## Principles

- Deterministic analysis wherever possible. Do not use an LLM where parsing can solve the problem.
- No fake functionality presented as production functionality.
- Jobs have explicit statuses and an allow-list of transitions.
- Phase 2 ingest completes at `INGESTING → COMPLETED`. It does not enter `ANALYZING`.
- Retries are explicit: `FAILED → QUEUED` while `attempt < maxAttempts` and the error is retryable.
- Ingest idempotency key: `github:<owner>:<repo>:<sourceChainKey>:<targetChainKey>`.
- Errors are not swallowed. Health and readiness are separate.
- Repository execution is forbidden on the host.

## Runtime

| Service | Port | Dependencies      |
| ------- | ---- | ----------------- |
| Web     | 3000 | API for ingest UI |
| API     | 3001 | PostgreSQL, Redis |
| Worker  | —    | PostgreSQL, Redis |

`GET /health` is process liveness and does not touch dependencies. `GET /ready` checks PostgreSQL
and Redis and returns HTTP 503 on failure without leaking connection strings.

## Ingest path

1. API parses and canonicalizes a public GitHub URL.
2. API upserts `Repository` and `Project`, creates a `MigrationJob` if needed, and enqueues
   `ingest-repository`.
3. Worker claims the job, allocates a UUID workspace, clones with Git hooks disabled, resolves
   `HEAD`, persists the SHA, and deletes the workspace.

See [INGEST.md](INGEST.md).

## Data

See [DATABASE.md](DATABASE.md).
