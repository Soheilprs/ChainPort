import type { AnalysisService } from "../analysis-service.js";
import type { ApiInstance } from "../types.js";

export function registerAnalysisRoutes(app: ApiInstance, service: AnalysisService): void {
  app.post<{ Params: { id: string } }>("/v1/projects/:id/analyses", async (request, reply) => {
    const result = await service.createForProject(request.params.id);
    return reply.status(result.created ? 201 : 200).send({
      data: presentAnalysis(result.analysis),
    });
  });

  app.get<{ Params: { id: string } }>("/v1/projects/:id/analyses", async (request) => {
    const analyses = await service.listForProject(request.params.id);
    return { data: analyses.map(presentAnalysis) };
  });

  app.get<{ Params: { id: string } }>("/v1/analyses/:id", async (request) => {
    const details = await service.get(request.params.id);
    return {
      data: {
        analysis: presentAnalysis(details),
        files: details.files,
        components: details.components,
        requirements: details.requirements.map((requirement) => ({
          ...requirement,
          evidence: requirement.evidence,
        })),
        detectorRuns: details.detectorRuns,
        events: details.statusEvents,
      },
    };
  });

  app.get<{ Params: { id: string } }>("/v1/analyses/:id/requirements", async (request) => {
    const details = await service.get(request.params.id);
    return { data: details.requirements };
  });

  app.get<{ Params: { id: string } }>("/v1/analyses/:id/components", async (request) => {
    const details = await service.get(request.params.id);
    return { data: details.components };
  });
}

function presentAnalysis(analysis: {
  id: string;
  projectId: string;
  repositoryId: string;
  commitSha: string;
  scannerVersion: string;
  status: string;
  fileCount: number;
  analyzedFileCount: number;
  skippedFileCount: number;
  totalAnalyzedBytes: number;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: analysis.id,
    projectId: analysis.projectId,
    repositoryId: analysis.repositoryId,
    commitSha: analysis.commitSha,
    scannerVersion: analysis.scannerVersion,
    status: analysis.status,
    fileCount: analysis.fileCount,
    analyzedFileCount: analysis.analyzedFileCount,
    skippedFileCount: analysis.skippedFileCount,
    totalAnalyzedBytes: analysis.totalAnalyzedBytes,
    errorCode: analysis.errorCode,
    errorMessage: analysis.errorMessage,
    startedAt: analysis.startedAt?.toISOString() ?? null,
    completedAt: analysis.completedAt?.toISOString() ?? null,
    createdAt: analysis.createdAt.toISOString(),
  };
}
