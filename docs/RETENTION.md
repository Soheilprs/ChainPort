# Retention

| Class                     | Default               | Config                             |
| ------------------------- | --------------------- | ---------------------------------- |
| Ingest/sandbox workspaces | immediate delete      | workspace manager                  |
| Failed temp artifacts     | 1 hour                | `FAILED_WORKSPACE_RETENTION_HOURS` |
| Generated revisions       | 90 days               | `ARTIFACT_RETENTION_DAYS`          |
| Validation logs           | 30 days               | `VALIDATION_LOG_RETENTION_DAYS`    |
| Deployment records        | long-lived audit      | keep                               |
| Audit events              | operational retention | no application delete API          |

Project **archive** (`POST /v1/projects/:id/archive`) hides the project from default lists. Destructive user delete is not offered in Phase 11.
