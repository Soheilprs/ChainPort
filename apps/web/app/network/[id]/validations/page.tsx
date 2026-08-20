import type { Metadata } from "next";
import { Suspense } from "react";

import { RangeSelect } from "@/components/range-select";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { fetchPartnerJson, formatCount, formatRate } from "@/lib/network";

export const metadata: Metadata = { title: "Validation analytics" };

interface Payload {
  attempts: number;
  outcomes: Record<string, number>;
  repositoryFailures: number;
  infraFailures: number;
  failureReasons: Array<{ code: string; count: number }>;
  regression: Record<string, number>;
  noRegressionRate: number | null;
}

export default async function ValidationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range = "all" } = await searchParams;
  const data = await fetchPartnerJson<Payload>(id, "/validations", range);
  if (data === null) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Suspense>
          <RangeSelect current={range} />
        </Suspense>
      </div>
      <Card>
        <CardTitle>Validation outcomes</CardTitle>
        <CardDescription>
          INFRA_FAILURE is a ChainPort platform failure and is counted separately from repository
          build/test failures.
        </CardDescription>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <Row label="Attempts" value={formatCount(data.attempts)} />
          {Object.entries(data.outcomes).map(([key, value]) => (
            <Row key={key} label={key} value={formatCount(value)} />
          ))}
          <Row label="Repository failures" value={formatCount(data.repositoryFailures)} />
          <Row label="ChainPort infra failures" value={formatCount(data.infraFailures)} />
        </dl>
      </Card>
      <Card>
        <CardTitle>Failure reasons</CardTitle>
        <ul className="mt-3 space-y-2 font-mono text-sm">
          {data.failureReasons.length === 0 ? (
            <li className="text-muted">None</li>
          ) : (
            data.failureReasons.map((item) => (
              <li key={item.code} className="flex justify-between">
                <span>{item.code}</span>
                <span>{item.count}</span>
              </li>
            ))
          )}
        </ul>
      </Card>
      <Card>
        <CardTitle>Original vs generated</CardTitle>
        <CardDescription>
          No-regression rate uses only comparable baselines. Percentages are omitted when the
          denominator is zero.
        </CardDescription>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          {Object.entries(data.regression).map(([key, value]) => (
            <Row key={key} label={key} value={formatCount(value)} />
          ))}
          <Row label="No-regression rate" value={formatRate(data.noRegressionRate)} />
        </dl>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
