# Migration planner

Phase 5 turns a completed compatibility run into an ordered, evidence-backed plan answering:
**what exactly must change before this application can run on the target network?**

The planner itself does not edit repository files. Phase 6 consumes completed plans and may
generate reviewable patches for `SAFE_AUTOMATIC` actions only.

## Rule contract

```ts
interface MigrationRule {
  id: string;
  version: string;
  supports(finding): boolean;
  createActions(finding, context): MigrationActionDraft[];
}
```

Rules are pure. They read persisted compatibility findings, evidence, and the **stored** registry
snapshot from the compatibility run. They never use the latest registry to rewrite historical
target values.

`migrationRulesetVersion` is `"2"`. Identity:

`compatibilityRunId + migrationRulesetVersion`

## Action classifications

| Level             | Meaning                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `SAFE_AUTOMATIC`  | Verified source and target values. Phase 6 may apply later.           |
| `REVIEW_REQUIRED` | Mapping is known but semantics need a developer.                      |
| `MANUAL`          | Architectural work; no invented substitute.                           |
| `BLOCKED`         | Target registry explicitly marks required infrastructure unavailable. |
| `UNKNOWN`         | Compatibility finding is UNKNOWN. No fake fix.                        |

## Risk

`LOW` configuration with verified values. `MEDIUM` infrastructure/address remaps. `HIGH` oracle,
cross-chain, or protocol behavior. `CRITICAL` migration cannot continue unchanged.

Automation and risk are independent (`SAFE_AUTOMATIC` + `LOW`, `BLOCKED` + `CRITICAL`).

Action confidence is not stored separately; risk + automation + evidence already encode it.

## Plan status (outcome)

Computed from actions, never from the compatibility score.

1. Any `BLOCKED` action → `BLOCKED`
2. Else any `UNKNOWN` action → `NEEDS_VERIFICATION`
3. Else any `REVIEW_REQUIRED` or `MANUAL` → `REVIEW_REQUIRED`
4. Else → `READY_TO_APPLY` (including zero actions / no-op)

`migrationReady` is true only when blocked = 0 and unknown = 0.

Zero-action PASS-only reports are `READY_TO_APPLY` with `totalActions = 0`. That is the documented
no-op representation.

## PASS / UNKNOWN / BLOCKER

- Most `PASS` findings create **no** action (including generic Solidity/EVM and generic Chainlink
  with no hardcoded feed).
- `WARNING` findings are the main source of work. Semantic duplicates merge.
- Every `BLOCKER` becomes a prominent `BLOCKED` action.
- Every important `UNKNOWN` becomes a verification action. UNKNOWN is never MANUAL or BLOCKED.
- Unclassified hardcoded addresses merge into one verification action with combined evidence.

## Stages

`NETWORK_CONFIGURATION` → `RPC_AND_EXPLORER` → `TOKEN_MAPPINGS` → `INFRASTRUCTURE_CONTRACTS` →
`ORACLES` → `CROSS_CHAIN` → `CONTRACT_CONFIGURATION` → `FRONTEND_CONFIGURATION` →
`DEPLOYMENT_CONFIGURATION` → `MANUAL_REVIEW`

Empty stages are omitted. Display order shows `BLOCKED` / `UNKNOWN` first, then stage order.

Dependencies are a simple `action → dependsOn` list. Cycles throw. Frontend chain ID depends on
network chain ID when both exist. Missing dependency keys are dropped.

## Deduplication

Actions share a semantic `key` (for example `chain-id:8453->10`). Repeated findings merge into one
action and keep every evidence location.

## Auto-fixable metric

```
actionable = total - blocked - unknown
percent = total == 0 ? 100
        : actionable == 0 ? 0
        : round(100 * safeAutomatic / actionable)
```

Blocked and unknown are excluded from the denominator.

## Historical reproducibility

The plan stores `registrySnapshotHash` from the compatibility run. Reading a plan never re-queries
the live registry. A registry or ruleset change requires a new compatibility run and/or a new
migration ruleset version. Completed plans are never overwritten.

## Evaluation mode

Synchronous in the API request. Lifecycle `QUEUED → PLANNING → COMPLETED` is persisted for audit.
No worker queue.

## Limitations

- No file edits or AST patches (Phase 6).
- Explorer remaps only appear if a compatibility finding exists; explorers are not in the hashed
  snapshot.
- WETH remaps are never `SAFE_AUTOMATIC`.
- Unclassified addresses stay `UNKNOWN`.
- No architectural substitutions (Pyth for Chainlink, other bridges for LayerZero).
