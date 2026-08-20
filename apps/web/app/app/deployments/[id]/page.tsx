import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeploymentDetail, type DeploymentPayload } from "@/components/deployment-detail";
import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { API_URL } from "@/lib/api";

export const metadata: Metadata = {
  title: "Deployment",
};

export default async function DeploymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await fetch(`${API_URL}/v1/deployments/${id}`, { cache: "no-store" }).catch(
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
    throw new Error("Unable to load deployment");
  }
  const body = (await response.json()) as { data: DeploymentPayload };

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
          <DeploymentDetail initial={body.data} />
        </div>
      </main>
    </div>
  );
}
