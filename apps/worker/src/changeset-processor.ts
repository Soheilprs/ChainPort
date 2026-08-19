import { readFile, stat, writeFile } from "node:fs/promises";

import {
  applyPatchToWorkingText,
  generatePatch,
  hashRepositoryTree,
  isSkip,
  resolveContained,
  type PatchableAction,
  type RevisionArtifactStore,
} from "@chainport/changeset";
import type { ChangeSetRepository, IngestRepository, PlanRepository } from "@chainport/db";
import { materializeRevision, type CloneSource, type WorkspaceManager } from "@chainport/ingest";
import {
  CHANGESET_ENGINE_VERSION,
  CHANGESET_ERROR_MESSAGES,
  createId,
  parseGitHubRepositoryUrl,
  type ChangeSetStatus,
  type ServiceConfig,
} from "@chainport/shared";
import { UnrecoverableError } from "bullmq";
import type { Logger } from "pino";

export interface ChangeSetProcessorDependencies {
  ingest: IngestRepository;
  plans: PlanRepository;
  changeSets: ChangeSetRepository;
  workspaces: WorkspaceManager;
  artifacts: RevisionArtifactStore;
  config: Pick<ServiceConfig, "CLONE_TIMEOUT_MS" | "CLONE_MAX_BYTES" | "ANALYSIS_MAX_FILE_BYTES">;
  logger: Logger;
  materialize?: typeof materializeRevision;
  cloneSourceFor?: (normalizedUrl: string) => CloneSource;
}

const IN_FLIGHT_GENERATE: ReadonlySet<ChangeSetStatus> = new Set([
  "QUEUED",
  "MATERIALIZING",
  "GENERATING",
  "FAILED",
]);

