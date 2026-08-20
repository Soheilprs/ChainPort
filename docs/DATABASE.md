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

Phase 6 adds revision and ChangeSet tables:

- `repository_revisions` (`ORIGINAL` / `GENERATED`, content hash, completeness)
- `change_sets` unique on plan + SHA + engine version (idempotency key)
- `change_set_changes` (proposed diffs; `patched_text` is internal)
- `change_set_status_events`
- `projects.active_revision_id`

Generated file blobs live on the artifact store, not in PostgreSQL.

Phase 7 adds validation tables:

- `validation_runs` (revision, hash, profile, sandbox image/digest, outcome)
- `validation_status_events`
- `validation_steps` (bounded logs)
- `validation_test_results`

Phase 8 adds deployment tables. Private keys are never stored:

- `deployment_candidates`
- `deployment_runs`
- `deployment_status_events`
- `deployment_preflights`
- `deployment_transactions`
- `deployment_contracts`
- `deployment_checks`

The Phase 1 `deployments` stub is unused.

Phase 9 adds partner analytics tables and classification:

- `network_partners` (organization, network key, status, demo flag)
- `projects.data_classification` (`PRODUCTION` or `INTERNAL_TEST`)
- indexes on target chain, readiness, validation outcome, and deployment status

Phase 3 adds analysis tables:

- `repository_analyses` unique on `(repository_id, commit_sha, scanner_version)`
- `analysis_status_events`, `analysis_detector_runs`
- `repository_files`, `repository_components`
- `project_requirements`, `analysis_evidence`

Temporary clone paths and file contents are never stored. Evidence excerpts are bounded.

Phase 4 adds compatibility tables:

- `compatibility_registry_snapshots` unique on capability `hash`
- `compatibility_runs` unique on `(analysis_id, target_chain_key, ruleset_version, registry_snapshot_hash)`
- `compatibility_status_events`
- `compatibility_findings` (link to `project_requirements`, do not copy full evidence)
- `compatibility_category_results`

Phase 5 adds planning tables (separate from the unused job-linked `migration_plans` stub):

- `planned_migrations` unique on `(compatibility_run_id, migration_ruleset_version)`
- `planned_migration_status_events`
- `planned_migration_actions`
- `planned_migration_action_evidence`
- `planned_migration_action_dependencies`
