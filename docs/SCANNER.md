# Scanner

Phase 3 inspects an already-ingested repository at a stored commit SHA. The scanner treats
repository files as data. It never executes them.

## Identity

`repositoryId + commitSha + scannerVersion`

`scannerVersion` is currently `"3"`. A new version may re-analyze the same SHA without overwriting
the previous analysis row.

## Workflow

`QUEUED → MATERIALIZING → INVENTORYING → ANALYZING → COMPLETED`

The worker materializes the exact SHA with the Phase 2 Git safety flags, verifies `HEAD`,
inventories files, runs isolated detectors, persists the result in one transaction, then deletes
the workspace.

## Detector contract

Each detector has `id`, `version`, and `detect(context)`. Detectors are deterministic, side-effect
free, and must not access the network or execute repository code. A detector exception is recorded
on `analysis_detector_runs` and does not fail the whole analysis.

## Supported detections

- Frameworks: Foundry, Hardhat (config parsed as source, never imported)
- Languages: Solidity, TypeScript, JavaScript
- Package managers: pnpm, npm, yarn (from lockfiles)
- Libraries: viem, ethers, wagmi
- Solidity inventory: pragma, contracts, interfaces, libraries, imports
- Named tokens: USDC, USDT, WETH, LINK (known addresses and identifier context)
- Protocols: Chainlink, Chainlink Functions, Uniswap V2/V3, Permit2, Safe, LayerZero
- Project deployments: address-book identifiers that match contracts in the same repository
- Network: hardcoded `chainId` in configs
- RPC methods and redacted RPC URLs
- Environment template keys with secret values redacted

Address extraction requires an exact 40-hex EVM address. Transaction hashes, `bytes32`
storage slots, and OpenZeppelin / broadcast / deployments / Hardhat `tasks` history are not
requirements. JSON address maps contribute the object key and filename as identifier context
(for example `layerzeroEndpoints.json` or `v3Factory` struct fields).
Multiple evidence locations for the same capability collapse into one requirement.

## Evidence

Requirements store bounded excerpts and line ranges. Entire files are not persisted.

## Security boundary

- No `import()` / `require()` / `eval` of repository JS/TS
- No Foundry, Hardhat, or package manager processes
- No Git hooks
- Symlinks are skipped
- Secrets in URLs and `.env` values are redacted
