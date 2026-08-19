# Phases

Work proceeds one phase at a time. A phase must not implement later product capabilities.

## Phase 1 — Foundation

Monorepo, domain model, chain catalog, database schema, API/worker/web shells.

## Phase 2 — Repository ingest

Public GitHub URL → clone into an isolated workspace → exact commit SHA persisted → workspace
removed.

## Phase 3 — Repository intelligence

Stored SHA → safe rematerialization → file inventory → deterministic static analysis →
requirements and evidence. No compatibility scoring.

## Phase 4 — Target chain compatibility

Requirements + selected target + versioned registry snapshot + ruleset `"1"` → PASS / WARNING /
BLOCKER / UNKNOWN findings, score, coverage, and readiness. UNKNOWN is never treated as BLOCKER.
No migration, patches, compilation, or repository execution.

## Phase 5 — Migration planner

Completed compatibility run + migration ruleset `"1"` → ordered actions with automation and risk
classification. Plans are immutable. Repository files are not modified.

## Phase 6 — Safe auto-fix / ChangeSet engine (current)

Completed migration plan + `SAFE_AUTOMATIC` actions + exact SHA → rematerialize, generate
reviewable patches, accept/reject, finalize a generated `RepositoryRevision`, rollback to original.
The original GitHub repository is never modified.

## Recommended next phases

7. **Isolated sandbox build/test** of the generated revision.
8. **Target testnet deploy and verification**.
9. **Network console analytics**.
