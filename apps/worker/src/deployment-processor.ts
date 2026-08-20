import { cp, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { hashRepositoryTree, type RevisionArtifactStore } from "@chainport/changeset";
import type {
  ChangeSetRepository,
  DeploymentRepository,
  IngestRepository,
  PlanRepository,
  ValidationRepository,
} from "@chainport/db";
import {
  auditFromJournal,
  assertPreflightPolicy,
  confirmTargetRpc,
  destroyCredential,
  detectDeploymentCandidates,
  evaluateEligibility,
  foundryBroadcastCommand,
  foundrySimulateCommand,
  fundDeployer,
  getCredential,
  hashesFromProxyJournal,
  InMemoryDisposableCredentialProvider,
  loadForgeBroadcast,
  parseForgePreflight,
  policyFor,
  redactSecrets,
  requireDeploymentTarget,
  jsonRpc,
  runPostDeployChecks,
  selectUpstreamRpc,
  startRpcProxy,
  stopRpcProxy,
  storeCredential,
  verifyContractSource,
  waitForConfirmations,
  type RpcProxyHandle,
} from "@chainport/deployment";
import { materializeRevision, type CloneSource, type WorkspaceManager } from "@chainport/ingest";
import { type DockerSandboxRunner, type SandboxHandle } from "@chainport/sandbox";
import {
  DEPLOYMENT_ERROR_MESSAGES,
  parseGitHubRepositoryUrl,
  type DeploymentRunStatus,
  type ServiceConfig,
} from "@chainport/shared";
import { UnrecoverableError } from "bullmq";
import type { Logger } from "pino";

export interface DeploymentProcessorDependencies {
  ingest: IngestRepository;
  revisions: ChangeSetRepository;
  plans: PlanRepository;
  validations: ValidationRepository;
  deployments: DeploymentRepository;
  workspaces: WorkspaceManager;
  artifacts: RevisionArtifactStore;
  sandbox: DockerSandboxRunner;
  credentials?: InMemoryDisposableCredentialProvider;
  config: Pick<
    ServiceConfig,
    | "CLONE_TIMEOUT_MS"
    | "CLONE_MAX_BYTES"
    | "DEPLOYMENT_TIMEOUT_MS"
    | "DEPLOYMENT_MEMORY_BYTES"
    | "DEPLOYMENT_CPUS"
    | "DEPLOYMENT_PIDS"
    | "MAX_DEPLOYMENT_TX_COUNT"
    | "MAX_DEPLOYMENT_GAS"
    | "MAX_TESTNET_FUNDING_WEI"
    | "MAX_TRANSACTION_VALUE_WEI"
    | "RPC_PROXY_MAX_BODY_BYTES"
    | "RPC_PROXY_RATE_LIMIT"
    | "RPC_PROXY_TIMEOUT_MS"
    | "SANDBOX_IMAGE_FOUNDRY"
    | "CHAINPORT_TESTNET_FUNDER_PRIVATE_KEY"
    | "ETHERSCAN_API_KEY"
  >;
  logger: Logger;
  anvilRpcUrl?: string;
  proxyUpstreamRpcUrl?: string;
  proxyExtraNetworks?: readonly string[];
  materialize?: typeof materializeRevision;
  cloneSourceFor?: (normalizedUrl: string) => CloneSource;
}

const credentials = new InMemoryDisposableCredentialProvider();

export async function processPrepareDeployment(
  deploymentId: string,
  deps: DeploymentProcessorDependencies,
): Promise<void> {
  const run = await mustGet(deps, deploymentId);
  if (run.status === "PREPARED" || run.status === "COMPLETED" || run.status === "CANCELLED") {
    return;
  }
  if (
    run.status === "BROADCASTING" ||
    run.status === "CONFIRMING" ||
    run.status === "VERIFYING" ||
    run.status === "RECONCILIATION_REQUIRED"
  ) {
    await processReconcileDeployment(deploymentId, deps);
    return;
  }
  if (run.status === "QUEUED") {
    await deps.deployments.transition({
      deploymentId,
      fromStatus: "QUEUED",
      toStatus: "CHECKING_ELIGIBILITY",
      reason: "eligibility started",
    });
  }
  const revision = await deps.revisions.getRevision(run.repositoryRevisionId);
  if (revision === undefined) {
    await fail(
      deps,
      deploymentId,
      currentStatus(await mustGet(deps, deploymentId)),
      "REVISION_NOT_FOUND",
    );
    return;
  }
  const validation = await deps.validations.getById(run.validationRunId);
  const plan =
    run.plannedMigrationId === null ? undefined : await deps.plans.getById(run.plannedMigrationId);
  const changeSet =
    run.changeSetId === null ? undefined : await deps.revisions.getById(run.changeSetId);
  try {
    evaluateEligibility({ revision, validation, plan, changeSet });
  } catch (error) {
    await fail(
      deps,
      deploymentId,
      currentStatus(await mustGet(deps, deploymentId)),
      codeOf(error, "REVISION_NOT_ELIGIBLE"),
      messageOf(error),
    );
    return;
  }
  const target = requireDeploymentTarget(run.targetTestnetKey);
  const upstream = selectUpstreamRpc(target, target.key === "anvil" ? deps.anvilRpcUrl : undefined);
  try {
    await confirmTargetRpc({ chain: target, rpcUrl: upstream });
  } catch (error) {
    await fail(
      deps,
      deploymentId,
      currentStatus(await mustGet(deps, deploymentId)),
      codeOf(error, "CHAIN_ID_MISMATCH"),
      messageOf(error),
    );
    return;
  }
  const latest = await mustGet(deps, deploymentId);
  if (latest.status === "CHECKING_ELIGIBILITY") {
    await deps.deployments.transition({
      deploymentId,
      fromStatus: "CHECKING_ELIGIBILITY",
      toStatus: "PREPARING",
      reason: "materialize started",
    });
  }
  await deps.sandbox.reapOrphans().catch(() => undefined);
  const workspace = await deps.workspaces.allocate();
  let handle: SandboxHandle | undefined;
  let proxy: RpcProxyHandle | undefined;
  const provider = deps.credentials ?? credentials;
  try {
    const repoPath = await materialize(deps, revision, workspace);
    const actual =
      revision.type === "ORIGINAL" ? revision.contentHash : await hashRepositoryTree(repoPath);
    if (revision.type === "GENERATED" && actual !== revision.contentHash) {
      await fail(deps, deploymentId, "PREPARING", "REVISION_INTEGRITY_MISMATCH");
      return;
    }
    const detected = await detectDeploymentCandidates(repoPath);
    const persisted = [];
    for (const candidate of detected) {
      persisted.push(
        await deps.deployments.upsertCandidate({
          revisionId: revision.id,
          framework: candidate.framework,
          filePath: candidate.filePath,
          entrypoint: candidate.entrypoint,
          confidence: candidate.confidence,
          evidence: candidate.evidence,
        }),
      );
    }
    let selected = persisted.find((item) => item.id === run.deploymentCandidateId);
    if (selected === undefined) {
      selected = persisted.find(
        (item) => item.framework === "FOUNDRY" && item.confidence === "DETECTED",
      );
    }
    if (selected === undefined) {
      await fail(deps, deploymentId, "PREPARING", "CANDIDATE_NOT_FOUND");
      return;
    }
    if (selected.framework !== "FOUNDRY") {
      await fail(deps, deploymentId, "PREPARING", "UNSUPPORTED_FRAMEWORK");
      return;
    }
    await deps.deployments.setCandidate(deploymentId, selected.id);
    const issued = provider.issue();
    storeCredential(deploymentId, issued);
    await deps.deployments.setDeployerAddress(deploymentId, issued.address);
    const journalDir = path.join(workspace.root, "rpc-journal");
    proxy = await startRpcProxy({
      upstreamRpcUrl: deps.proxyUpstreamRpcUrl ?? rewriteLocalhost(upstream),
      expectedChainId: target.chainId,
      targetChainKey: target.key,
      journalDir,
      maxBodyBytes: deps.config.RPC_PROXY_MAX_BODY_BYTES,
      rateLimit: deps.config.RPC_PROXY_RATE_LIMIT,
      timeoutMs: deps.config.RPC_PROXY_TIMEOUT_MS,
      ...(deps.proxyExtraNetworks === undefined ? {} : { extraNetworks: deps.proxyExtraNetworks }),
    });
    const image = deps.config.SANDBOX_IMAGE_FOUNDRY ?? "chainport/sandbox-foundry:1";
    handle = await deps.sandbox.prepare({
      image,
      workspaceHost: repoPath,
      limits: {
        memoryBytes: deps.config.DEPLOYMENT_MEMORY_BYTES,
        cpus: deps.config.DEPLOYMENT_CPUS,
        pids: deps.config.DEPLOYMENT_PIDS,
      },
      networkName: proxy.isoNetwork,
      deployment: true,
      env: {
        ETH_RPC_URL: "http://chainport-rpc-proxy:8545",
        FOUNDRY_ETH_RPC_URL: "http://chainport-rpc-proxy:8545",
        RPC_URL: "http://chainport-rpc-proxy:8545",
        PRIVATE_KEY: issued.peekPrivateKey(),
        CHAINPORT_SCRIPT: selected.filePath,
        CHAINPORT_DEPLOYER: issued.address,
      },
    });
    await deps.deployments.transition({
      deploymentId,
      fromStatus: "PREPARING",
      toStatus: "SIMULATING",
      reason: "preflight started",
      deployerAddress: issued.address,
      framework: "FOUNDRY",
    });
    const command = foundrySimulateCommand(selected.filePath);
    const result = await deps.sandbox.execute(handle, {
      argv: command.argv,
      timeoutMs: deps.config.DEPLOYMENT_TIMEOUT_MS,
      network: "proxy",
    });
    const output = redactSecrets(`${result.stdout}\n${result.stderr}`, issued.peekPrivateKey());
    if (result.timedOut || result.exitCode !== 0) {
      await fail(deps, deploymentId, "SIMULATING", "PREFLIGHT_FAILED", output.slice(0, 2000));
      return;
    }
    const parsed = parseForgePreflight(output);
    const policy = policyFor(target, {
      maxTxCount: deps.config.MAX_DEPLOYMENT_TX_COUNT,
      maxGas: BigInt(deps.config.MAX_DEPLOYMENT_GAS),
      maxFundingWei: deps.config.MAX_TESTNET_FUNDING_WEI,
      maxTransactionValueWei: deps.config.MAX_TRANSACTION_VALUE_WEI,
    });
    const txCount = parsed.transactionCount ?? 1;
    const gas = parsed.estimatedGas ?? 0n;
    try {
      assertPreflightPolicy({
        policy,
        transactionCount: txCount,
        estimatedGas: gas,
        values: [0n],
      });
    } catch (error) {
      await fail(
        deps,
        deploymentId,
        "SIMULATING",
        codeOf(error, "POLICY_LIMIT_EXCEEDED"),
        messageOf(error),
      );
      return;
    }
    await deps.deployments.upsertPreflight({
      deploymentRunId: deploymentId,
      transactionCount: parsed.transactionCount,
      estimatedGas: parsed.estimatedGas?.toString() ?? null,
      estimatedCost: parsed.estimatedCost,
      status: "PASSED",
      warnings: { items: parsed.warnings },
    });
    await deps.deployments.transition({
      deploymentId,
      fromStatus: "SIMULATING",
      toStatus: "PREPARED",
      reason: "preflight passed; waiting for explicit confirmation",
      transactionCount: parsed.transactionCount,
      estimatedGas: parsed.estimatedGas?.toString() ?? null,
      estimatedCost: parsed.estimatedCost,
    });
  } catch (error) {
    await fail(
      deps,
      deploymentId,
      currentStatus(await mustGet(deps, deploymentId)),
      codeOf(error, "DEPLOYMENT_FAILED"),
      messageOf(error),
    );
  } finally {
    if (handle !== undefined) {
      await deps.sandbox.destroy(handle).catch(() => undefined);
    }
    if (proxy !== undefined) {
      await stopRpcProxy(proxy).catch(() => undefined);
    }
    await deps.workspaces.cleanup(workspace).catch(() => undefined);
  }
}

export async function processBroadcastDeployment(
  deploymentId: string,
  deps: DeploymentProcessorDependencies,
): Promise<void> {
  const run = await mustGet(deps, deploymentId);
  if (run.status === "COMPLETED" || run.status === "CANCELLED") {
    return;
  }
  if (
    run.status === "BROADCASTING" ||
    run.status === "CONFIRMING" ||
    run.status === "VERIFYING" ||
    run.status === "RECONCILIATION_REQUIRED"
  ) {
    await processReconcileDeployment(deploymentId, deps);
    return;
  }
  if (run.status !== "PREPARED" && run.status !== "FUNDING") {
    throw new UnrecoverableError(`deployment ${deploymentId} is not prepared`);
  }
  const issued = getCredential(deploymentId);
  if (issued === undefined) {
    await fail(deps, deploymentId, run.status, "CREDENTIAL_LOST");
    return;
  }
  const target = requireDeploymentTarget(run.targetTestnetKey);
  const upstream = selectUpstreamRpc(target, target.key === "anvil" ? deps.anvilRpcUrl : undefined);
  await confirmTargetRpc({ chain: target, rpcUrl: upstream });
  if (run.status === "PREPARED") {
    await deps.deployments.transition({
      deploymentId,
      fromStatus: "PREPARED",
      toStatus: "FUNDING",
      reason: "funding disposable deployer",
    });
  }
  const policy = policyFor(target, {
    maxTxCount: deps.config.MAX_DEPLOYMENT_TX_COUNT,
    maxGas: BigInt(deps.config.MAX_DEPLOYMENT_GAS),
    maxFundingWei: deps.config.MAX_TESTNET_FUNDING_WEI,
    maxTransactionValueWei: deps.config.MAX_TRANSACTION_VALUE_WEI,
  });
  try {
    await fundDeployer({
      chain: target,
      rpcUrl: upstream,
      address: issued.address,
      amountWei: policy.maxFundingWei,
      ...(deps.config.CHAINPORT_TESTNET_FUNDER_PRIVATE_KEY === undefined
        ? {}
        : { funderPrivateKey: deps.config.CHAINPORT_TESTNET_FUNDER_PRIVATE_KEY }),
    });
  } catch (error) {
    await fail(
      deps,
      deploymentId,
      "FUNDING",
      codeOf(error, "TESTNET_FUNDING_UNAVAILABLE"),
      messageOf(error),
    );
    return;
  }
  const candidate =
    run.deploymentCandidateId === null
      ? undefined
      : await deps.deployments.getCandidate(run.deploymentCandidateId);
  if (candidate === undefined || candidate.framework !== "FOUNDRY") {
    await fail(deps, deploymentId, "FUNDING", "CANDIDATE_NOT_FOUND");
    return;
  }
  const revision = await deps.revisions.getRevision(run.repositoryRevisionId);
  if (revision === undefined) {
    await fail(deps, deploymentId, "FUNDING", "REVISION_NOT_FOUND");
    return;
  }
  const workspace = await deps.workspaces.allocate();
  let handle: SandboxHandle | undefined;
  let proxy: RpcProxyHandle | undefined;
  let broadcastBegan = false;
  try {
    const repoPath = await materialize(deps, revision, workspace);
    const journalDir = path.join(workspace.root, "rpc-journal");
    proxy = await startRpcProxy({
      upstreamRpcUrl: deps.proxyUpstreamRpcUrl ?? rewriteLocalhost(upstream),
      expectedChainId: target.chainId,
      targetChainKey: target.key,
      journalDir,
      maxBodyBytes: deps.config.RPC_PROXY_MAX_BODY_BYTES,
      rateLimit: deps.config.RPC_PROXY_RATE_LIMIT,
      timeoutMs: deps.config.RPC_PROXY_TIMEOUT_MS,
      ...(deps.proxyExtraNetworks === undefined ? {} : { extraNetworks: deps.proxyExtraNetworks }),
    });
    const image = deps.config.SANDBOX_IMAGE_FOUNDRY ?? "chainport/sandbox-foundry:1";
    handle = await deps.sandbox.prepare({
      image,
      workspaceHost: repoPath,
      limits: {
        memoryBytes: deps.config.DEPLOYMENT_MEMORY_BYTES,
        cpus: deps.config.DEPLOYMENT_CPUS,
        pids: deps.config.DEPLOYMENT_PIDS,
      },
      networkName: proxy.isoNetwork,
      deployment: true,
      env: {
        ETH_RPC_URL: "http://chainport-rpc-proxy:8545",
        FOUNDRY_ETH_RPC_URL: "http://chainport-rpc-proxy:8545",
        RPC_URL: "http://chainport-rpc-proxy:8545",
        PRIVATE_KEY: issued.peekPrivateKey(),
        CHAINPORT_SCRIPT: candidate.filePath,
        CHAINPORT_DEPLOYER: issued.address,
      },
    });
    await deps.deployments.transition({
      deploymentId,
      fromStatus: "FUNDING",
      toStatus: "BROADCASTING",
      reason: "broadcast started",
    });
    broadcastBegan = true;
    const command = foundryBroadcastCommand(candidate.filePath);
    const result = await deps.sandbox.execute(handle, {
      argv: command.argv,
      timeoutMs: deps.config.DEPLOYMENT_TIMEOUT_MS,
      network: "proxy",
    });
    const journalText = await readFile(proxy.journalPath, "utf8").catch(() => "");
    const proxyHashes = hashesFromProxyJournal(journalText.split("\n"));
    let sequence = 0;
    for (const hash of proxyHashes) {
      sequence += 1;
      await deps.deployments.recordTransaction({
        deploymentRunId: deploymentId,
        sequence,
        hash,
        nonce: null,
        from: issued.address,
        to: null,
        value: "0",
        gasLimit: null,
        status: "SUBMITTED",
      });
    }
    const artifacts = await loadForgeBroadcast(repoPath, target.chainId);
    for (const [index, tx] of artifacts.entries()) {
      await deps.deployments.recordTransaction({
        deploymentRunId: deploymentId,
        sequence: index + 1,
        hash: tx.hash,
        nonce: tx.nonce,
        from: tx.from,
        to: tx.to,
        value: BigInt(tx.value || "0").toString(),
        gasLimit: tx.gasLimit,
        status: "SUBMITTED",
        contractAddress: tx.contractAddress,
      });
    }
    if (result.timedOut) {
      await deps.deployments.transition({
        deploymentId,
        fromStatus: "BROADCASTING",
        toStatus: "RECONCILIATION_REQUIRED",
        reason: "broadcast timed out after possible side effects",
        errorCode: "RECONCILIATION_REQUIRED",
      });
      return;
    }
    if (result.exitCode !== 0 && proxyHashes.length === 0 && artifacts.length === 0) {
      await fail(
        deps,
        deploymentId,
        "BROADCASTING",
        "DEPLOYMENT_FAILED",
        redactSecrets(`${result.stdout}\n${result.stderr}`, issued.peekPrivateKey()).slice(0, 2000),
      );
      return;
    }
    await deps.deployments.transition({
      deploymentId,
      fromStatus: "BROADCASTING",
      toStatus: "CONFIRMING",
      reason: "waiting for receipts",
      rpcAuditJson: {
        methods: auditFromJournal(journalText.split("\n")).map((item) => ({
          method: item.method,
          count: item.count,
        })),
      },
    });
    await confirmAndVerify(deploymentId, deps, {
      rpcUrl: upstream,
      chain: target,
      deployer: issued.address,
    });
  } catch (error) {
    const status = currentStatus(await mustGet(deps, deploymentId));
    if (broadcastBegan) {
      await deps.deployments.transition({
        deploymentId,
        fromStatus: status === "BROADCASTING" ? "BROADCASTING" : status,
        toStatus: "RECONCILIATION_REQUIRED",
        reason: messageOf(error),
        errorCode: "RECONCILIATION_REQUIRED",
      });
    } else {
      await fail(deps, deploymentId, status, codeOf(error, "DEPLOYMENT_FAILED"), messageOf(error));
    }
  } finally {
    destroyCredential(deploymentId);
    if (handle !== undefined) {
      await deps.sandbox.destroy(handle).catch(() => undefined);
    }
    if (proxy !== undefined) {
      await stopRpcProxy(proxy).catch(() => undefined);
    }
    await deps.workspaces.cleanup(workspace).catch(() => undefined);
  }
}

export async function processReconcileDeployment(
  deploymentId: string,
  deps: DeploymentProcessorDependencies,
): Promise<void> {
  const run = await mustGet(deps, deploymentId);
  const txs = await deps.deployments.listTransactions(deploymentId);
  if (txs.length === 0) {
    if (run.status === "BROADCASTING" || run.status === "RECONCILIATION_REQUIRED") {
      await deps.deployments.transition({
        deploymentId,
        fromStatus: run.status,
        toStatus: "RECONCILIATION_REQUIRED",
        reason: "no journaled hashes after broadcast; script will not be rerun",
        errorCode: "RECONCILIATION_REQUIRED",
      });
    }
    return;
  }
  const target = requireDeploymentTarget(run.targetTestnetKey);
  const upstream = selectUpstreamRpc(target, target.key === "anvil" ? deps.anvilRpcUrl : undefined);
  try {
    await confirmTargetRpc({ chain: target, rpcUrl: upstream });
  } catch {
    if (run.status !== "RECONCILIATION_REQUIRED") {
      await deps.deployments.transition({
        deploymentId,
        fromStatus: run.status,
        toStatus: "RECONCILIATION_REQUIRED",
        reason: "unable to reach target RPC during reconciliation",
        errorCode: "RECONCILIATION_REQUIRED",
      });
    }
    return;
  }
  try {
    await confirmAndVerify(deploymentId, deps, {
      rpcUrl: upstream,
      chain: target,
      deployer: run.deployerAddress ?? "0x0000000000000000000000000000000000000000",
      fromStatus: run.status,
    });
  } catch (error) {
    const current = await mustGet(deps, deploymentId);
    if (current.status !== "RECONCILIATION_REQUIRED" && current.status !== "COMPLETED") {
      await deps.deployments.transition({
        deploymentId,
        fromStatus: current.status,
        toStatus: "RECONCILIATION_REQUIRED",
        reason: messageOf(error),
        errorCode: "RECONCILIATION_REQUIRED",
      });
    }
  }
}

async function confirmAndVerify(
  deploymentId: string,
  deps: DeploymentProcessorDependencies,
  input: {
    rpcUrl: string;
    chain: ReturnType<typeof requireDeploymentTarget>;
    deployer: string;
    fromStatus?: DeploymentRunStatus;
  },
): Promise<void> {
  const confirmations = input.chain.deployment?.confirmationCount ?? 1;
  const txs = await deps.deployments.listTransactions(deploymentId);
  let unknown = false;
  for (const tx of txs) {
    const receipt = await waitForConfirmations({
      rpcUrl: input.rpcUrl,
      hash: tx.hash,
      confirmations,
      timeoutMs: Math.min(deps.config.DEPLOYMENT_TIMEOUT_MS, 120_000),
    });
    await deps.deployments.recordTransaction({
      deploymentRunId: deploymentId,
      sequence: tx.sequence,
      hash: tx.hash,
      nonce: tx.nonce,
      from: receipt.from ?? tx.from,
      to: receipt.to ?? tx.to,
      value: tx.value,
      gasLimit: tx.gasLimit,
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      contractAddress: receipt.contractAddress,
      confirmedAt: receipt.status === "CONFIRMED" ? new Date() : null,
    });
    if (receipt.status === "UNKNOWN" || receipt.status === "PENDING") {
      unknown = true;
    }
    if (receipt.contractAddress !== null && receipt.contractAddress !== "0x") {
      const code = await jsonRpc<string>(input.rpcUrl, "eth_getCode", [
        receipt.contractAddress,
        "latest",
      ]);
      await deps.deployments.upsertContract({
        deploymentRunId: deploymentId,
        address: receipt.contractAddress,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        deployer: input.deployer,
        contractName: null,
        sourcePath: null,
        bytecodePresent: code !== "0x" && code !== "0x0",
        receiptStatus: receipt.status,
        verificationStatus: "SKIPPED",
        verificationMessage: null,
      });
    }
  }
  if (unknown) {
    const status = currentStatus(await mustGet(deps, deploymentId));
    if (status !== "RECONCILIATION_REQUIRED") {
      await deps.deployments.transition({
        deploymentId,
        fromStatus: input.fromStatus ?? status,
        toStatus: "RECONCILIATION_REQUIRED",
        reason: "one or more receipts could not be reconstructed",
        errorCode: "RECONCILIATION_REQUIRED",
      });
    }
    return;
  }
  const current = await mustGet(deps, deploymentId);
  if (current.status === "BROADCASTING") {
    await deps.deployments.transition({
      deploymentId,
      fromStatus: "BROADCASTING",
      toStatus: "CONFIRMING",
      reason: "receipts fetched during reconciliation",
    });
  }
  const afterConfirm = await mustGet(deps, deploymentId);
  if (afterConfirm.status === "CONFIRMING") {
    await deps.deployments.transition({
      deploymentId,
      fromStatus: "CONFIRMING",
      toStatus: "VERIFYING",
      reason: "receipts confirmed",
    });
  } else if (afterConfirm.status === "RECONCILIATION_REQUIRED") {
    await deps.deployments.transition({
      deploymentId,
      fromStatus: "RECONCILIATION_REQUIRED",
      toStatus: "VERIFYING",
      reason: "reconciliation reconstructed receipts",
    });
  }
  const contracts = await deps.deployments.listContracts(deploymentId);
  const artifacts = await loadNamedContracts(
    deps,
    current.repositoryRevisionId,
    input.chain.chainId,
  );
  for (const contract of contracts) {
    const named = artifacts.find(
      (item) => item.address.toLowerCase() === contract.address.toLowerCase(),
    );
    const source = await verifyContractSource({
      chain: input.chain,
      address: contract.address,
      apiKey: deps.config.ETHERSCAN_API_KEY,
      compilerVersion: null,
      source: null,
      constructorArgs: null,
    });
    await deps.deployments.upsertContract({
      ...contract,
      contractName: named?.contractName ?? contract.contractName,
      sourcePath: named?.sourcePath ?? contract.sourcePath,
      verificationStatus: source.status,
      verificationMessage: source.message,
    });
  }
  const refreshed = await deps.deployments.listTransactions(deploymentId);
  const refreshedContracts = await deps.deployments.listContracts(deploymentId);
  const checks = await runPostDeployChecks({
    rpcUrl: input.rpcUrl,
    expectedChainId: input.chain.chainId,
    deployer: input.deployer,
    contracts: refreshedContracts,
    expectedContractCount: current.transactionCount,
    transactions: refreshed,
  });
  await deps.deployments.replaceChecks(deploymentId, checks);
  const failed = checks.some((check) => check.status === "FAILED");
  await deps.deployments.transition({
    deploymentId,
    fromStatus: "VERIFYING",
    toStatus: failed ? "FAILED" : "COMPLETED",
    reason: failed ? "post-deploy checks failed" : "deployment verified",
    errorCode: failed ? "DEPLOYMENT_FAILED" : null,
  });
}

async function loadNamedContracts(
  deps: DeploymentProcessorDependencies,
  revisionId: string,
  chainId: number,
): Promise<Array<{ address: string; contractName: string | null; sourcePath: string | null }>> {
  try {
    const dir = deps.artifacts.revisionDir(revisionId);
    const txs = await loadForgeBroadcast(dir, chainId);
    return txs.map((tx) => ({
      address: (tx.contractAddress ?? "").toLowerCase(),
      contractName: tx.contractName,
      sourcePath: tx.contractName === null ? null : `src/${tx.contractName}.sol`,
    }));
  } catch {
    return [];
  }
}

async function materialize(
  deps: DeploymentProcessorDependencies,
  revision: { id: string; type: string; repositoryId: string; baseCommitSha: string },
  workspace: { id: string; root: string },
): Promise<string> {
  const repoPath = path.join(workspace.root, "repo");
  if (revision.type === "GENERATED") {
    const exists = await deps.artifacts.exists(revision.id);
    if (!exists) {
      throw new UnrecoverableError("generated revision artifact missing");
    }
    await mkdir(repoPath, { recursive: true });
    await cp(deps.artifacts.revisionDir(revision.id), repoPath, { recursive: true });
    return repoPath;
  }
  const repository = await deps.ingest.getRepositoryById(revision.repositoryId);
  if (repository === undefined) {
    throw new UnrecoverableError("repository missing");
  }
  const source = deps.cloneSourceFor?.(repository.normalizedUrl) ?? {
    kind: "github" as const,
    ref: parseGitHubRepositoryUrl(repository.normalizedUrl),
  };
  const materializeFn = deps.materialize ?? materializeRevision;
  const materialized = await materializeFn({
    source,
    workspace,
    commitSha: revision.baseCommitSha,
    limits: { timeoutMs: deps.config.CLONE_TIMEOUT_MS, maxBytes: deps.config.CLONE_MAX_BYTES },
  });
  return materialized.repoPath;
}

function rewriteLocalhost(url: string): string {
  return url
    .replace("127.0.0.1", "host.docker.internal")
    .replace("localhost", "host.docker.internal");
}

async function mustGet(deps: DeploymentProcessorDependencies, id: string) {
  const run = await deps.deployments.getById(id);
  if (run === undefined) {
    throw new UnrecoverableError(`deployment ${id} was not found`);
  }
  return run;
}

function currentStatus(run: { status: DeploymentRunStatus }): DeploymentRunStatus {
  return run.status;
}

async function fail(
  deps: DeploymentProcessorDependencies,
  deploymentId: string,
  fromStatus: DeploymentRunStatus,
  code: string,
  message?: string,
): Promise<void> {
  try {
    await deps.deployments.transition({
      deploymentId,
      fromStatus,
      toStatus: "FAILED",
      reason: message ?? DEPLOYMENT_ERROR_MESSAGES.DEPLOYMENT_FAILED,
      errorCode: code,
      errorMessage: message ?? DEPLOYMENT_ERROR_MESSAGES.DEPLOYMENT_FAILED,
    });
  } catch {
    deps.logger.error({ deploymentId, fromStatus, code }, "failed to persist deployment failure");
  }
}

function codeOf(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return fallback;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "deployment failed";
}
