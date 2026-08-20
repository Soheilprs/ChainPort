import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchPartnerJson } from "@/lib/network";

export const metadata: Metadata = { title: "Network project" };

interface Detail {
  project: {
    name: string;
    githubOwner: string;
    githubRepo: string;
    sourceChainKey: string;
    targetChainKey: string;
    stage: string;
    compatibilityReadiness: string | null;
    validationOutcome: string | null;
    deploymentStatus: string | null;
  };
  timeline: Array<{ type: string; at: string }>;
  blockers: Array<{ key: string; title: string }>;
}

export default async function NetworkProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const data = await fetchPartnerJson<Detail>(id, `/projects/${projectId}`, "all");
  if (data === null) notFound();

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>
          {data.project.githubOwner}/{data.project.githubRepo}
        </CardTitle>
        <CardDescription>
          Source {data.project.sourceChainKey} → {data.project.targetChainKey}. This view does not
          include source code, evidence excerpts, or secrets.
        </CardDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>{data.project.stage.replaceAll("_", " ")}</Badge>
          <Badge tone="unknown">{data.project.compatibilityReadiness ?? "no compatibility"}</Badge>
          <Badge>{data.project.validationOutcome ?? "no validation"}</Badge>
          <Badge>{data.project.deploymentStatus ?? "no deployment"}</Badge>
        </div>
      </Card>
      <Card>
        <CardTitle>Journey</CardTitle>
        <ol className="mt-4 space-y-2 text-sm">
          {data.timeline.map((event) => (
            <li key={`${event.type}-${event.at}`} className="flex justify-between gap-3">
              <span>{event.type}</span>
              <span className="font-mono text-xs text-muted">{event.at}</span>
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <CardTitle>Top blockers</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {data.blockers.length === 0 ? (
            <li className="text-muted">No aggregated blockers for this project.</li>
          ) : (
            data.blockers.map((item) => <li key={item.key}>{item.title}</li>)
          )}
        </ul>
      </Card>
    </div>
  );
}
