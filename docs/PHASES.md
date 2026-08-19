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

## Phase 4 — Target chain compatibility (current)

Requirements + selected target + versioned registry snapshot + ruleset `"1"` → PASS / WARNING /
BLOCKER / UNKNOWN findings, score, coverage, and readiness. UNKNOWN is never treated as BLOCKER.
No migration, patches, compilation, or repository execution.

## Recommended next phases

5. **Migration planning** — turn compatibility findings into ordered, safe migration actions without
   modifying repository files.
6. **Isolated sandbox build/test**.
7. **Target testnet deploy and verification**.
8. **Network console analytics**.
