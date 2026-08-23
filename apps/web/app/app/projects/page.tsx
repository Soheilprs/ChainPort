import type { Metadata } from "next";
import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { EmptyState } from "@/components/empty-state";
import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import type { JobSummary, ProjectSummary } from "@/lib/api";
import { serverApiFetch } from "@/lib/server-api";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Projects",
};

export default async function ProjectsPage() {
  let projects: ProjectSummary[] = [];
  const jobsByProject = new Map<string, JobSummary>();
  let loadError: string | null = null;
  const response = await serverApiFetch("/v1/projects").catch(() => null);
  if (response === null) {
    loadError = "API unavailable";
  } else if (response.status === 401) {
    redirect("/auth/sign-in?returnTo=/app/projects");
  } else if (!response.ok) {
    loadError = "API unavailable";
  } else {
    const body = (await response.json()) as { data?: ProjectSummary[] };
    projects = body.data ?? [];
    await Promise.all(
      projects.map(async (project) => {
        const jobsResponse = await serverApiFetch(`/v1/projects/${project.id}/jobs`);
        if (!jobsResponse.ok) {
          return;
        }
        const jobsBody = (await jobsResponse.json()) as { data?: JobSummary[] };
        const latest = jobsBody.data?.[0];
        if (latest !== undefined) {
          jobsByProject.set(project.id, latest);
        }
      }),
    );
  }

  return (
    <div>
      <SiteHeader current="/app/projects" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <PhaseBanner />
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Developer workspace</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Connect a public GitHub repository. ChainPort will clone it safely and record the
              exact commit SHA. Scanning is not part of this phase.
            </p>
          </div>
          <Link
            href="/app/projects/new"
            className="inline-flex h-9 items-center rounded-md bg-paper px-3.5 text-sm font-medium text-ink hover:bg-white"
          >
            New migration
          </Link>
        </div>
        <div className="mt-8">
          <AppNav current="/app/projects" />
          {loadError !== null ? (
            <EmptyState title="API unavailable">
              The project list could not be loaded. Start the API and refresh.
            </EmptyState>
          ) : projects.length === 0 ? (
            <EmptyState title="No projects">
              Start a migration to ingest a public GitHub repository. Findings and compatibility
              results are not generated yet.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Repository</th>
                    <th className="px-4 py-3 font-medium">Ingest</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => {
                    const job = jobsByProject.get(project.id);
                    return (
                      <tr key={project.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3">
                          <Link href={`/app/projects/${project.id}`} className="hover:text-accent">
                            {project.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {job === undefined ? (
                            "—"
                          ) : (
                            <Link href={`/app/jobs/${job.id}`} className="hover:text-foreground">
                              {job.status}
                              {job.repoSha !== null ? ` · ${job.repoSha.slice(0, 10)}` : ""}
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted">{project.createdAt.slice(0, 10)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
