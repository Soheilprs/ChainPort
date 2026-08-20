import type { Metadata } from "next";
import { Suspense } from "react";

import { AcquisitionSelect } from "@/components/acquisition-select";
import { MetricBar } from "@/components/metric-bar";
import { RangeSelect } from "@/components/range-select";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { fetchPartnerJson, formatRate } from "@/lib/network";

export const metadata: Metadata = { title: "Funnel" };

interface FunnelPayload {
  unit: string;
  acquisition: string;
  stages: Array<{ stage: string; count: number }>;
  conversions: Record<string, number | null>;
}

export default async function FunnelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; acquisition?: string }>;
}) {
  const { id } = await params;
  const { range = "all", acquisition = "all" } = await searchParams;
  const data = await fetchPartnerJson<FunnelPayload>(id, "/funnel", range, acquisition);
  if (data === null) return null;
  const max = Math.max(...data.stages.map((item) => item.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Suspense>
          <AcquisitionSelect current={acquisition} />
        </Suspense>
        <Suspense>
          <RangeSelect current={range} />
        </Suspense>
      </div>
      <Card>
        <CardTitle>Unique project funnel</CardTitle>
        <CardDescription>
          Aggregation unit: {data.unit}. Repeated runs do not double-count a project. Conversion
          denominators are the previous stage; zero denominators display N/A.
          {data.acquisition === "partner"
            ? " Filter: partner-portal referred projects only."
            : data.acquisition === "generic"
              ? " Filter: generic ChainPort traffic targeting this network."
              : " Filter: all projects targeting this network."}
        </CardDescription>
        <ul className="mt-5 space-y-3">
          {data.stages.map((stage) => (
            <li key={stage.stage}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-mono text-xs">{stage.stage}</span>
                <span>{stage.count}</span>
              </div>
              <MetricBar value={stage.count} max={max} />
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>Conversion</CardTitle>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          {Object.entries(data.conversions).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-3 border-b border-line pb-2">
              <dt className="text-muted">{key}</dt>
              <dd className="font-mono">{formatRate(value)}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
