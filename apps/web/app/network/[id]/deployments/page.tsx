import type { Metadata } from "next";
import { Suspense } from "react";

import { RangeSelect } from "@/components/range-select";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { fetchPartnerJson, formatCount } from "@/lib/network";

export const metadata: Metadata = { title: "Deployment analytics" };

interface Payload {
  prepared: number;
  confirmed: number;
  success: number;
  failed: number;
  reconciliationRequired: number;
  anvilSuccessExcluded: number;
}

export default async function DeploymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range = "all" } = await searchParams;
  const data = await fetchPartnerJson<Payload>(id, "/deployments", range);
  if (data === null) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Suspense>
          <RangeSelect current={range} />
        </Suspense>
      </div>
      <Card>
        <CardTitle>Partner testnet deployments</CardTitle>
        <CardDescription>
          PREPARED is not treated as deployed. Anvil DEVNET successes are excluded from partner
          totals by default ({data.anvilSuccessExcluded} excluded in this range).
        </CardDescription>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <Row label="Prepared" value={formatCount(data.prepared)} />
          <Row label="Confirmed / broadcast" value={formatCount(data.confirmed)} />
          <Row label="Success" value={formatCount(data.success)} />
          <Row label="Failed" value={formatCount(data.failed)} />
          <Row label="Reconciliation required" value={formatCount(data.reconciliationRequired)} />
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
