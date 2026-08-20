import { asJsonObject } from "@chainport/db";

import type { CompatibilityService } from "../compatibility-service.js";
import type { AccessControl } from "../access.js";
import type { ApiInstance } from "../types.js";

const STATUS_ORDER = ["BLOCKER", "WARNING", "UNKNOWN", "PASS"] as const;

function statusRank(status: string): number {
  const index = (STATUS_ORDER as readonly string[]).indexOf(status);
  return index === -1 ? STATUS_ORDER.length : index;
}

export function registerCompatibilityRoutes(
  app: ApiInstance,
  service: CompatibilityService,
  access?: AccessControl,
): void {
  app.post<{ Params: { id: string } }>(
    "/v1/projects/:id/compatibility-runs",
    async (request, reply) => {
      if (access !== undefined) {
        await access.requireProject(request.actor, request.params.id);
      }
      const result = await service.createForProject(request.params.id, request.body);
      return reply.status(result.created ? 201 : 200).send({
        data: presentRun(result.run),
      });
    },
  );

  app.get<{ Params: { id: string } }>("/v1/projects/:id/compatibility-runs", async (request) => {
    if (access !== undefined) {
      await access.requireProject(request.actor, request.params.id);
    }
    const runs = await service.listForProject(request.params.id);
    return { data: runs.map(presentRun) };
  });

  app.get<{ Params: { id: string } }>("/v1/analyses/:id/compatibility-runs", async (request) => {
    const runs = await service.listForAnalysis(request.params.id);
    return { data: runs.map(presentRun) };
  });

  app.get<{ Params: { id: string } }>("/v1/compatibility-runs/:id", async (request) => {
    const details = await service.get(request.params.id);
    if (access !== undefined) {
      await access.requireProject(request.actor, details.projectId);
    }
    const findings = [...details.findings].sort(
      (left, right) => statusRank(left.status) - statusRank(right.status),
    );
    return {
      data: {
        run: presentRun(details),
        snapshot: {
          hash: details.registrySnapshot.hash,
          registryVersion: details.registrySnapshot.registryVersion,
          targetChainKey: details.registrySnapshot.targetChainKey,
        },
        categories: details.categories,
        findings: findings.map((finding) => ({
          id: finding.id,
          requirementId: finding.requirementId,
          ruleId: finding.ruleId,
          ruleVersion: finding.ruleVersion,
          category: finding.category,
          status: finding.status,
          title: finding.title,
          summary: finding.summary,
          technicalReason: finding.technicalReason,
          remediationType: finding.remediationType,
          sourceValue: finding.sourceValue,
          targetValue: finding.targetValue,
          confidence: finding.confidence,
          registryEvidence: asJsonObject(finding.registryEvidence),
          requirement: finding.requirement
            ? {
                id: finding.requirement.id,
                key: finding.requirement.key,
                category: finding.requirement.category,
                confidence: finding.requirement.confidence,
                detector: finding.requirement.detector,
                evidence: finding.requirement.evidence.map((entry) => ({
                  id: entry.id,
                  filePath: entry.filePath,
                  startLine: entry.startLine,
                  endLine: entry.endLine,
                  evidenceType: entry.evidenceType,
                  excerpt: entry.excerpt,
                })),
              }
            : null,
        })),
        events: details.statusEvents.map((event) => ({
          id: event.id,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          reason: event.reason,
          createdAt: event.createdAt.toISOString(),
        })),
      },
    };
  });
}

function presentRun(run: {
  id: string;
  projectId: string;
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  sourceChainKey: string;
  targetChainKey: string;
  scannerVersion: string;
  rulesetVersion: string;
  registryVersion: string;
  registrySnapshotHash: string;
  score: number;
  coverage: number;
  coverageConfidence: string;
  readiness: string;
  status: string;
  passCount: number;
  warningCount: number;
  blockerCount: number;
  unknownCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  evaluatedAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: run.id,
    projectId: run.projectId,
    analysisId: run.analysisId,
    repositoryId: run.repositoryId,
    commitSha: run.commitSha,
    sourceChainKey: run.sourceChainKey,
    targetChainKey: run.targetChainKey,
    scannerVersion: run.scannerVersion,
    rulesetVersion: run.rulesetVersion,
    registryVersion: run.registryVersion,
    registrySnapshotHash: run.registrySnapshotHash,
    score: run.score,
    coverage: run.coverage,
    coverageConfidence: run.coverageConfidence,
    readiness: run.readiness,
    status: run.status,
    passCount: run.passCount,
    warningCount: run.warningCount,
    blockerCount: run.blockerCount,
    unknownCount: run.unknownCount,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    evaluatedAt: run.evaluatedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}
