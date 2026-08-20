import { presentJob, presentProject, presentRepository } from "../presenters.js";
import type { ProjectsService } from "../projects-service.js";
import type { AccessControl } from "../access.js";
import type { ApiInstance } from "../types.js";

export function registerProjectRoutes(
  app: ApiInstance,
  service: ProjectsService,
  access?: AccessControl,
): void {
  app.post("/v1/projects", async (request, reply) => {
    const result = await service.create(request.body, request.actor);
    const partner = await service.resolvePartner(result.data.project);
    const statusCode = result.created ? 201 : 200;
    return reply.status(statusCode).send({
      data: {
        project: presentProject(result.data.project, partner),
        repository: presentRepository(result.data.repository),
        job: presentJob(result.data.job),
      },
    });
  });

  app.get("/v1/projects", async (request) => {
    const projects = await service.listProjects(request.actor);
    return { data: projects.map((project) => presentProject(project)) };
  });

  app.get<{ Params: { id: string } }>("/v1/projects/:id", async (request) => {
    if (access !== undefined) {
      await access.requireProject(request.actor, request.params.id);
    }
    const result = await service.getProject(request.params.id);
    const partner = await service.resolvePartner(result.project);
    return {
      data: {
        project: presentProject(result.project, partner),
        repository: presentRepository(result.repository),
        job: presentJob(result.job),
      },
    };
  });

  app.get<{ Params: { id: string } }>("/v1/projects/:id/jobs", async (request) => {
    if (access !== undefined) {
      await access.requireProject(request.actor, request.params.id);
    }
    const jobs = await service.listProjectJobs(request.params.id);
    return { data: jobs.map(presentJob) };
  });

  app.post<{ Params: { id: string } }>("/v1/projects/:id/archive", async (request) => {
    if (access !== undefined) {
      await access.requireProject(request.actor, request.params.id);
    }
    const project = await service.archive(request.params.id);
    return { data: presentProject(project) };
  });
}
