# Authorization

Never trust possession of a database ID.

## Actors

- **Developer** — owns projects (`projects.owner_user_id`)
- **Foundation member** — `OrganizationMembership` on the partner's organization
  - OWNER/ADMIN → `FOUNDATION_ADMIN` (settings + analytics)
  - MEMBER/VIEWER → `FOUNDATION_ANALYST` (analytics only)
- **ChainPort admin** — `users.is_platform_admin`
- **Public visitor** — partner landing config only

## Rules

Protected developer APIs (`/v1/projects`, analyses, compatibility, plans, changesets, validations, deployments) require the caller to own the project. Missing or foreign IDs return **404**.

Foundation APIs (`/v1/network-partners/:id/*`) require membership on that partner's organization. Cross-partner access returns **404**.

Foundation roles never receive source, evidence excerpts, patches, raw logs, or GitHub tokens. Partner analytics labels are anonymized (`Project <id prefix>`).

Unauthenticated access to protected routes returns **401 AUTHENTICATION_REQUIRED**.
