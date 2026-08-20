# Ecosystem analytics

Deterministic B2B aggregations over persisted ChainPort records. No LLM. No invented metrics.

## Attribution

A project belongs to a `NetworkPartner` when it has a `MigrationJob` whose `targetChainKey`
equals `partner.networkKey`. Source chain is never used for attribution.

Phase 10 keeps that rule for “all projects targeting this network” and adds a second, stricter
signal: partner-referred projects have `networkPartnerId` equal to the partner and
`acquisitionSource = PARTNER_PORTAL`. Query `acquisition=partner` or `acquisition=generic` to
filter the funnel. Headline Phase 9 KPIs are unchanged unless that filter is applied.

## Aggregation unit

Headline funnel counts **unique Project** per partner. Repeated compatibility, validation, or
deployment runs on the same project count once. The project is credited with every stage up to its
highest reached stage.

## Funnel stages

| Stage                       | Persisted fact                                                 |
| --------------------------- | -------------------------------------------------------------- |
| PROJECT_STARTED             | Job targeting the partner exists                               |
| REPOSITORY_INGESTED         | Repository `cloneStatus = READY`                               |
| REPOSITORY_ANALYZED         | Completed `RepositoryAnalysis`                                 |
| COMPATIBILITY_EVALUATED     | Completed compatibility run targeting the partner              |
| MIGRATION_PLAN_CREATED      | Completed planned migration targeting the partner              |
| SAFE_FIXES_GENERATED        | ChangeSet exists for a plan targeting the partner              |
| REVISION_FINALIZED          | That ChangeSet is `FINALIZED`                                  |
| VALIDATION_PASSED           | At least one `ValidationRun.outcome = PASSED`                  |
| TESTNET_DEPLOYMENT_PREPARED | Deployment reached `PREPARED` or later on the official testnet |
| TESTNET_DEPLOYED            | `DeploymentRun.status = COMPLETED` on the official TESTNET     |

`PARTIAL`, `FAILED`, `UNSUPPORTED`, and `INFRA_FAILURE` are not validation success.
`PREPARED` is not deployed.

## Time filtering

Presets: `7d`, `30d`, `90d`, `all`. Optional `from` / `to` ISO-8601 timestamps.

Funnel membership uses **project.createdAt** in UTC. Stage facts are the latest persisted records
for those projects. Do not mix job timestamps with analysis timestamps for inclusion.

Zero denominators render as **N/A**, not 0%.

## Infrastructure gaps

Only `NETWORK_GAP` and `UNKNOWN_NETWORK_DATA` appear as infrastructure gaps.

- Missing Chainlink / USDC / RPC capability → `NETWORK_GAP`
- LayerZero (or other protocol) availability unknown → `UNKNOWN_NETWORK_DATA`
- Hardcoded chain ID / RPC / env config → `PROJECT_CONFIG` and **not** an infrastructure gap

Priority = `3 × blockerProjects + unknownProjects`.

Copy must not claim that filling a gap will produce deployments. The dashboard says how many
analyzed projects currently contain requirements affected by the capability.

## Internal / DEVNET exclusion

- `Project.dataClassification = INTERNAL_TEST` is excluded unless `includeInternal=true`
- `anvil` and other DEVNET deployments are excluded unless `includeDevnet=true`
- Partner official testnet comes from the registry `deploymentTestnetKey`

## Privacy

Partner APIs do not return source code, evidence excerpts, logs, or secrets.
