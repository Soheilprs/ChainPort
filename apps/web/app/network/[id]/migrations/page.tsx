import type { Metadata } from "next";
import { Suspense } from "react";

import { RangeSelect } from "@/components/range-select";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { fetchPartnerJson, formatCount, formatRate } from "@/lib/network";

export const metadata: Metadata = { title: "Migration analytics" };

interface Payload {
  plans: number;
  actions: number;
  averageActions: number | null;
  safeAutomatic: number;
  reviewRequired: number;
  manual: number;
  blocked: number;
  unknown: number;
  safeAutomaticShare: number | null;
  projectsAllSafe: number;
  projectsNeedingReview: number;
  projectsBlocked: number;
  changeSets: number;
  proposed: number;
  accepted: number;
  rejected: number;
  skipped: number;
  acceptanceRate: number | null;
  finalizedComplete: number;
  finalizedPartial: number;
}

export default async function MigrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range = "all" } = await searchParams;
  const data = await fetchPartnerJson<Payload>(id, "/migrations", range);
  if (data === null) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Suspense>
          <RangeSelect current={range} />
        </Suspense>
      </div>
      <Card>
        <CardTitle>Migration actions</CardTitle>
        <CardDescription>
          Skipped ChangeSet patches are not treated as accepted. Safe-automatic share uses action
          counts, not projects.
        </CardDescription>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <Row label="Plans" value={formatCount(data.plans)} />
          <Row label="Average actions" value={data.averageActions?.toFixed(1) ?? "N/A"} />
          <Row label="SAFE_AUTOMATIC" value={formatCount(data.safeAutomatic)} />
          <Row label="REVIEW_REQUIRED" value={formatCount(data.reviewRequired)} />
          <Row label="MANUAL" value={formatCount(data.manual)} />
          <Row label="BLOCKED" value={formatCount(data.blocked)} />
          <Row label="UNKNOWN" value={formatCount(data.unknown)} />
          <Row label="Safe-automatic share" value={formatRate(data.safeAutomaticShare)} />
          <Row label="All-safe projects" value={formatCount(data.projectsAllSafe)} />
          <Row label="Need review" value={formatCount(data.projectsNeedingReview)} />
          <Row label="Blocked projects" value={formatCount(data.projectsBlocked)} />
        </dl>
      </Card>
      <Card>
        <CardTitle>ChangeSets</CardTitle>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <Row label="Generated" value={formatCount(data.changeSets)} />
          <Row label="Proposed" value={formatCount(data.proposed)} />
          <Row label="Accepted" value={formatCount(data.accepted)} />
          <Row label="Rejected" value={formatCount(data.rejected)} />
          <Row label="Skipped" value={formatCount(data.skipped)} />
          <Row label="Acceptance rate" value={formatRate(data.acceptanceRate)} />
          <Row label="Finalized COMPLETE" value={formatCount(data.finalizedComplete)} />
          <Row label="Finalized PARTIAL" value={formatCount(data.finalizedPartial)} />
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
