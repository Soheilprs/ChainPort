# Security checklist

Each item is implemented or documented in this phase.

| Area                   | Evidence                                                                      |
| ---------------------- | ----------------------------------------------------------------------------- |
| Authentication         | `docs/AUTHENTICATION.md`, `packages/auth`, `/v1/auth/*`                       |
| Production fail-closed | `assertProductionSafety`, `packages/shared/test/config-production.test.ts`    |
| Sessions / CSRF        | HttpOnly cookie + CSRF header, Bearer alternative                             |
| IDOR                   | `apps/api/test/security.integration.test.ts`                                  |
| Foundation isolation   | same test, `canViewPartner`                                                   |
| Public API boundary    | only `/v1/public/partners/:slug` config is unauthenticated among partner APIs |
| Rate limiting          | Redis `RateLimiter`, HTTP 429                                                 |
| Secret redaction       | pino redact + `redactSecrets`                                                 |
| Artifact store         | `S3CompatibleArtifactStore` + filesystem, production requires s3              |
| Audit                  | `audit_events`, no update/delete API                                          |
| Kill switches          | `ENABLE_*`, no mainnet                                                        |
| Headers                | `apps/web/middleware.ts`                                                      |
| CORS                   | configured `WEB_ORIGIN`, credentials true                                     |
| GitHub App             | extraHeader clone, installation id only                                       |
| Mainnet refusal        | existing Phase 8 tests                                                        |
| Sandbox adversarial    | existing integration suite                                                    |
