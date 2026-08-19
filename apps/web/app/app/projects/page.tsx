import type { Metadata } from "next";

import { AppNav } from "@/components/app-nav";
import { EmptyState } from "@/components/empty-state";
import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Projects",
};

export default function ProjectsPage() {
  return (
    <div>
      <SiteHeader current="/app/projects" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <PhaseBanner />
        <h1 className="mt-3 text-2xl font-medium tracking-tight">Developer workspace</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Connect a repository, choose source and target chains, then inspect compatibility. Project
          ingest is not implemented yet.
        </p>
        <div className="mt-8">
          <AppNav current="/app/projects" />
          <EmptyState title="No projects">
            Repository connection, analysis jobs, and migration plans are reserved for later phases.
            The workspace is wired, but it will not invent applications or findings.
          </EmptyState>
        </div>
      </main>
    </div>
  );
}
