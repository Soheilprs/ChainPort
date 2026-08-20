import {
  assertDeploymentTransition,
  createId,
  type DeploymentCandidateConfidence,
  type DeploymentCandidateRecord,
  type DeploymentCheckRecord,
  type DeploymentCheckStatus,
  type DeploymentContractRecord,
  type DeploymentFramework,
  type DeploymentPreflightRecord,
  type DeploymentPreflightStatus,
  type DeploymentProfile,
  type DeploymentRunRecord,
  type DeploymentRunStatus,
  type DeploymentSourceVerificationStatus,
  type DeploymentTransactionRecord,
  type DeploymentTransactionStatus,
  type JsonObject,
} from "@chainport/shared";

import type { DatabaseClient } from "./client.js";
import { rethrowPersistenceError } from "./client.js";
import { asJsonObject } from "./compatibility-repository.js";

export class DeploymentRepository {
  public constructor(private readonly client: DatabaseClient) {}

  public async findByIdempotencyKey(key: string): Promise<DeploymentRunRecord | undefined> {
    const row = await this.client.deploymentRun.findUnique({ where: { idempotencyKey: key } });
    return row === null ? undefined : mapRun(row);
  }

  public async getById(id: string): Promise<DeploymentRunRecord | undefined> {
    const row = await this.client.deploymentRun.findUnique({ where: { id } });
    return row === null ? undefined : mapRun(row);
  }

