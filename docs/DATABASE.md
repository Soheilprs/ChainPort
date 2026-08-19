# Database

PostgreSQL via Prisma. Local Compose also runs Redis for later job processing. The
development server publishes PostgreSQL on host port **5433** so it does not collide with other
local catalogs that already use 5432.

## Catalogs

| Purpose          | Database                | Use                          |
| ---------------- | ----------------------- | ---------------------------- |
| development      | `chainport`             | local API and worker         |
| integration-test | `chainport_integration` | `pnpm test:integration` only |
| validation       | `chainport_validation`  | reserved                     |

`CHAINPORT_DB_PURPOSE` must match the catalog. Integration tests refuse any other database name.

## Safety

- `.env` is not committed.
- `pnpm test` does not require PostgreSQL.
- `pnpm test:integration` loads `.env.integration` and aborts unless the URL targets
  `chainport_integration`.
- Sample credentials are for local Compose only.

## Schema

Phase 1 created core product tables. Phase 2 adds repositories and links jobs to them:

- `organizations`, `users`, `projects`
- `repositories` (GitHub identity, clone status, resolved SHA, size)
- `migration_jobs` with lease, attempt, idempotency, and `repository_id`
- `job_status_events`
- `findings`
- `migration_plans`
- `sandbox_runs`
- `deployments`

Temporary clone paths are never stored. Fake projects and findings are not seeded.
