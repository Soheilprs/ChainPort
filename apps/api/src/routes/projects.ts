import { presentJob, presentProject, presentRepository } from "../presenters.js";
import type { ProjectsService } from "../projects-service.js";
import type { ApiInstance } from "../types.js";

export function registerProjectRoutes(app: ApiInstance, service: ProjectsService): void {
  app.post("/v1/projects", async (request, reply) => {
    const result = await service.create(request.body);
    const statusCode = result.created ? 201 : 200;
    return reply.status(statusCode).send({
      data: {
        project: presentProject(result.data.project),
        repository: presentRepository(result.data.repository),
        job: presentJob(result.data.job),
      },
    });
  });

  app.get("/v1/projects", async () => {
    const projects = await service.listProjects();
    return { data: projects.map(presentProject) };
  });

  app.get<{ Params: { id: string } }>("/v1/projects/:id", async (request) => {
    const result = await service.getProject(request.params.id);
    return {
      data: {
        project: presentProject(result.project),
        repository: presentRepository(result.repository),
        job: presentJob(result.job),
      },
    };
  });

  app.get<{ Params: { id: string } }>("/v1/projects/:id/jobs", async (request) => {
    const jobs = await service.listProjectJobs(request.params.id);
    return { data: jobs.map(presentJob) };
  });
}
