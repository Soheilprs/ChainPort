# Backup and restore

Use the database provider's automated backups and PITR. Do not build a custom dump scheduler.

## PostgreSQL

1. Snapshot/backup the staging and production catalogs before every `pnpm db:deploy`.
2. Restore the snapshot to a throwaway instance and run migrations there first.
3. Point-in-time recovery: follow the provider runbook (WAL / PITR window).
4. Staging should use the provider’s automatic daily backups even before the first restore drill.

## Object storage

Enable bucket versioning and default encryption. Revisions use opaque keys (`revisions/<uuid>/`). Restore by copying the prefix back.

## Redis

Treat Redis as ephemeral (rate limits, queue). Rebuild queues from PostgreSQL job rows after restore.
