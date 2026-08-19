# Architecture

TypeScript monorepo. Domain logic lives in packages. Apps are thin adapters.

```
apps/
  web/          Next.js UI
  api/          Fastify HTTP API
  worker/       BullMQ ingest + analysis + changeset processors

packages/
  shared/       Product constants, enums, job state machine, config, GitHub URL parsing
  evm/          Address and chain ID utilities
  chain-registry/ Static catalog of source and target chains
  ingest/       Workspace manager and safe Git clone
  scanner/      Deterministic static analysis
  compatibility/ Deterministic target-chain comparison engine
  migration/    Deterministic migration planner
  changeset/    Safe patchers, diffs, content hash, artifact store
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

## Compatibility path

1. API loads a completed analysis and the selected source/target chains.
2. `@chainport/chain-registry` builds a canonical capability snapshot and SHA-256 hash.
3. If a completed `CompatibilityRun` already exists for
   `analysisId + targetChainKey + rulesetVersion + snapshotHash`, it is reused.
4. `@chainport/compatibility` evaluates rules in-process (no worker, no network, no repository I/O).
5. Findings, category scores, readiness, and the snapshot JSON are persisted.

See [COMPATIBILITY_ENGINE.md](COMPATIBILITY_ENGINE.md).

## Migration planning path

1. API loads a completed compatibility run, its findings, evidence, and **stored** registry snapshot.
2. `@chainport/migration` maps findings to actions, deduplicates, classifies automation/risk, and
   orders stages/dependencies.
3. If a completed plan already exists for `compatibilityRunId + migrationRulesetVersion`, it is reused.
4. The plan is persisted. No repository I/O.

See [MIGRATION_PLANNER.md](MIGRATION_PLANNER.md).

## ChangeSet path

1. API loads a completed migration plan and creates or reuses a ChangeSet keyed by
   `plan + SHA + engine version`.
2. Worker rematerializes the stored SHA, runs safe patchers, and persists `PROPOSED` diffs.
3. API accept/reject (and optional accept-all) update change rows only.
4. Worker finalizes accepted patches into a generated `RepositoryRevision` under the artifact store.
5. Rollback reselects the original revision. The GitHub repository is never written.

See [CHANGESET_ENGINE.md](CHANGESET_ENGINE.md) and [REVISION_STORAGE.md](REVISION_STORAGE.md).

## Data

See [DATABASE.md](DATABASE.md).
