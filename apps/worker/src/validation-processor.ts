import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

import { hashRepositoryTree, type RevisionArtifactStore } from "@chainport/changeset";
import type { ChangeSetRepository, IngestRepository, ValidationRepository } from "@chainport/db";
import { materializeRevision, type CloneSource, type WorkspaceManager } from "@chainport/ingest";
import type { DockerSandboxRunner, SandboxHandle } from "@chainport/sandbox";
import {
  boundLog,
  detectWorkspace,
  imageForProfile,
  parseForgeOutput,
  parseHardhatOutput,
  selectProfile,
} from "@chainport/validation";
import {
  parseGitHubRepositoryUrl,
  VALIDATION_ERROR_MESSAGES,
  type ServiceConfig,
  type ValidationRunStatus,
  type ValidationStepName,
} from "@chainport/shared";
import { UnrecoverableError } from "bullmq";
import type { Logger } from "pino";

export interface ValidationProcessorDependencies {
  ingest: IngestRepository;
  revisions: ChangeSetRepository;
  validations: ValidationRepository;
  workspaces: WorkspaceManager;
  artifacts: RevisionArtifactStore;
  sandbox: DockerSandboxRunner;
  config: Pick<
    ServiceConfig,
    | "CLONE_TIMEOUT_MS"
    | "CLONE_MAX_BYTES"
    | "VALIDATION_INSTALL_TIMEOUT_MS"
    | "VALIDATION_BUILD_TIMEOUT_MS"
    | "VALIDATION_TEST_TIMEOUT_MS"
    | "VALIDATION_TOTAL_TIMEOUT_MS"
    | "VALIDATION_MEMORY_BYTES"
    | "VALIDATION_CPUS"
    | "VALIDATION_PIDS"
    | "VALIDATION_LOG_STEP_BYTES"
    | "SANDBOX_IMAGE_FOUNDRY"
    | "SANDBOX_IMAGE_NODE20"
    | "SANDBOX_IMAGE_NODE22"
  >;
  logger: Logger;
  materialize?: typeof materializeRevision;
  cloneSourceFor?: (normalizedUrl: string) => CloneSource;
}

