# Target testnet deployment

Engine version `"1"`. Profile `TESTNET_DEPLOY@1`. Foundry is the only executable framework in v1.

## Flow

Validated revision → eligibility → prepare → simulate/preflight → explicit confirmation →
disposable funder → broadcast via RPC proxy → journal → receipts → `eth_getCode` → optional explorer
verification → post-deploy checks.

Prepare never broadcasts. `PREPARED` means no deployment transactions have been sent. `BROADCASTING`
is the irreversible boundary. Repeating the prepare API does not rebroadcast a successful run.

## Eligibility

A revision is eligible only when:

1. It exists and its content hash verifies.
2. Latest applicable ValidationRun is `COMPLETED` / `PASSED` for that exact content hash.
3. The migration plan has 0 BLOCKED, UNKNOWN, MANUAL, and unresolved REVIEW_REQUIRED actions.
4. If safe changes existed, the ChangeSet is FINALIZED and COMPLETE, and the revision is that
   generated revision.
5. An ORIGINAL revision is eligible only when the plan has zero actions and is `READY_TO_APPLY`.

PARTIAL, UNSUPPORTED, FAILED, and unvalidated revisions are refused.

## Testnet only

`MAINNET_DEPLOYMENT_FORBIDDEN` is a hard boundary with no override. Before funding or broadcast,
ChainPort queries `eth_chainId` on the registry RPC and compares it with the selected target.

Official relationships are explicit (`optimism.deploymentTestnetKey = optimism-sepolia`). They are
not inferred from names. Deployment metadata is excluded from compatibility snapshot hashes.

## RPC proxy

Repository code never receives the upstream RPC URL. The sandbox may talk only to
`http://chainport-rpc-proxy:8545` on an isolated Docker network. The proxy:

- forwards only to the selected target
- verifies `eth_chainId`
- allowlists JSON-RPC methods
- journals `eth_sendRawTransaction`
- enforces body size, rate, and timeout limits
- refuses redirects and arbitrary upstreams

## Disposable deployer

Each DeploymentRun gets a new EOA. The private key is held in worker memory, injected into the
deployment sandbox only, redacted from logs, destroyed after the run, and never stored in
PostgreSQL or API responses. This is a documented v1 compromise until an external signer exists.

The funding wallet never enters the sandbox. If no funder is configured for a public testnet, the
run fails with `TESTNET_FUNDING_UNAVAILABLE`.

## Crash recovery

If the worker crashes before `BROADCASTING`, prepare may retry. After the first
`eth_sendRawTransaction`, the script is never rerun. Recovery inspects journaled hashes and
classifies receipts. Unreconstructable state becomes `RECONCILIATION_REQUIRED`.
