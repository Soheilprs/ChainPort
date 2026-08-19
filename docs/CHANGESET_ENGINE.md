# ChangeSet engine

Phase 6 generates **reviewable, deterministic patches** for `SAFE_AUTOMATIC` migration actions
only. It never executes repository code, installs dependencies, compiles, tests, deploys, pushes
to GitHub, or opens pull requests.

`changeSetEngineVersion` is `"1"`. Identity:

`migrationPlanId + originalCommitSha + changeSetEngineVersion`

## Flow

```
Completed MigrationPlan
  → rematerialize the exact original SHA
  → revalidate patch preconditions
  → generate PROPOSED changes (SAFE_AUTOMATIC only)
  → developer Accept / Reject
  → finalize accepted patches into a generated RepositoryRevision
  → rollback selects the original revision again
```

Generation and finalization are asynchronous worker jobs (`generate-changeset`,
`finalize-changeset`). Accept, reject, accept-all, and rollback are synchronous API operations.

A finalized ChangeSet is immutable. Historical rows are never rewritten or deleted.

## Eligibility

Necessary but not sufficient: the migration action must be `SAFE_AUTOMATIC`.

The engine then revalidates:

- repository SHA still matches the plan
- evidence file exists inside the materialized root (path containment)
- file content still contains the expected source value
- a structured patcher understands the file
- the target value comes from the persisted plan, never from the request

On any failure the action is `SKIPPED` with a code such as `PATCH_PRECONDITION_FAILED`,
`SOURCE_MISMATCH`, `UNSAFE_ENV_FILE`, `PATH_ESCAPE_DETECTED`, or `PATCHER_UNSUPPORTED`.
Similar-looking text is never rewritten.

Never auto-patched: `REVIEW_REQUIRED`, `MANUAL`, `BLOCKED`, `UNKNOWN`, WETH, secret env files
(`.env`, `.env.local`, …), oracle/bridge/Safe/LayerZero/business-logic categories, and
`chains: [base]` import rewrites.

## Patchers (v1)

| Id                    | Files                        | Strategy                                    |
| --------------------- | ---------------------------- | ------------------------------------------- |
| `env-template@1`      | `.env.example` and templates | Exact `KEY=` line, once                     |
| `json-config@1`       | `.json`                      | Unique scalar token, re-parse, no stringify |
| `toml-config@1`       | `.toml`                      | Evidence line only; skip compiler/fork keys |
| `typescript-config@1` | `.ts` / `.tsx`               | AST literal span replace                    |
| `javascript-config@1` | `.js` / `.mjs` / `.cjs`      | Same AST strategy                           |
| `solidity-address@1`  | `.sol` token addresses       | Evidence-line address only                  |

Solidity is address-only. No compiler settings, no WETH, no structural rewrites.

## Completeness

`COMPLETE` if every generated safe patch was accepted and none were skipped or rejected.
`PARTIAL` otherwise. This is **not** overall migration readiness.

## States

ChangeSet: `QUEUED → MATERIALIZING → GENERATING → READY_FOR_REVIEW → FINALIZING → FINALIZED`,
plus `FAILED` and `ROLLED_BACK`.

Change: `PROPOSED`, `ACCEPTED`, `REJECTED`, `SKIPPED`, `FAILED`.