  public async listForRevision(repositoryRevisionId: string): Promise<DeploymentRunRecord[]> {
    const rows = await this.client.deploymentRun.findMany({
      where: { repositoryRevisionId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapRun);
  }

  public async listForProject(projectId: string): Promise<DeploymentRunRecord[]> {
    const rows = await this.client.deploymentRun.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapRun);
  }

  public async listCandidates(revisionId: string): Promise<DeploymentCandidateRecord[]> {
    const rows = await this.client.deploymentCandidate.findMany({
      where: { revisionId },
      orderBy: { filePath: "asc" },
    });
    return rows.map(mapCandidate);
  }

  public async getCandidate(id: string): Promise<DeploymentCandidateRecord | undefined> {
    const row = await this.client.deploymentCandidate.findUnique({ where: { id } });
    return row === null ? undefined : mapCandidate(row);
  }

  public async upsertCandidate(input: {
    revisionId: string;
    framework: DeploymentFramework;
    filePath: string;
    entrypoint: string;
    confidence: DeploymentCandidateConfidence;
    evidence: JsonObject;
  }): Promise<DeploymentCandidateRecord> {
    const existing = await this.client.deploymentCandidate.findUnique({
      where: {
        revisionId_framework_filePath_entrypoint: {
          revisionId: input.revisionId,
          framework: input.framework,
          filePath: input.filePath,
          entrypoint: input.entrypoint,
        },
      },
    });
    if (existing !== null) {
      const updated = await this.client.deploymentCandidate.update({
        where: { id: existing.id },
        data: { confidence: input.confidence, evidence: input.evidence },
      });
      return mapCandidate(updated);
    }
    const created = await this.client.deploymentCandidate.create({
      data: {
        id: createId(),
        revisionId: input.revisionId,
        framework: input.framework,
        filePath: input.filePath,
        entrypoint: input.entrypoint,
        confidence: input.confidence,
        evidence: input.evidence,
      },
    });
    return mapCandidate(created);
  }

  public async createQueued(input: {
    projectId: string;
    repositoryRevisionId: string;
    plannedMigrationId: string | null;
    changeSetId: string | null;
    validationRunId: string;
    deploymentCandidateId: string | null;
    targetTestnetKey: string;
    targetChainId: number;
    targetName: string;
    revisionContentHash: string;
    engineVersion: string;
    profile: DeploymentProfile;
    framework: DeploymentFramework | null;
    sandboxImage: string | null;
    sandboxImageDigest: string | null;
    limitsJson: JsonObject;
    networkPolicy: string;
    idempotencyKey: string;
  }): Promise<DeploymentRunRecord> {
    try {
      const row = await this.client.$transaction(async (tx) => {
        const created = await tx.deploymentRun.create({
          data: {
            id: createId(),
            projectId: input.projectId,
            repositoryRevisionId: input.repositoryRevisionId,
            plannedMigrationId: input.plannedMigrationId,
            changeSetId: input.changeSetId,
            validationRunId: input.validationRunId,
            deploymentCandidateId: input.deploymentCandidateId,
            targetTestnetKey: input.targetTestnetKey,
            targetChainId: input.targetChainId,
            targetName: input.targetName,
            revisionContentHash: input.revisionContentHash,
            engineVersion: input.engineVersion,
            profile: input.profile,
            framework: input.framework,
            sandboxImage: input.sandboxImage,
            sandboxImageDigest: input.sandboxImageDigest,
            limitsJson: input.limitsJson,
            networkPolicy: input.networkPolicy,
            idempotencyKey: input.idempotencyKey,
            status: "QUEUED",
          },
        });
        await tx.deploymentStatusEvent.create({
          data: {
            id: createId(),
            deploymentRunId: created.id,
            fromStatus: null,
            toStatus: "QUEUED",
            reason: "deployment requested",
          },
        });
        return created;
      });
      return mapRun(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async transition(input: {
    deploymentId: string;
    fromStatus: DeploymentRunStatus;
    toStatus: DeploymentRunStatus;
    reason: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    deployerAddress?: string | null;
    framework?: DeploymentFramework | null;
    transactionCount?: number | null;
    estimatedGas?: string | null;
    estimatedCost?: string | null;
    rpcAuditJson?: JsonObject;
  }): Promise<DeploymentRunRecord> {
    assertDeploymentTransition(input.fromStatus, input.toStatus);
    const now = new Date();
    const terminal =
      input.toStatus === "COMPLETED" ||
      input.toStatus === "FAILED" ||
      input.toStatus === "CANCELLED" ||
      input.toStatus === "RECONCILIATION_REQUIRED";
    try {
      const row = await this.client.$transaction(async (tx) => {
        const updated = await tx.deploymentRun.update({
          where: { id: input.deploymentId },
          data: {
            status: input.toStatus,
            ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
            ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
            ...(input.deployerAddress !== undefined
              ? { deployerAddress: input.deployerAddress }
              : {}),
            ...(input.framework !== undefined ? { framework: input.framework } : {}),
            ...(input.transactionCount !== undefined
              ? { transactionCount: input.transactionCount }
              : {}),
            ...(input.estimatedGas !== undefined ? { estimatedGas: input.estimatedGas } : {}),
            ...(input.estimatedCost !== undefined ? { estimatedCost: input.estimatedCost } : {}),
            ...(input.rpcAuditJson !== undefined ? { rpcAuditJson: input.rpcAuditJson } : {}),
            ...(input.toStatus === "CHECKING_ELIGIBILITY" && input.fromStatus === "QUEUED"
              ? { startedAt: now }
              : {}),
            ...(input.toStatus === "BROADCASTING" ? { broadcastStartedAt: now } : {}),
            ...(terminal ? { completedAt: now } : {}),
          },
        });
        await tx.deploymentStatusEvent.create({
          data: {
            id: createId(),
            deploymentRunId: input.deploymentId,
            fromStatus: input.fromStatus,
            toStatus: input.toStatus,
            reason: input.reason,
          },
        });
        return updated;
      });
      return mapRun(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async setDeployerAddress(deploymentId: string, address: string): Promise<void> {
    await this.client.deploymentRun.update({
      where: { id: deploymentId },
      data: { deployerAddress: address },
    });
  }

  public async setCandidate(deploymentId: string, candidateId: string): Promise<void> {
    await this.client.deploymentRun.update({
      where: { id: deploymentId },
      data: { deploymentCandidateId: candidateId },
    });
  }

  public async upsertPreflight(input: {
    deploymentRunId: string;
    transactionCount: number | null;
    estimatedGas: string | null;
    estimatedCost: string | null;
    status: DeploymentPreflightStatus;
    warnings: JsonObject;
  }): Promise<DeploymentPreflightRecord> {
    const existing = await this.client.deploymentPreflight.findUnique({
      where: { deploymentRunId: input.deploymentRunId },
    });
    const data = {
      transactionCount: input.transactionCount,
      estimatedGas: input.estimatedGas,
      estimatedCost: input.estimatedCost,
      status: input.status,
      warnings: input.warnings,
    };
    const row =
      existing === null
        ? await this.client.deploymentPreflight.create({
            data: { id: createId(), deploymentRunId: input.deploymentRunId, ...data },
          })
        : await this.client.deploymentPreflight.update({
            where: { id: existing.id },
            data,
          });
    return mapPreflight(row);
  }

  public async recordTransaction(input: {
    deploymentRunId: string;
    sequence: number;
    hash: string;
    nonce: number | null;
    from: string | null;
    to: string | null;
    value: string;
    gasLimit: string | null;
    status: DeploymentTransactionStatus;
    blockNumber?: number | null;
    contractAddress?: string | null;
    confirmedAt?: Date | null;
  }): Promise<DeploymentTransactionRecord> {
    const existing = await this.client.deploymentTransaction.findUnique({
      where: { deploymentRunId_hash: { deploymentRunId: input.deploymentRunId, hash: input.hash } },
    });
    if (existing !== null) {
      const updated = await this.client.deploymentTransaction.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          nonce: input.nonce ?? existing.nonce,
          fromAddress: input.from ?? existing.fromAddress,
          toAddress: input.to ?? existing.toAddress,
          value: input.value,
          gasLimit: input.gasLimit ?? existing.gasLimit,
          blockNumber: input.blockNumber ?? existing.blockNumber,
          contractAddress: input.contractAddress ?? existing.contractAddress,
          confirmedAt: input.confirmedAt ?? existing.confirmedAt,
        },
      });
      return mapTransaction(updated);
    }
    const created = await this.client.deploymentTransaction.create({
      data: {
        id: createId(),
        deploymentRunId: input.deploymentRunId,
        sequence: input.sequence,
        hash: input.hash,
        nonce: input.nonce,
        fromAddress: input.from,
        toAddress: input.to,
        value: input.value,
        gasLimit: input.gasLimit,
        status: input.status,
        blockNumber: input.blockNumber ?? null,
        contractAddress: input.contractAddress ?? null,
        confirmedAt: input.confirmedAt ?? null,
      },
    });
    return mapTransaction(created);
  }

  public async listTransactions(deploymentRunId: string): Promise<DeploymentTransactionRecord[]> {
    const rows = await this.client.deploymentTransaction.findMany({
      where: { deploymentRunId },
      orderBy: { sequence: "asc" },
    });
    return rows.map(mapTransaction);
  }

  public async upsertContract(input: {
    deploymentRunId: string;
    address: string;
    transactionHash: string;
    blockNumber: number | null;
    deployer: string | null;
    contractName: string | null;
    sourcePath: string | null;
    bytecodePresent: boolean;
    receiptStatus: string | null;
    verificationStatus: DeploymentSourceVerificationStatus;
    verificationMessage: string | null;
  }): Promise<DeploymentContractRecord> {
    const existing = await this.client.deploymentContract.findUnique({
      where: {
        deploymentRunId_address: {
          deploymentRunId: input.deploymentRunId,
          address: input.address.toLowerCase(),
        },
      },
    });
    const data = {
      transactionHash: input.transactionHash,
      blockNumber: input.blockNumber,
      deployer: input.deployer,
      contractName: input.contractName,
      sourcePath: input.sourcePath,
      bytecodePresent: input.bytecodePresent,
      receiptStatus: input.receiptStatus,
      verificationStatus: input.verificationStatus,
      verificationMessage: input.verificationMessage,
    };
    const row =
      existing === null
        ? await this.client.deploymentContract.create({
            data: {
              id: createId(),
              deploymentRunId: input.deploymentRunId,
              address: input.address.toLowerCase(),
              ...data,
            },
          })
        : await this.client.deploymentContract.update({ where: { id: existing.id }, data });
    return mapContract(row);
  }

  public async listContracts(deploymentRunId: string): Promise<DeploymentContractRecord[]> {
    const rows = await this.client.deploymentContract.findMany({
      where: { deploymentRunId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapContract);
  }

  public async replaceChecks(
    deploymentRunId: string,
    checks: Array<{ name: string; status: DeploymentCheckStatus; detail: string }>,
  ): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.deploymentCheck.deleteMany({ where: { deploymentRunId } });
      if (checks.length === 0) {
        return;
      }
      await tx.deploymentCheck.createMany({
        data: checks.map((check) => ({
          id: createId(),
          deploymentRunId,
          name: check.name,
          status: check.status,
          detail: check.detail,
        })),
      });
    });
  }

  public async getDetails(id: string) {
    return this.client.deploymentRun.findUnique({
      where: { id },
      include: {
        events: { orderBy: { createdAt: "asc" } },
        preflight: true,
        transactions: { orderBy: { sequence: "asc" } },
        contracts: { orderBy: { createdAt: "asc" } },
        checks: { orderBy: { createdAt: "asc" } },
        deploymentCandidate: true,
        repositoryRevision: true,
      },
    });
  }
}

function mapRun(row: {
  id: string;
  projectId: string;
  repositoryRevisionId: string;
  plannedMigrationId: string | null;
  changeSetId: string | null;
  validationRunId: string;
  deploymentCandidateId: string | null;
  targetTestnetKey: string;
  targetChainId: number;
  targetName: string;
  revisionContentHash: string;
  engineVersion: string;
  profile: DeploymentProfile;
  framework: DeploymentFramework | null;
  status: DeploymentRunStatus;
  deployerAddress: string | null;
  sandboxImage: string | null;
  sandboxImageDigest: string | null;
  transactionCount: number | null;
  estimatedGas: string | null;
  estimatedCost: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  idempotencyKey: string;
  limitsJson: unknown;
  networkPolicy: string;
  rpcAuditJson: unknown;
  broadcastStartedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): DeploymentRunRecord {
  return {
    ...row,
    limitsJson: asJsonObject(row.limitsJson),
    rpcAuditJson: asJsonObject(row.rpcAuditJson),
  };
}

function mapCandidate(row: {
  id: string;
  revisionId: string;
  framework: DeploymentFramework;
  filePath: string;
  entrypoint: string;
  confidence: DeploymentCandidateConfidence;
  evidence: unknown;
  createdAt: Date;
}): DeploymentCandidateRecord {
  return { ...row, evidence: asJsonObject(row.evidence) };
}

function mapPreflight(row: {
  id: string;
  deploymentRunId: string;
  transactionCount: number | null;
  estimatedGas: string | null;
  estimatedCost: string | null;
  status: DeploymentPreflightStatus;
  warnings: unknown;
  createdAt: Date;
}): DeploymentPreflightRecord {
  return { ...row, warnings: asJsonObject(row.warnings) };
}

function mapTransaction(row: {
  id: string;
  deploymentRunId: string;
  sequence: number;
  hash: string;
  nonce: number | null;
  fromAddress: string | null;
  toAddress: string | null;
  value: string;
  gasLimit: string | null;
  status: DeploymentTransactionStatus;
  blockNumber: number | null;
  contractAddress: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
}): DeploymentTransactionRecord {
  return {
    id: row.id,
    deploymentRunId: row.deploymentRunId,
    sequence: row.sequence,
    hash: row.hash,
    nonce: row.nonce,
    from: row.fromAddress,
    to: row.toAddress,
    value: row.value,
    gasLimit: row.gasLimit,
    status: row.status,
    blockNumber: row.blockNumber,
    contractAddress: row.contractAddress,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt,
  };
}

function mapContract(row: {
  id: string;
  deploymentRunId: string;
  address: string;
  transactionHash: string;
  blockNumber: number | null;
  deployer: string | null;
  contractName: string | null;
  sourcePath: string | null;
  bytecodePresent: boolean;
  receiptStatus: string | null;
  verificationStatus: DeploymentSourceVerificationStatus;
  verificationMessage: string | null;
  createdAt: Date;
}): DeploymentContractRecord {
  return row;
}

export type { DeploymentCheckRecord };
