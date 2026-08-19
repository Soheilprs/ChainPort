# Product

ChainPort is an EVM application portability, compatibility, migration, and ecosystem-intelligence
platform.

It answers:

> What prevents this existing Web3 application from working correctly on this target blockchain, and
> how can we safely migrate it?

The paying customer is primarily the blockchain network, foundation, ecosystem team, or RaaS
provider. Developers should generally use the developer-facing migration tooling provided by the
partner network.

## What this is not

ChainPort is not:

- an RPC provider
- an explorer
- an indexer
- a generic AI coding assistant
- a generic GitHub scanner
- a generic CI/CD tool

Public RPC URLs and explorer links in the chain catalog are metadata used for comparison. They are
not a hosted service.

## Developer flow

1. Submit or connect a GitHub repository.
2. Select a source chain.
3. Select a target chain.
4. Analyze repository structure.
5. Detect contracts, frameworks, dependencies, tokens, protocols, RPC assumptions, hardcoded
   addresses, chain IDs, oracles, bridges, and frontend configuration.
6. Compare application requirements against target-chain capabilities.
7. Produce PASS / WARNING / BLOCKER findings.
8. Generate a migration plan.
9. Generate safe deterministic fixes.
10. Build and test the migrated repository in an isolated sandbox.
11. Deploy to the target testnet.
12. Verify deployment.

Repository code must never execute on the host. Sandbox execution is isolated.

## Network flow

1. See projects analyzed.
2. See compatibility rates.
3. See testnet deployments.
4. See common developer blockers.
5. See missing infrastructure.
6. Understand which infrastructure integrations would unblock the largest number of applications.

## Current phase

Phase 6 turns a completed migration plan into a reviewable ChangeSet of deterministic patches for
`SAFE_AUTOMATIC` actions only. Developers accept or reject each diff and may finalize a generated
revision. The original GitHub repository is never modified. Sandbox build/test is not implemented.
