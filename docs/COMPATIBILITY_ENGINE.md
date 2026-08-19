# Compatibility engine

Phase 4 compares Phase 3 requirements with a versioned target-chain registry snapshot and a
versioned ruleset. It answers: **what prevents this application from running correctly on this
target chain?**

It does not migrate, patch, compile, execute, or deploy repository code.

## Rule contract

```ts
interface CompatibilityRule {
  id: string;
  version: string;
  supports(requirement): boolean;
  evaluate(requirement, context): CompatibilityEvaluation | null;
}
```

Rules are pure. They receive normalized requirements, source/target identity, and a capability
snapshot. They do not access the database, the network, or the repository filesystem.

`compatibilityRulesetVersion` is `"1"`. Each finding stores `ruleId` and `ruleVersion`.

## Severity semantics

| Status    | Meaning                                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PASS`    | Verified target data satisfies the requirement.                                                                                                                 |
| `WARNING` | The capability exists or is configuration-only; a remap or review is required.                                                                                  |
| `BLOCKER` | The capability is **deterministically known unavailable** and there is no safe equivalent. Used conservatively, and only for `DETECTED` mandatory requirements. |
| `UNKNOWN` | ChainPort lacks verified target data. **UNKNOWN is never converted to BLOCKER.**                                                                                |

## UNKNOWN semantics

- Missing registry data is `UNKNOWN`, not `UNAVAILABLE`.
- EVM compatibility does not imply `debug_traceCall` or any extended RPC method.
- Generic Chainlink availability does not imply every feed exists.
- Uniswap V2 is never treated as a substitute for V3.
- Another bridge is never treated as a substitute for LayerZero.

## Readiness

Computed after scoring. Blockers always win.

1. Any `BLOCKER` → `BLOCKED` (not migration ready), even if the score is high.
2. Else if there are `UNKNOWN` findings and coverage `< 50` → `INSUFFICIENT_DATA`.
3. Else if there are `WARNING` findings → `REVIEW_REQUIRED`.
4. Else if there are remaining `UNKNOWN` findings → `INSUFFICIENT_DATA`.
5. Else → `READY`.

`READY` requires every evaluated finding to be `PASS`.

## Scoring

Start conceptually at 100. Only categories that produced at least one **known** finding
(`PASS` / `WARNING` / `BLOCKER`) participate.

Base weights:

| Category                 | Weight |
| ------------------------ | -----: |
| Contracts                |     15 |
| RPC                      |     20 |
| Tokens                   |     15 |
| Oracles                  |     15 |
| Protocols                |     10 |
| Cross-chain              |     10 |
| Frontend + configuration |     15 |

Frontend and configuration share 15: 8 / 7 when both apply, 15 when only one applies.

Weights of participating categories are renormalized to 100 so a project without cross-chain
requirements is neither penalized nor rewarded for them.

Severity factors on **known** findings in a category:

- `PASS` = 1.0
- `WARNING` = 0.70
- `BLOCKER` = 0.0

Category score = mean of those factors. Overall score = round(Σ weight′ × categoryScore).

If every finding is `UNKNOWN`, score is **0** (not 100). If there are no evaluated findings, score
is 100.

## Coverage

```
coverage = round(100 × knownFindings / totalFindings)
```

`UNKNOWN` is excluded from the compatibility numerator and reduces coverage.

Confidence label:

- `HIGH` coverage ≥ 85
- `MEDIUM` coverage ≥ 50
- `LOW` coverage < 50

## Registry snapshot / versioning

`REGISTRY_VERSION = "1"` lives in `@chainport/chain-registry`.

Each run stores:

- `targetChainKey`
- `registryVersion`
- `registrySnapshotHash = sha256(canonical capability JSON)`
- `evaluatedAt`

The hashed document includes chain identity, tokens, RPC methods, protocols, feeds, and RPC URLs.
Presentation-only fields are omitted. Historical runs are immutable: a registry edit produces a new
hash and a new run.

Capability availability is `AVAILABLE` | `UNAVAILABLE` | `UNKNOWN` with provenance
`VERIFIED` | `DECLARED` | `UNKNOWN`.

## Identity

```
analysisId + targetChainKey + rulesetVersion + registrySnapshotHash
```

A completed run with that identity is reused. Completed rows are never overwritten. A new snapshot
or ruleset version is a new run.

## Evaluation mode

Compatibility is CPU-light and has no I/O besides Postgres. The API evaluates **synchronously** in
the request, while still recording `QUEUED → EVALUATING → COMPLETED` for audit consistency. There
is no compatibility worker queue in Phase 4.

## Supported rules (ruleset 1)

| Rule id                   | Evaluates                                          |
| ------------------------- | -------------------------------------------------- |
| `chain-id`                | Hardcoded chain IDs; source mismatch is `WARNING`  |
| `env-config`              | Network-related environment keys                   |
| `hardcoded-rpc`           | Source RPC URLs (redacted values stay redacted)    |
| `rpc-capability`          | Non-standard RPC methods such as `debug_traceCall` |
| `token-availability`      | USDC, USDT, WETH                                   |
| `oracle-availability`     | Chainlink generic + specific feeds                 |
| `infrastructure-contract` | Permit2, Safe                                      |
| `uniswap`                 | Uniswap V2 / V3 (no version substitution)          |
| `layerzero`               | LayerZero (no bridge substitution)                 |
| `hardcoded-address`       | Unclassified contract addresses                    |
| `framework-compatibility` | Single category-level Solidity/EVM `PASS`          |
| `unmapped-requirement`    | Fallback `UNKNOWN`                                 |

Skipped as non-actionable: Solidity pragmas/imports, Foundry/Hardhat, Next.js, secret env keys,
viem/wagmi packages, standard `eth_*` JSON-RPC methods, and hex values found only in `.env` files.

## Categories

`CONTRACTS`, `RPC`, `TOKENS`, `ORACLES`, `PROTOCOLS`, `CROSS_CHAIN`, `FRONTEND`, `CONFIGURATION`.

Framework facts feed `CONTRACTS` only when they convey target-chain information.

## Limitations

- Registry data is an in-code catalog, not on-chain proofs.
- Debug RPC support is `UNKNOWN` unless explicitly recorded.
- Emerging-chain token/oracle/protocol rows are often `UNKNOWN` by design.
- Unclassified hardcoded addresses cannot be mapped.
- No migration plan, patch, compile, test, or deploy step is produced.
