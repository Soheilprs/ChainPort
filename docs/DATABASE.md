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

## Schema (phase 1)

Core product tables are created in the initial migration:

- `organizations`, `users`, `projects`
- `migration_jobs` with lease, attempt, and idempotency fields
- `job_status_events`
- `findings`
- `migration_plans`
- `sandbox_runs`
- `deployments`

No seed data is inserted. Fake projects and findings are not created.
