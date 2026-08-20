# Revision storage

Generated repository contents are **not** stored in PostgreSQL.

## Original vs generated

| Type        | Meaning                                       | Content hash                          |
| ----------- | --------------------------------------------- | ------------------------------------- |
| `ORIGINAL`  | GitHub commit SHA recorded at ingest/analysis | `git:<sha>`                           |
| `GENERATED` | Original tree + accepted ChangeSet patches    | SHA-256 of snapshot files (see below) |

Generated revisions are ChainPort artifacts, not Git commits, unless a later phase actually
creates a commit.

## Artifact store

`RevisionArtifactStore` is the persistence interface. The local implementation is
`FileSystemArtifactStore` under `CHAINPORT_ARTIFACT_ROOT` (default: a process temp directory).

- Directory names are opaque UUIDs (the `RepositoryRevision.id`)
- User-controlled path segments are never interpolated into the root
- Writes check path containment
- Files are mode `0600`, directories `0700`
- `.git` is not copied into generated snapshots
- Object storage can replace the filesystem later without changing ChangeSet logic

`ARTIFACT_STORE=s3` is required to boot `NODE_ENV=production`. The HTTP S3/R2 transport is not
wired yet (`S3CompatibleArtifactStore` still needs a real `ObjectStoreTransport`). Status:
**OBJECT_STORAGE_GATE_PENDING**. Do not fake durable storage.

`materialize(revisionId)` returns the contained directory if it exists. Phase 7 should consume
this generated snapshot, not the original GitHub repository.

## Content hash

SHA-256 over records in lexicographic UTF-8 relative-path order:

```
relativePath + NUL + fileBytes + NUL
```

Paths use POSIX separators. Excluded: `.git` directories, symbolic links, non-regular files.
Timestamps and original Git metadata are not hashed.

## Rollback

Rollback never rewrites files in place. It selects the original `RepositoryRevision` as the
project's active revision and marks the ChangeSet `ROLLED_BACK`. Artifact bytes and metadata
are retained.
