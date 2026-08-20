# Network dashboard

B2B surface for foundations and ecosystem teams. Distinct from the developer migration UI under
`/app`.

## Users

- Developers: `/app/projects` … compatibility, changeset, validation, deployment
- Networks: `/network/:partnerId` funnel, blockers, gaps, registry

## Partner model

`NetworkPartner` maps one organization to one production registry chain (`networkKey = optimism`).
The official deployment testnet is read from the registry (`optimism-sepolia`). DEVNET keys such as
`anvil` cannot be partners.

Status: `ACTIVE | PAUSED | PILOT | DISABLED`. Optional `isDemo` partners are listed separately and
must never mix fake rows into a real network's aggregates.

## KPI definitions

| KPI                 | Definition                                                                     |
| ------------------- | ------------------------------------------------------------------------------ |
| Projects started    | Unique projects with a job targeting the partner                               |
| Projects analyzed   | Unique projects with a completed analysis                                      |
| Compatibility-ready | Unique projects whose latest completed compatibility run is `READY`            |
| Validated           | Unique projects with at least one `PASSED` validation                          |
| Testnet deployed    | Unique projects with `DeploymentRun.status = COMPLETED` on the partner TESTNET |

## Empty state

A new partner with zero attributed projects shows an empty explanation, not sample numbers.
