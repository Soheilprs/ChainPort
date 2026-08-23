import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { JobDetail } from "@/components/job-detail";
import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { serverApiFetch } from "@/lib/server-api";

interface JobPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Job",
};

export default async function JobPage({
  params,
  searchParams,
}: JobPageProps & { searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const response = await serverApiFetch(`/v1/jobs/${id}`).catch(() => null);
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
  if (response.status === 401) {
    redirect(`/auth/sign-in?returnTo=/app/jobs/${id}`);
  }
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error("Unable to load job");
  }
  const body = (await response.json()) as {
    data: {
      job: Parameters<typeof JobDetail>[0]["initialJob"];
      project: Parameters<typeof JobDetail>[0]["initialProject"];
      repository: Parameters<typeof JobDetail>[0]["initialRepository"];
    };
  };

  return (
    <div>
      <SiteHeader current="/app/projects" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <PhaseBanner />
        <Link
          href="/app/projects"
          className="mt-3 inline-block text-sm text-muted hover:text-foreground"
        >
          ← Projects
        </Link>
        <div className="mt-4">
          <JobDetail
            initialJob={body.data.job}
            initialProject={body.data.project}
            initialRepository={body.data.repository}
            analyzeError={query.error}
          />
        </div>
      </main>
    </div>
  );
}
