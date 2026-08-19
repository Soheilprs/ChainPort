# Phases

Work proceeds one phase at a time. A phase must not implement later product capabilities.

## Phase 1 — Foundation (current)

Monorepo, domain model, chain catalog, database schema, API/worker/web shells, and UI empty
states. Real chain catalog. No repository analysis.

## Recommended next phases

2. **Repository ingest** — accept a GitHub URL, persist a project, clone into an isolated workspace
   without executing it.
3. **Deterministic scanner** — detect frameworks, Solidity files, dependencies, hardcoded chain IDs
   and addresses, RPC and frontend config.
4. **Compatibility engine** — compare scanned requirements with `@chainport/chain-registry`
   capabilities and emit PASS / WARNING / BLOCKER findings.
5. **Migration planning and deterministic patches**.
6. **Isolated sandbox build/test** (Docker; never on the host).
7. **Target testnet deploy and verification**.
8. **Network console analytics** from real jobs and findings.
