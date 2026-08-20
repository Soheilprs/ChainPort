# Multi-tenancy

Tenancy is organization membership plus project ownership.

- `OrganizationMembership.role`: OWNER, ADMIN, MEMBER, VIEWER
- Project `owner_user_id` / `owner_organization_id` are independent of foundation orgs
- Legacy rows keep `owner_user_id` null and stay `INTERNAL_TEST` / unclaimed — they are not auto-assigned
- Same GitHub repository cannot be claimed by a second developer (`REPOSITORY_ALREADY_CLAIMED`)