export async function processValidationJob(
  validationId: string,
  deps: ValidationProcessorDependencies,
): Promise<void> {
  const run = await deps.validations.getById(validationId);
  if (run === undefined) {
    throw new UnrecoverableError(`validation ${validationId} was not found`);
  }
  if (run.status === "COMPLETED" || run.status === "TIMED_OUT") {
    return;
  }
  if (run.status === "FAILED" && run.outcome !== "INFRA_FAILURE") {
    return;
  }
  const revision = await deps.revisions.getRevision(run.repositoryRevisionId);
  if (revision === undefined) {
    throw new UnrecoverableError("repository revision was not found");
  }
  const repository = await deps.ingest.getRepositoryById(revision.repositoryId);
  if (repository === undefined) {
    throw new UnrecoverableError("repository was not found");
  }
  if (run.status === "FAILED") {
    await deps.validations.transition({
      validationId,
      fromStatus: "FAILED",
      toStatus: "QUEUED",
      reason: "retry infrastructure failure",
    });
  }
  const latest = await deps.validations.getById(validationId);
  if (latest?.status === "QUEUED") {
    await deps.validations.transition({
      validationId,
      fromStatus: "QUEUED",
      toStatus: "PREPARING",
      reason: "materialize started",
    });
  }

  await deps.sandbox.reapOrphans().catch(() => undefined);
  const workspace = await deps.workspaces.allocate();
  let handle: SandboxHandle | undefined;
  const started = Date.now();
  try {
    await deps.validations.updateStep({ validationId, name: "MATERIALIZE", status: "RUNNING" });
    let repoPath = path.join(workspace.root, "repo");
    if (revision.type === "GENERATED") {
      const exists = await deps.artifacts.exists(revision.id);
      if (!exists) {
        await failRun(
          deps,
          validationId,
          "PREPARING",
          "REVISION_ARTIFACT_MISSING",
          "INFRA_FAILURE",
        );
        return;
      }
      await mkdir(repoPath, { recursive: true });
      await cp(deps.artifacts.revisionDir(revision.id), repoPath, { recursive: true });
    } else {
      const source = deps.cloneSourceFor?.(repository.normalizedUrl) ?? {
        kind: "github" as const,
        ref: parseGitHubRepositoryUrl(repository.normalizedUrl),
      };
      const materialize = deps.materialize ?? materializeRevision;
      const materialized = await materialize({
        source,
        workspace,
        commitSha: revision.baseCommitSha,
        limits: { timeoutMs: deps.config.CLONE_TIMEOUT_MS, maxBytes: deps.config.CLONE_MAX_BYTES },
      });
      repoPath = materialized.repoPath;
    }
    await deps.validations.updateStep({ validationId, name: "MATERIALIZE", status: "PASSED" });

    await deps.validations.updateStep({ validationId, name: "VERIFY_REVISION", status: "RUNNING" });
    if (revision.type === "ORIGINAL") {
      const expected = `git:${revision.baseCommitSha.toLowerCase()}`;
      if (revision.contentHash !== expected) {
        await failRun(
          deps,
          validationId,
          "PREPARING",
          "REVISION_INTEGRITY_MISMATCH",
          "INFRA_FAILURE",
        );
        return;
      }
    } else {
      const actual = await hashRepositoryTree(repoPath);
      if (actual !== revision.contentHash) {
        await failRun(
          deps,
          validationId,
          "PREPARING",
          "REVISION_INTEGRITY_MISMATCH",
          "INFRA_FAILURE",
        );
        return;
      }
    }
    await deps.validations.updateStep({ validationId, name: "VERIFY_REVISION", status: "PASSED" });

    const detected = await detectWorkspace(repoPath);
    const imageOverrides = {
      ...(deps.config.SANDBOX_IMAGE_FOUNDRY === undefined
        ? {}
        : { foundry: deps.config.SANDBOX_IMAGE_FOUNDRY }),
      ...(deps.config.SANDBOX_IMAGE_NODE20 === undefined
        ? {}
        : { node20: deps.config.SANDBOX_IMAGE_NODE20 }),
      ...(deps.config.SANDBOX_IMAGE_NODE22 === undefined
        ? {}
        : { node22: deps.config.SANDBOX_IMAGE_NODE22 }),
    };
    const selected = selectProfile(detected, imageOverrides);
    if (selected.unsupportedCode !== null) {
      await skipRemaining(deps, validationId, ["INSTALL", "BUILD", "TEST"]);
      await finish(
        deps,
        validationId,
        "PREPARING",
        "COMPLETED",
        "UNSUPPORTED",
        selected.unsupportedCode,
        selected.unsupportedReason ?? VALIDATION_ERROR_MESSAGES.UNSUPPORTED_FRAMEWORK,
        detected.framework,
        Date.now() - started,
      );
      return;
    }

    const image = imageForProfile(selected, imageOverrides);
    handle = await deps.sandbox.prepare({
      image,
      workspaceHost: repoPath,
      limits: {
        memoryBytes: deps.config.VALIDATION_MEMORY_BYTES,
        cpus: deps.config.VALIDATION_CPUS,
        pids: deps.config.VALIDATION_PIDS,
      },
    });
    await deps.validations.setSandbox(validationId, handle.image, handle.imageDigest);
    const runtime = await deps.sandbox.execute(handle, {
      argv: selected.imageKind === "foundry" ? ["forge", "--version"] : ["node", "--version"],
      timeoutMs: 15_000,
      network: "none",
    });

    let current: ValidationRunStatus = "PREPARING";
    for (const command of selected.commands) {
      const nextStatus = statusForStep(command.step);
      if (current !== nextStatus) {
        await deps.validations.transition({
          validationId,
          fromStatus: current,
          toStatus: nextStatus,
          reason: `${command.step.toLowerCase()} started`,
          framework: detected.framework,
          runtimeVersion: runtime.stdout.trim().split("\n")[0] ?? null,
        });
        current = nextStatus;
      }
      await deps.validations.updateStep({ validationId, name: command.step, status: "RUNNING" });
      const timeoutMs = timeoutFor(command.step, deps.config);
      const result = await deps.sandbox.execute(handle, {
        argv: command.argv,
        timeoutMs,
        network: command.network,
      });
      const log = boundLog(
        `${result.stdout}\n${result.stderr}`,
        deps.config.VALIDATION_LOG_STEP_BYTES,
      );
      if (result.timedOut) {
        await deps.validations.updateStep({
          validationId,
          name: command.step,
          status: "TIMED_OUT",
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          logText: log.text,
          logTruncated: log.truncated,
          errorCode: "EXECUTION_TIMEOUT",
        });
        await finish(
          deps,
          validationId,
          current,
          "TIMED_OUT",
          "FAILED",
          "EXECUTION_TIMEOUT",
          VALIDATION_ERROR_MESSAGES.EXECUTION_TIMEOUT,
          detected.framework,
          Date.now() - started,
        );
        return;
      }
      if (result.exitCode !== 0) {
        const code = classifyCommandFailure(
          command.step,
          detected.hasLifecycleScripts,
          command.argv[0] ?? "",
        );
        await deps.validations.updateStep({
          validationId,
          name: command.step,
          status: "FAILED",
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          logText: log.text,
          logTruncated: log.truncated,
          errorCode: code,
        });
        if (command.step === "TEST") {
          const parsed =
            detected.framework === "FOUNDRY"
              ? parseForgeOutput(`${result.stdout}\n${result.stderr}`)
              : parseHardhatOutput(`${result.stdout}\n${result.stderr}`);
          await deps.validations.persistTestCounts({
            validationId,
            countsAvailable: parsed.countsAvailable,
            total: parsed.total,
            passed: parsed.passed,
            failed: parsed.failed,
            skipped: parsed.skipped,
            cases: parsed.cases,
          });
        }
        const stepNames = ["INSTALL", "BUILD", "TEST"] as const;
        const remaining = stepNames.filter(
          (name) =>
            selected.commands.some((item) => item.step === name) &&
            name !== command.step &&
            stepNames.indexOf(name) > stepNames.indexOf(command.step),
        );
        await skipRemaining(deps, validationId, remaining);
        await finish(
          deps,
          validationId,
          current,
          "COMPLETED",
          code === "INSTALL_SCRIPTS_REQUIRED" || code === "DEPENDENCY_RESOLUTION_FAILED"
            ? "UNSUPPORTED"
            : "FAILED",
          code,
          VALIDATION_ERROR_MESSAGES[code],
          detected.framework,
          Date.now() - started,
          command.step === "BUILD" ? "FAILED" : command.step === "TEST" ? "FAILED" : null,
          command.step === "TEST" ? "FAILED" : null,
        );
        return;
      }
      await deps.validations.updateStep({
        validationId,
        name: command.step,
        status: "PASSED",
        exitCode: 0,
        durationMs: result.durationMs,
        logText: log.text,
        logTruncated: log.truncated,
      });
      if (command.step === "TEST") {
        const parsed =
          detected.framework === "FOUNDRY"
            ? parseForgeOutput(`${result.stdout}\n${result.stderr}`)
            : parseHardhatOutput(`${result.stdout}\n${result.stderr}`);
        await deps.validations.persistTestCounts({
          validationId,
          countsAvailable: parsed.countsAvailable,
          total: parsed.total,
          passed: parsed.passed,
          failed: parsed.failed,
          skipped: parsed.skipped,
          cases: parsed.cases,
        });
      }
    }
    const hasTest = selected.commands.some((command) => command.step === "TEST");
    const hasBuild = selected.commands.some((command) => command.step === "BUILD");
    if (!selected.commands.some((command) => command.step === "INSTALL")) {
      await deps.validations.updateStep({ validationId, name: "INSTALL", status: "SKIPPED" });
    }
    await finish(
      deps,
      validationId,
      current,
      "COMPLETED",
      "PASSED",
      null,
      null,
      detected.framework,
      Date.now() - started,
      hasBuild ? "PASSED" : "SKIPPED",
      hasTest ? "PASSED" : "SKIPPED",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "VALIDATION_FAILED";
    const latestStatus = (await deps.validations.getById(validationId))?.status ?? "PREPARING";
    if (latestStatus !== "COMPLETED" && latestStatus !== "TIMED_OUT" && latestStatus !== "FAILED") {
      await failRun(
        deps,
        validationId,
        latestStatus,
        "SANDBOX_START_FAILED",
        "INFRA_FAILURE",
        message,
      );
    }
    throw error;
  } finally {
    if (handle !== undefined) {
      await deps.validations.updateStep({ validationId, name: "CLEANUP", status: "RUNNING" });
      try {
        await deps.sandbox.destroy(handle);
        await deps.validations.updateStep({ validationId, name: "CLEANUP", status: "PASSED" });
      } catch {
        await deps.validations.updateStep({
          validationId,
          name: "CLEANUP",
          status: "FAILED",
          errorCode: "CLEANUP_FAILED",
        });
      }
    } else {
      await deps.validations.updateStep({ validationId, name: "CLEANUP", status: "SKIPPED" });
    }
    await deps.workspaces.cleanup(workspace);
  }
}

function statusForStep(step: "INSTALL" | "BUILD" | "TEST"): ValidationRunStatus {
  if (step === "INSTALL") return "INSTALLING";
  if (step === "BUILD") return "BUILDING";
  return "TESTING";
}

function timeoutFor(
  step: "INSTALL" | "BUILD" | "TEST",
  config: ValidationProcessorDependencies["config"],
): number {
  if (step === "INSTALL") return config.VALIDATION_INSTALL_TIMEOUT_MS;
  if (step === "BUILD") return config.VALIDATION_BUILD_TIMEOUT_MS;
  return config.VALIDATION_TEST_TIMEOUT_MS;
}

function classifyCommandFailure(
  step: "INSTALL" | "BUILD" | "TEST",
  hasLifecycleScripts: boolean,
  binary: string,
):
  | "INSTALL_FAILED"
  | "BUILD_FAILED"
  | "TEST_FAILED"
  | "INSTALL_SCRIPTS_REQUIRED"
  | "DEPENDENCY_RESOLUTION_FAILED" {
  if (step === "INSTALL") {
    return binary === "git" ? "DEPENDENCY_RESOLUTION_FAILED" : "INSTALL_FAILED";
  }
  if (step === "BUILD" && hasLifecycleScripts) {
    return "INSTALL_SCRIPTS_REQUIRED";
  }
  if (step === "BUILD") {
    return "BUILD_FAILED";
  }
  return "TEST_FAILED";
}

async function skipRemaining(
  deps: ValidationProcessorDependencies,
  validationId: string,
  names: ValidationStepName[],
): Promise<void> {
  for (const name of names) {
    await deps.validations.updateStep({ validationId, name, status: "SKIPPED" });
  }
}

async function failRun(
  deps: ValidationProcessorDependencies,
  validationId: string,
  fromStatus: ValidationRunStatus,
  code: "REVISION_ARTIFACT_MISSING" | "REVISION_INTEGRITY_MISMATCH" | "SANDBOX_START_FAILED",
  outcome: "INFRA_FAILURE",
  message?: string,
): Promise<void> {
  await deps.validations.transition({
    validationId,
    fromStatus,
    toStatus: "FAILED",
    reason: "validation infrastructure failure",
    errorCode: code,
    errorMessage: message ?? VALIDATION_ERROR_MESSAGES[code],
    outcome,
  });
}

async function finish(
  deps: ValidationProcessorDependencies,
  validationId: string,
  fromStatus: ValidationRunStatus,
  toStatus: "COMPLETED" | "FAILED" | "TIMED_OUT",
  outcome: "PASSED" | "FAILED" | "PARTIAL" | "UNSUPPORTED" | "INFRA_FAILURE",
  errorCode: string | null,
  errorMessage: string | null,
  framework: "FOUNDRY" | "HARDHAT" | null,
  durationMs: number,
  buildStatus: "PASSED" | "FAILED" | "SKIPPED" | null = null,
  testStatus: "PASSED" | "FAILED" | "SKIPPED" | "TIMED_OUT" | null = null,
): Promise<void> {
  await deps.validations.transition({
    validationId,
    fromStatus,
    toStatus,
    reason: "validation finished",
    errorCode,
    errorMessage,
    outcome,
    framework,
    durationMs,
    buildStatus,
    testStatus,
  });
}
