import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { API_URL } from "@/lib/api";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Project",
};

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const response = await fetch(`${API_URL}/v1/projects/${id}`, { cache: "no-store" }).catch(
    () => null,
  );
  if (response === null) {
    return (
      <div>
        <SiteHeader current="/app/projects" />
        <main className="mx-auto max-w-6xl px-5 py-10">
          <p className="text-sm text-muted">API unavailable.</p>
        </main>
      </div>
    );
  }
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error("Unable to load project");
  }
  const body = (await response.json()) as {
    data: { project: { id: string; name: string }; job: { id: string } };
  };

  return (
    <div>
      <SiteHeader current="/app/projects" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <PhaseBanner />
        <h1 className="mt-3 text-2xl font-medium tracking-tight">{body.data.project.name}</h1>
        <p className="mt-2 text-sm text-muted">Latest ingest job for this repository.</p>
        <Link
          href={`/app/jobs/${body.data.job.id}`}
          className="mt-6 inline-block text-sm text-accent"
        >
          Open job status →
        </Link>
      </main>
    </div>
  );
}
