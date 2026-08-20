# Incident response

1. Contain: disable `ENABLE_TESTNET_DEPLOYMENT` / `ENABLE_PRIVATE_REPOS` / `ENABLE_VALIDATION` as needed. Do not add a mainnet flag.
2. Rotate: `SESSION_SECRET`, OIDC client secret, GitHub App private key, funder key, database credentials, object-store keys.
3. Revoke sessions: `sessions.revoked_at`.
4. Review `audit_events` for `ACCESS_DENIED`, `DEPLOYMENT_CONFIRMED`, `PARTNER_SETTINGS_UPDATED`.
5. Sandbox escape: destroy containers, rotate host credentials, keep the adversarial suite green.
6. Database/Redis/object-store outage: `/ready` 503, restore from backup, do not reset production schemas.
