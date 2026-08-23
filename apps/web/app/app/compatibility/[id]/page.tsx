import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  CompatibilityReport,
  type CompatibilityReportPayload,
} from "@/components/compatibility-report";
import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { serverApiFetch } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Compatibility",
};

export default async function CompatibilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    filter?: string;
    finding?: string;
    error?: string;
    category?: string;
    q?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const response = await serverApiFetch(`/v1/compatibility-runs/${id}`).catch(() => null);
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
    redirect(`/auth/sign-in?returnTo=/app/compatibility/${id}`);
  }
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error("Unable to load compatibility report");
  }
  const body = (await response.json()) as { data: CompatibilityReportPayload };

  return (
    <div>
      <SiteHeader current="/app/projects" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <PhaseBanner />
        <Link
          href={`/app/projects/${body.data.run.projectId}`}
          className="mt-3 inline-block text-sm text-muted hover:text-foreground"
        >
          ← Project
        </Link>
        <div className="mt-4">
          <CompatibilityReport
            payload={body.data}
            filter={query.filter}
            findingId={query.finding}
            planError={query.error}
            category={query.category}
            query={query.q}
          />
        </div>
      </main>
    </div>
  );
}
