# Security checklist

Each item is implemented or documented in this phase.

| Area                   | Staging status          | Evidence                                                                      |
| ---------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| HTTPS origin           | PENDING EXTERNAL CONFIG | `WEB_ORIGIN` HTTPS, reverse proxy TLS                                         |
| Authentication         | PENDING EXTERNAL CONFIG | OIDC env + `/v1/auth/oidc/*`; test provider fail-closed                       |
| Production fail-closed | READY                   | `assertProductionSafety`, `packages/shared/test/config-production.test.ts`    |
| Sessions / CSRF        | READY                   | HttpOnly cookie + CSRF header, Bearer alternative                             |
| IDOR                   | READY                   | `apps/api/test/security.integration.test.ts`                                  |
| Foundation isolation   | READY                   | same test, `canViewPartner`                                                   |
| Public API boundary    | READY                   | only `/v1/public/partners/:slug` config is unauthenticated among partner APIs |
| Rate limiting          | READY                   | Redis `RateLimiter`, HTTP 429; `trustProxy` in production                     |
| Secret redaction       | READY                   | pino redact + `redactSecrets`                                                 |
| Artifact store         | PENDING EXTERNAL CONFIG | production requires s3; OBJECT_STORAGE_GATE_PENDING                           |
| Private DB / Redis     | PENDING EXTERNAL CONFIG | not published; no localhost URLs                                              |
| Secret manager         | PENDING EXTERNAL CONFIG | env injection, never image layers                                             |
| Audit                  | READY                   | `audit_events`, no update/delete API                                          |
| Kill switches          | READY                   | `ENABLE_*`, no mainnet                                                        |
| Headers                | READY                   | `apps/web/middleware.ts`                                                      |
| CORS                   | READY                   | configured `WEB_ORIGIN`, credentials true                                     |
| GitHub App             | PENDING EXTERNAL CONFIG | extraHeader clone; enable after OIDC                                          |
| Mainnet refusal        | READY                   | existing Phase 8 tests                                                        |
| Sandbox isolation      | READY                   | worker may use Docker; sandboxes never receive the socket                     |
| Backups                | PENDING EXTERNAL CONFIG | provider PITR; [BACKUP_RESTORE.md](BACKUP_RESTORE.md)                         |
| Metrics                | READY                   | `GET /metrics`                                                                |
| Worker recovery        | READY                   | BullMQ + PostgreSQL job rows; reconcile deployments                           |
