import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnalyzeButton } from "@/components/analysis-panel";
import { EvaluateCompatibilityButton } from "@/components/evaluate-compatibility";
import { PartnerContextBanner } from "@/components/partner-context-banner";
import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { API_URL, type PartnerSummary } from "@/lib/api";

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
    data: {
      project: { id: string; name: string; partner?: PartnerSummary | null };
      job: { id: string; status: string; sourceChainKey: string; targetChainKey: string };
      repository: { resolvedCommitSha: string | null };
    };
  };
  const analysesResponse = await fetch(`${API_URL}/v1/projects/${id}/analyses`, {
    cache: "no-store",
  }).catch(() => null);
  const analysesBody =
    analysesResponse?.ok === true
      ? ((await analysesResponse.json()) as {
          data: Array<{ id: string; status: string; commitSha: string }>;
        })
      : { data: [] };
  const latestAnalysis = analysesBody.data[0];
  const runsResponse = await fetch(`${API_URL}/v1/projects/${id}/compatibility-runs`, {
    cache: "no-store",
  }).catch(() => null);
  const runsBody =
    runsResponse?.ok === true
      ? ((await runsResponse.json()) as {
          data: Array<{
            id: string;
            targetChainKey: string;
            score: number;
            readiness: string;
            createdAt: string;
          }>;
        })
      : { data: [] };

  return (
    <div>
      <SiteHeader current="/app/projects" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <PhaseBanner />
        <h1 className="mt-3 text-2xl font-medium tracking-tight">{body.data.project.name}</h1>
        <div className="mt-3">
          <PartnerContextBanner
            partner={body.data.project.partner}
            targetChainKey={body.data.job.targetChainKey}
          />
        </div>
        <p className="mt-2 text-sm text-muted">
          Latest ingest job for this repository. Analysis uses the stored SHA
          {body.data.repository.resolvedCommitSha
            ? ` ${body.data.repository.resolvedCommitSha.slice(0, 12)}…`
            : ""}
          .
        </p>
        <div className="mt-6 space-y-4">
          <Link href={`/app/jobs/${body.data.job.id}`} className="inline-block text-sm text-accent">
            Open ingest job →
          </Link>
          <AnalyzeButton
            projectId={body.data.project.id}
            ingestComplete={body.data.job.status === "COMPLETED"}
          />
          {latestAnalysis ? (
            <div className="rounded-xl border border-line bg-surface/80 p-5">
              <p className="text-sm text-muted">
                Latest analysis {latestAnalysis.status.toLowerCase()} at SHA{" "}
                <Link href={`/app/analyses/${latestAnalysis.id}`} className="font-mono text-accent">
                  {latestAnalysis.commitSha.slice(0, 12)}…
                </Link>
              </p>
              <div className="mt-4">
                <EvaluateCompatibilityButton
                  projectId={body.data.project.id}
                  analysisId={latestAnalysis.id}
                  analysisComplete={latestAnalysis.status === "COMPLETED"}
                />
              </div>
              <p className="mt-3 text-xs text-muted">
                Target {body.data.job.targetChainKey} from source {body.data.job.sourceChainKey}.
              </p>
            </div>
          ) : null}
          {runsBody.data.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-medium">Compatibility reports</h2>
              <ul className="space-y-2">
                {runsBody.data.map((run) => (
                  <li key={run.id}>
                    <Link
                      href={`/app/compatibility/${run.id}`}
                      className="flex items-center justify-between rounded-xl border border-line bg-surface/80 px-4 py-3 text-sm hover:bg-surface-hover"
                    >
                      <span>
                        {run.targetChainKey} · {run.readiness.toLowerCase().replaceAll("_", " ")}
                      </span>
                      <span className="font-mono text-muted">{run.score}/100</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
