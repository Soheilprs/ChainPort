import type { Metadata } from "next";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { RangeSelect } from "@/components/range-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { fetchPartnerJson } from "@/lib/network";

export const metadata: Metadata = { title: "Infrastructure gaps" };

interface Gap {
  key: string;
  kind: string;
  title: string;
  affectedProjects: number;
  affectedRepositories: number;
  explanation: string;
  status: string;
  priority: number;
}

export default async function GapsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range = "all" } = await searchParams;
  const rows = await fetchPartnerJson<Gap[]>(id, "/infrastructure-gaps", range);
  if (rows === null) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Suspense>
          <RangeSelect current={range} />
        </Suspense>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No infrastructure gaps">
          Hardcoded chain IDs and other project configuration issues are not treated as missing
          network infrastructure.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {rows.map((gap) => (
            <Card key={gap.key}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{gap.title}</CardTitle>
                <Badge tone={gap.kind === "NETWORK_GAP" ? "blocker" : "unknown"}>{gap.kind}</Badge>
              </div>
              <CardDescription>{gap.explanation}</CardDescription>
              <p className="mt-3 font-mono text-xs text-muted">
                {gap.key} · priority {gap.priority} = 3×blockerProjects + unknownProjects ·{" "}
                {gap.affectedProjects} projects / {gap.affectedRepositories} repositories
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