export async function processGenerateChangeSet(
  changeSetId: string,
  deps: ChangeSetProcessorDependencies,
): Promise<void> {
  const record = await deps.changeSets.getById(changeSetId);
  if (record === undefined) {
    throw new UnrecoverableError(`changeset ${changeSetId} was not found`);
  }
  if (
    record.status === "READY_FOR_REVIEW" ||
    record.status === "FINALIZING" ||
    record.status === "FINALIZED" ||
    record.status === "ROLLED_BACK"
  ) {
    return;
  }
  const plan = await deps.plans.getDetails(record.migrationPlanId);
  if (plan === null) {
    throw new UnrecoverableError("migration plan was not found");
  }
  const repository = await deps.ingest.getRepositoryById(record.repositoryId);
  if (repository === undefined || repository.resolvedCommitSha === null) {
    throw new UnrecoverableError("repository SHA is missing");
  }
  const expectedSha = record.baseCommitSha.toLowerCase();
  if (
    plan.commitSha.toLowerCase() !== expectedSha ||
    repository.resolvedCommitSha.toLowerCase() !== expectedSha
  ) {
    await fail(
      deps,
      record.id,
      record.status,
      "REVISION_MISMATCH",
      CHANGESET_ERROR_MESSAGES.REVISION_MISMATCH,
    );
    throw new UnrecoverableError("REVISION_MISMATCH");
  }

  const log = deps.logger.child({
    changeSetId,
    commitSha: expectedSha,
    engineVersion: CHANGESET_ENGINE_VERSION,
  });
  log.info("changeset_generate_started");

  if (record.status === "FAILED") {
    await deps.changeSets.transition({
      changeSetId,
      fromStatus: "FAILED",
      toStatus: "QUEUED",
      reason: "retry scheduled",
    });
  }
  const latest = await deps.changeSets.getById(changeSetId);
  if (latest?.status === "QUEUED") {
    await deps.changeSets.transition({
      changeSetId,
      fromStatus: "QUEUED",
      toStatus: "MATERIALIZING",
      reason: "materialize started",
    });
  }

  const workspace = await deps.workspaces.allocate();
  try {
    const source = deps.cloneSourceFor?.(repository.normalizedUrl) ?? {
      kind: "github" as const,
      ref: parseGitHubRepositoryUrl(repository.normalizedUrl),
    };
    const materialize = deps.materialize ?? materializeRevision;
    const materialized = await materialize({
      source,
      workspace,
      commitSha: expectedSha,
      limits: { timeoutMs: deps.config.CLONE_TIMEOUT_MS, maxBytes: deps.config.CLONE_MAX_BYTES },
    });
    if (materialized.commitSha !== expectedSha) {
      throw new Error("REVISION_MISMATCH");
    }
    const current = await deps.changeSets.getById(changeSetId);
    if (current?.status === "MATERIALIZING") {
      await deps.changeSets.transition({
        changeSetId,
        fromStatus: "MATERIALIZING",
        toStatus: "GENERATING",
        reason: "patch generation started",
      });
    }

    const generated = [];
    for (const action of plan.actions) {
      if (action.automationLevel !== "SAFE_AUTOMATIC") {
        continue;
      }
      const filePaths = [...new Set(action.evidence.map((item) => item.filePath))];
      if (filePaths.length !== 1 || filePaths[0] === undefined) {
        generated.push(
          skipRow(
            action.id,
            action.evidence[0]?.filePath ?? "",
            "PATCH_PRECONDITION_FAILED",
            "Safe patches require exactly one evidence file",
          ),
        );
        continue;
      }
      const filePath = filePaths[0];
      const contained = resolveContained(materialized.repoPath, filePath);
      if (contained === null) {
        generated.push(
          skipRow(
            action.id,
            filePath,
            "PATH_ESCAPE_DETECTED",
            "Patch path escaped the repository root",
          ),
        );
        continue;
      }
      let fileText: string;
      try {
        const info = await stat(contained);
        if (info.size > deps.config.ANALYSIS_MAX_FILE_BYTES) {
          generated.push(
            skipRow(
              action.id,
              filePath,
              "PATCHER_UNSUPPORTED",
              "File exceeds the patch size limit",
            ),
          );
          continue;
        }
        fileText = await readFile(contained, "utf8");
      } catch {
        generated.push(
          skipRow(
            action.id,
            filePath,
            "SOURCE_MISMATCH",
            "Evidence file is missing from the stored revision",
          ),
        );
        continue;
      }
      const patchable = toPatchable(action);
      const result = generatePatch({ action: patchable, filePath, fileText });
      if (isSkip(result)) {
        generated.push(skipRow(action.id, filePath, result.code, result.reason));
        continue;
      }
      generated.push({
        migrationActionId: action.id,
        filePath,
        patcherId: result.patcherId,
        patcherVersion: result.patcherVersion,
        changeType: "REPLACE_VALUE" as const,
        status: "PROPOSED" as const,
        skipReason: null,
        sourceHash: result.sourceHash,
        resultHash: result.resultHash,
        beforeExcerpt: result.beforeExcerpt,
        afterExcerpt: result.afterExcerpt,
        unifiedDiff: result.unifiedDiff,
        patchedText: result.patchedText,
        sourceValue: result.sourceValue,
        targetValue: result.targetValue,
        reason: result.reason,
      });
    }

    await deps.changeSets.persistGenerated(changeSetId, generated);
    await deps.changeSets.transition({
      changeSetId,
      fromStatus: "GENERATING",
      toStatus: "READY_FOR_REVIEW",
      reason: "patches ready for review",
    });
    log.info({ total: generated.length }, "changeset_generate_completed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "CHANGESET_FAILED";
    const code = message === "REVISION_MISMATCH" ? "REVISION_MISMATCH" : "CHANGESET_FAILED";
    const latestStatus = (await deps.changeSets.getById(changeSetId))?.status ?? "GENERATING";
    if (IN_FLIGHT_GENERATE.has(latestStatus) && latestStatus !== "FAILED") {
      await fail(deps, changeSetId, latestStatus, code, message);
    }
    log.warn({ code }, "changeset_generate_failed");
    throw code === "REVISION_MISMATCH" ? new UnrecoverableError(message) : error;
  } finally {
    await deps.workspaces.cleanup(workspace);
    log.info("workspace_cleaned");
  }
}

export async function processFinalizeChangeSet(
  changeSetId: string,
  deps: ChangeSetProcessorDependencies,
): Promise<void> {
  const record = await deps.changeSets.getById(changeSetId);
  if (record === undefined) {
    throw new UnrecoverableError(`changeset ${changeSetId} was not found`);
  }
  if (record.status === "FINALIZED" || record.status === "ROLLED_BACK") {
    return;
  }
  if (record.status !== "READY_FOR_REVIEW" && record.status !== "FINALIZING") {
    throw new UnrecoverableError("changeset is not eligible to finalize");
  }
  const plan = await deps.plans.getDetails(record.migrationPlanId);
  if (plan === null) {
    throw new UnrecoverableError("migration plan was not found");
  }
  const repository = await deps.ingest.getRepositoryById(record.repositoryId);
  if (repository === undefined || repository.resolvedCommitSha === null) {
    throw new UnrecoverableError("repository SHA is missing");
  }
  const expectedSha = record.baseCommitSha.toLowerCase();
  if (repository.resolvedCommitSha.toLowerCase() !== expectedSha) {
    await fail(
      deps,
      record.id,
      record.status,
      "REVISION_MISMATCH",
      CHANGESET_ERROR_MESSAGES.REVISION_MISMATCH,
    );
    throw new UnrecoverableError("REVISION_MISMATCH");
  }

  const log = deps.logger.child({ changeSetId, commitSha: expectedSha });
  if (record.status === "READY_FOR_REVIEW") {
    await deps.changeSets.skipRemainingProposed(changeSetId);
    await deps.changeSets.transition({
      changeSetId,
      fromStatus: "READY_FOR_REVIEW",
      toStatus: "FINALIZING",
      reason: "finalization started",
    });
  }

  const workspace = await deps.workspaces.allocate();
  try {
    const source = deps.cloneSourceFor?.(repository.normalizedUrl) ?? {
      kind: "github" as const,
      ref: parseGitHubRepositoryUrl(repository.normalizedUrl),
    };
    const materialize = deps.materialize ?? materializeRevision;
    const materialized = await materialize({
      source,
      workspace,
      commitSha: expectedSha,
      limits: { timeoutMs: deps.config.CLONE_TIMEOUT_MS, maxBytes: deps.config.CLONE_MAX_BYTES },
    });
    const accepted = await deps.changeSets.listAccepted(changeSetId);
    const actions = new Map(plan.actions.map((action) => [action.id, action]));
    for (const change of accepted) {
      const contained = resolveContained(materialized.repoPath, change.filePath);
      if (contained === null) {
        throw new Error("PATH_ESCAPE_DETECTED");
      }
      const action =
        change.migrationActionId === null ? undefined : actions.get(change.migrationActionId);
      if (action === undefined) {
        throw new Error("FINALIZATION_FAILED");
      }
      const fileText = await readFile(contained, "utf8");
      const result = applyPatchToWorkingText({
        action: {
          ...toPatchable(action),
          sourceValue: change.sourceValue ?? action.sourceValue,
          targetValue: change.targetValue ?? action.targetValue,
        },
        filePath: change.filePath,
        fileText,
      });
      if (isSkip(result)) {
        throw new Error("FINALIZATION_FAILED");
      }
      await writeFile(contained, result.patchedText, "utf8");
    }

    const existingGenerated = await deps.changeSets.findGeneratedByChangeSet(changeSetId);
    const generatedId = existingGenerated?.id ?? createId();
    await deps.artifacts.snapshotFrom(generatedId, materialized.repoPath);
    const contentHash = await hashRepositoryTree(deps.artifacts.revisionDir(generatedId));
    const counts = await deps.changeSets.getById(changeSetId);
    const completeness =
      (counts?.rejectedCount ?? 0) === 0 &&
      (counts?.skippedCount ?? 0) === 0 &&
      (counts?.failedCount ?? 0) === 0
        ? "COMPLETE"
        : "PARTIAL";
    if (existingGenerated === undefined) {
      await deps.changeSets.createGeneratedRevision({
        id: generatedId,
        projectId: record.projectId,
        repositoryId: record.repositoryId,
        baseRevisionId: record.originalRevisionId,
        baseCommitSha: expectedSha,
        changeSetId,
        contentHash,
        completeness,
      });
    }
    await deps.changeSets.setCompleteness(changeSetId, completeness);
    await deps.changeSets.setActiveRevision(record.projectId, generatedId);
    await deps.changeSets.transition({
      changeSetId,
      fromStatus: "FINALIZING",
      toStatus: "FINALIZED",
      reason: "derived revision created",
    });
    log.info({ contentHash, completeness }, "changeset_finalized");
  } catch (error) {
    const message = error instanceof Error ? error.message : "FINALIZATION_FAILED";
    const latestStatus = (await deps.changeSets.getById(changeSetId))?.status ?? "FINALIZING";
    if (latestStatus !== "FAILED" && latestStatus !== "FINALIZED") {
      await fail(deps, changeSetId, latestStatus, "FINALIZATION_FAILED", message);
    }
    log.warn({ err: error }, "changeset_finalize_failed");
    throw error;
  } finally {
    await deps.workspaces.cleanup(workspace);
    log.info("workspace_cleaned");
  }
}

function toPatchable(action: {
  id: string;
  semanticKey: string;
  category: PatchableAction["category"];
  automationLevel: PatchableAction["automationLevel"];
  sourceValue: string | null;
  targetValue: string | null;
  evidence: readonly { filePath: string; startLine: number; excerpt: string }[];
}): PatchableAction {
  return {
    id: action.id,
    semanticKey: action.semanticKey,
    category: action.category,
    automationLevel: action.automationLevel,
    sourceValue: action.sourceValue,
    targetValue: action.targetValue,
    evidence: action.evidence.map((item) => ({
      filePath: item.filePath,
      startLine: item.startLine,
      excerpt: item.excerpt,
    })),
  };
}

function skipRow(actionId: string, filePath: string, code: string, reason: string) {
  return {
    migrationActionId: actionId,
    filePath,
    patcherId: null,
    patcherVersion: null,
    changeType: null,
    status: "SKIPPED" as const,
    skipReason: code,
    sourceHash: null,
    resultHash: null,
    beforeExcerpt: null,
    afterExcerpt: null,
    unifiedDiff: null,
    patchedText: null,
    sourceValue: null,
    targetValue: null,
    reason,
  };
}

async function fail(
  deps: ChangeSetProcessorDependencies,
  changeSetId: string,
  fromStatus: ChangeSetStatus,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  await deps.changeSets.transition({
    changeSetId,
    fromStatus,
    toStatus: "FAILED",
    reason: "changeset failed",
    errorCode,
    errorMessage,
  });
}
