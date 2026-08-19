# Repository ingest

Phase 2 clones public GitHub repositories so later analysis can target an immutable commit SHA.

## Supported provider

Only `https://github.com/<owner>/<repo>` and the existing parser variants (trailing slash, `.git`,
host-only `github.com/owner/repo`). SSH, credentials, lookalike hosts, custom ports, `file://`, and
non-GitHub hosts are rejected.

The clone remote is always constructed from parsed `owner` and `repo`. User-supplied URLs are never
passed to Git.

Private repositories are out of scope. Unauthenticated GitHub responses that cannot distinguish
missing vs private are classified as `REPOSITORY_NOT_FOUND`.

## Lifecycle

`QUEUED → INGESTING → COMPLETED`

Failures go to `FAILED`. Retryable failures (`CLONE_TIMEOUT`, `CLONE_FAILED`) may return to
`QUEUED` while attempts remain. Deterministic failures are not retried.

## Idempotency

One job per `github:<owner>:<repo>:<source>:<target>`. Duplicate POSTs return the existing job.

## Isolation

Clones use a UUID workspace under `WORKSPACE_ROOT` (default OS temp). Git runs with hooks, LFS
filters, and `file`/`ext` protocols disabled. npm, Foundry, Hardhat, and repository scripts are
never executed. Workspace paths are not persisted. Cleanup runs on success and failure.

## Limits

- Clone timeout: `CLONE_TIMEOUT_MS` (default 60s)
- Size cap: `CLONE_MAX_BYTES` (default 100MB)
- GitHub metadata is read only from `https://api.github.com/repos/<owner>/<repo>`

## Known limitations

- No private-repo authentication
- No branch selection beyond the repository default
- No content scan after clone
- GitHub API and clone require outbound HTTPS
