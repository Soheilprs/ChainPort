# Pilot runbook

## Foundation onboarding

1. Platform admin creates the organization and NetworkPartner
2. Invite a Foundation admin (membership OWNER/ADMIN)
3. Confirm registry `networkKey`
4. Configure branding, docs, faucet, support
5. Enable the portal
6. Verify `/network/:id` overview is empty (not sample data)
7. Send `/partners/:slug` to developers

## Developer onboarding

1. Sign in
2. Open the partner URL
3. Connect a public GitHub repo (or GitHub App for private)
4. Ingest → analyze → compatibility → plan → ChangeSet → validate → prepare testnet if eligible

## Stuck states

| Symptom                        | Action                                     |
| ------------------------------ | ------------------------------------------ |
| Ingest failed                  | check URL, size, GitHub access             |
| `GITHUB_ACCESS_REVOKED`        | reinstall the GitHub App                   |
| Analysis failed                | deterministic error code on the analysis   |
| Validation disabled            | `ENABLE_VALIDATION`                        |
| Deployment disabled / unfunded | `ENABLE_TESTNET_DEPLOYMENT`, funder secret |
| Foundation 404                 | wrong org membership                       |
| Worker silent                  | `/ready`, Redis, process list              |
