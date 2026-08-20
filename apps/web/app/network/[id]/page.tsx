import type { Metadata } from "next";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { MetricBar } from "@/components/metric-bar";
import { RangeSelect } from "@/components/range-select";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { fetchPartnerJson, formatCount, formatRate } from "@/lib/network";

export const metadata: Metadata = { title: "Network overview" };

interface OverviewPayload {
  partner: { displayName: string };
  kpis: {
    projectsAnalyzed: number;
    compatibilityReady: number;
    validated: number;
    testnetDeployed: number;
    overallConversion: number | null;
  };
  funnel: { stages: Array<{ stage: string; count: number }> };
  topBlockers: Array<{ key: string; title: string; affectedProjects: number }>;
  topGaps: Array<{
    key: string;
    title: string;
    kind: string;
    affectedProjects: number;
    explanation: string;
  }>;
  insights: string[];
}

export default async function NetworkOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range = "all" } = await searchParams;
  const data = await fetchPartnerJson<OverviewPayload>(id, "/overview", range);

  if (data === null) {
    return <p className="text-sm text-muted">Partner not found.</p>;
  }

  const started = data.funnel.stages.find((item) => item.stage === "PROJECT_STARTED")?.count ?? 0;
  const empty = started === 0;
  const maxFunnel = Math.max(...data.funnel.stages.map((item) => item.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Unique projects. Time filter uses project createdAt (UTC).
        </p>
        <Suspense>
          <RangeSelect current={range} />
        </Suspense>
      </div>

      {empty ? (
        <EmptyState title="No developer migration activity yet">
          Activity will appear here once developers analyze projects targeting{" "}
          {data.partner.displayName}. This view does not insert sample metrics.
        </EmptyState>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Projects analyzed" value={formatCount(data.kpis.projectsAnalyzed)} />
            <Kpi label="Compatibility-ready" value={formatCount(data.kpis.compatibilityReady)} />
            <Kpi label="Validated" value={formatCount(data.kpis.validated)} />
            <Kpi
              label="Testnet deployed"
              value={formatCount(data.kpis.testnetDeployed)}
              hint={formatRate(data.kpis.overallConversion)}
            />
          </section>

          <Card>
            <CardTitle>Migration funnel</CardTitle>
            <CardDescription>
              Each project is counted once at every stage it has reached.
            </CardDescription>
            <ul className="mt-4 space-y-3">
              {data.funnel.stages.map((stage) => (
                <li key={stage.stage}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{stage.stage.replaceAll("_", " ").toLowerCase()}</span>
                    <span className="font-mono">{stage.count}</span>
                  </div>
                  <MetricBar value={stage.count} max={maxFunnel} />
                </li>
              ))}
            </ul>
          </Card>

          <section className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardTitle>Top blockers</CardTitle>
              <ul className="mt-4 space-y-3 text-sm">
                {data.topBlockers.length === 0 ? (
                  <li className="text-muted">No BLOCKER / WARNING / UNKNOWN findings yet.</li>
                ) : (
                  data.topBlockers.map((item) => (
                    <li key={item.key} className="flex justify-between gap-3">
                      <span className="min-w-0 break-all">{item.title}</span>
                      <span className="font-mono text-muted">{item.affectedProjects}</span>
                    </li>
                  ))
                )}
              </ul>
            </Card>
            <Card>
              <CardTitle>Infrastructure gaps</CardTitle>
              <CardDescription>
                Configuration-only issues such as hardcoded chain IDs are not listed here.
              </CardDescription>
              <ul className="mt-4 space-y-3 text-sm">
                {data.topGaps.length === 0 ? (
                  <li className="text-muted">No network or unknown-data gaps in this range.</li>
                ) : (
                  data.topGaps.map((item) => (
                    <li key={item.key}>
                      <div className="flex justify-between gap-3">
                        <span className="min-w-0 break-all">{item.title}</span>
                        <span className="font-mono text-muted">{item.affectedProjects}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted">{item.explanation}</p>
                    </li>
                  ))
                )}
              </ul>
            </Card>
          </section>

          <Card>
            <CardTitle>Insights</CardTitle>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-strong">
              {data.insights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="py-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-medium">{value}</p>
      {hint !== undefined ? (
        <p className="mt-1 text-xs text-muted">{hint} started → deployed</p>
      ) : null}
    </Card>
  );
}
