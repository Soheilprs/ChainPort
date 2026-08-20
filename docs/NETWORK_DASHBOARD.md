# Network dashboard

B2B surface for foundations and ecosystem teams. Distinct from the developer migration UI under
`/app`.

## Users

- Developers: `/app/projects` … compatibility, changeset, validation, deployment
- Partner portal: `/partners/:slug` network-sponsored onboarding (target locked)
- Networks: `/network/:partnerId` funnel, blockers, gaps, registry, settings

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

Phase 10 adds attribution metrics. They do not replace the table above.

| Metric                    | Definition                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| All targeting network     | Unique projects with a job whose `targetChainKey` equals the partner (Phase 9)                  |
| Partner-referred          | Unique projects with `networkPartnerId` = this partner and `acquisitionSource = PARTNER_PORTAL` |
| Generic targeting network | All targeting minus partner-referred                                                            |
| Referral share            | Partner-referred / all targeting (`N/A` when the denominator is 0)                              |

Funnel query `acquisition=partner` restricts stages to partner-referred projects. Do not compare that
filter to unlabeled generic traffic.

## Empty state

A new partner with zero attributed projects shows an empty explanation, not sample numbers.
