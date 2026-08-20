# Partner portal

Phase 10 adds a network-sponsored developer entry point. The existing migration engine is reused.
Foundations still use the Phase 9 console; developers still use `/app/*` after project creation.

## Routing

| Surface                  | Route                                           | Audience                      |
| ------------------------ | ----------------------------------------------- | ----------------------------- |
| Developer workspace      | `/app/*`                                        | Developers                    |
| Partner developer portal | `/partners/:slug` and `/partners/:slug/migrate` | Developers sent by a network  |
| Foundation console       | `/network` and `/network/:id/*`                 | Foundations / ecosystem teams |

`/network/optimism` is never a public portal. Public slugs live under `/partners`. Partner `id` remains
the internal identity for console and `/v1/network-partners/:id`. There is no public directory of
every partner.

Backward compatible: Phase 9 `/network/:id` analytics routes are unchanged.

## Branding model

`NetworkPartner` is the commercial / presentation layer. The chain registry remains technical truth
(chain ID, RPC, testnet, native token, capabilities). Partner rows do not copy those fields.

Structured branding only:

- `slug` (lowercase, URL-safe, unique)
- `displayName`
- `logoUrl` (HTTPS, no data URLs)
- `primaryAccent` (hex)
- `shortDescription`
- `developerPortalEnabled`
- `docsUrl`, `faucetUrl`, `explorerUrl`, `supportUrl`, `discordUrl`, `developerDocsUrl`

Not supported in v1: custom CSS, JavaScript, HTML, page templates, custom domains, email branding,
or product renaming. Arbitrary markup is rejected.

Accent is applied to portal chrome only. PASS / WARNING / BLOCKER / UNKNOWN colors are never
replaced. Unsafe accents (poor contrast or too close to semantic colors) fall back to ChainPort
indigo. Logo load failures fall back to initials.

## Target locking

A developer at `/partners/optimism` has `targetChainKey = optimism`. The source chain remains
selectable. `POST /v1/public/partners/:slug/projects` does not take `targetChainKey`; the server
derives it from the partner. Sending a different target returns `PARTNER_TARGET_MISMATCH`.

## Attribution

Two independent facts:

| Fact                | How it is stored                                         |
| ------------------- | -------------------------------------------------------- |
| Targeted network    | `MigrationJob.targetChainKey` (Phase 9)                  |
| Acquisition partner | `Project.networkPartnerId` + `Project.acquisitionSource` |

`GENERIC_PORTAL` projects that happen to target Optimism are not counted as Optimism-referred.
`PARTNER_PORTAL` plus `networkPartnerId` is the sponsored-portal signal.

Acquisition sources: `GENERIC_PORTAL`, `PARTNER_PORTAL`, `INTERNAL`, `API`.

## Portal status

| Status                           | GET portal           | Create project          |
| -------------------------------- | -------------------- | ----------------------- |
| ACTIVE                           | yes                  | yes                     |
| PILOT                            | yes (marked pilot)   | yes                     |
| PAUSED                           | yes                  | `PARTNER_PORTAL_PAUSED` |
| DISABLED                         | `PORTAL_UNAVAILABLE` | `PORTAL_UNAVAILABLE`    |
| `developerPortalEnabled = false` | `PORTAL_UNAVAILABLE` | `PORTAL_UNAVAILABLE`    |
| unknown slug                     | `PARTNER_NOT_FOUND`  | `PARTNER_NOT_FOUND`     |

Paused or disabled partners do not delete existing developer projects.

## Public vs foundation APIs

Public (no org internals, no analytics):

- `GET /v1/public/partners/:slug`
- `POST /v1/public/partners/:slug/projects` `{ repositoryUrl, sourceChainKey }`

Foundation (Phase 11 will add auth here):

- `GET/POST /v1/network-partners`
- `GET/PATCH /v1/network-partners/:id`
- analytics under `/v1/network-partners/:id/*`

## Privacy

Originating from a partner portal does not grant the Foundation source code, evidence excerpts,
logs, generated patches, or repository contents. The Phase 9 privacy boundary stands: metadata,
journey, aggregated blockers, and approved project information only.

Private GitHub repositories are not ingested yet. When they are, partner attribution must not imply
the network sponsor receives private-repo access. Authorization belongs with the developer
workspace, not the Foundation console.

## White-label limitations

v1 is “Powered by ChainPort” with partner logo, name, accent, links, and a locked target. It is not
a fully white-labeled product. Deeper branding is a later phase.
