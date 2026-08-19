# Phases

Work proceeds one phase at a time. A phase must not implement later product capabilities.

## Phase 1 — Foundation

Monorepo, domain model, chain catalog, database schema, API/worker/web shells.

## Phase 2 — Repository ingest

Public GitHub URL → clone into an isolated workspace → exact commit SHA persisted → workspace
removed.

## Phase 3 — Repository intelligence (current)

Stored SHA → safe rematerialization → file inventory → deterministic static analysis →
requirements and evidence. No compatibility scoring.

## Recommended next phases

4. **Compatibility engine** — compare requirements with `@chainport/chain-registry` and emit PASS /
   WARNING / BLOCKER findings.
5. **Migration planning and deterministic patches**.
6. **Isolated sandbox build/test**.
7. **Target testnet deploy and verification**.
8. **Network console analytics**.
