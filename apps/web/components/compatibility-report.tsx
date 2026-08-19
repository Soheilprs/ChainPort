"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { BuildMigrationPlanButton } from "@/components/build-plan";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export interface CompatibilityReportPayload {
  run: {
    id: string;
    projectId: string;
    analysisId: string;
    commitSha: string;
    sourceChainKey: string;
    targetChainKey: string;
    scannerVersion: string;
    rulesetVersion: string;
    registryVersion: string;
    registrySnapshotHash: string;
    score: number;
    coverage: number;
    coverageConfidence: string;
    readiness: string;
    status: string;
    passCount: number;
    warningCount: number;
    blockerCount: number;
    unknownCount: number;
    errorCode: string | null;
    errorMessage: string | null;
    evaluatedAt: string | null;
  };
  snapshot: { hash: string; registryVersion: string; targetChainKey: string };
  categories: Array<{
    category: string;
    applicable: boolean;
    weight: number;
    score: number | null;
    passCount: number;
    warningCount: number;
    blockerCount: number;
    unknownCount: number;
  }>;
  findings: Array<{
    id: string;
    requirementId: string | null;
    ruleId: string;
    ruleVersion: string;
    category: string;
    status: string;
    title: string;
    summary: string;
    technicalReason: string;
    remediationType: string;
    sourceValue: string | null;
    targetValue: string | null;
    confidence: string;
    registryEvidence: Record<string, unknown>;
    requirement: {
      id: string;
      key: string;
      category: string;
      confidence: string;
      detector: string;
      evidence: Array<{
        id: string;
        filePath: string;
        startLine: number;
        excerpt: string;
      }>;
    } | null;
  }>;
}

type Filter = "ALL" | "BLOCKER" | "WARNING" | "UNKNOWN" | "PASS";

function toneForStatus(status: string): "pass" | "warning" | "blocker" | "unknown" | "default" {
  if (status === "PASS") return "pass";
  if (status === "WARNING") return "warning";
  if (status === "BLOCKER") return "blocker";
  if (status === "UNKNOWN") return "unknown";
  return "default";
}

function toneForReadiness(readiness: string): "pass" | "warning" | "blocker" | "unknown" {
  if (readiness === "READY") return "pass";
  if (readiness === "REVIEW_REQUIRED") return "warning";
  if (readiness === "BLOCKED") return "blocker";
  return "unknown";
}

function readinessLabel(readiness: string): string {
  switch (readiness) {
    case "READY":
      return "Migration ready";
    case "REVIEW_REQUIRED":
      return "Review required";
    case "BLOCKED":
      return "Not migration ready";
    case "INSUFFICIENT_DATA":
      return "Insufficient target data";
    default:
      return readiness;
  }
}

function truncateHash(value: string, size = 12): string {
  return value.length <= size ? value : `${value.slice(0, size)}…`;
}

function formatAddress(value: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return value;
  }
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function CompatibilityReport({ payload }: { payload: CompatibilityReportPayload }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [openId, setOpenId] = useState<string | null>(payload.findings[0]?.id ?? null);
  const blocked = payload.run.readiness === "BLOCKED" || payload.run.blockerCount > 0;
  const applicable = payload.categories.filter((item) => item.applicable);
  const visible = useMemo(() => {
    if (filter === "ALL") {
      return payload.findings;
    }
    return payload.findings.filter((item) => item.status === filter);
  }, [filter, payload.findings]);
  const selected = payload.findings.find((item) => item.id === openId) ?? visible[0];

  if (payload.run.status === "FAILED") {
    return (
      <Card className="border-blocker/30">
        <CardTitle>Compatibility evaluation failed</CardTitle>
        <CardDescription>
          {payload.run.errorCode} {payload.run.errorMessage}
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Target compatibility</h1>
          <p className="mt-2 text-sm text-muted">
            {payload.run.sourceChainKey} → {payload.run.targetChainKey}
            <span className="mx-2 text-line-strong">·</span>
            SHA {truncateHash(payload.run.commitSha)}
          </p>
        </div>
        <Badge tone={toneForReadiness(payload.run.readiness)}>
          {readinessLabel(payload.run.readiness)}
        </Badge>
      </div>
      {payload.run.status === "COMPLETED" ? (
        <BuildMigrationPlanButton compatibilityRunId={payload.run.id} compatibilityComplete />
      ) : null}

      {blocked ? (
        <div className="rounded-xl border border-blocker/30 bg-blocker/5 px-4 py-3 text-sm text-blocker">
          Not migration ready — {payload.run.blockerCount} critical blocker
          {payload.run.blockerCount === 1 ? "" : "s"}. Score does not override blockers.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Compatibility score</p>
          <p className="mt-3 font-mono text-4xl tracking-tight">
            {payload.run.score}
            <span className="ml-1 text-base text-muted">/100</span>
          </p>
          <CardDescription>
            Known findings only. UNKNOWN is excluded from the numerator.
          </CardDescription>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Target data coverage</p>
          <p className="mt-3 font-mono text-4xl tracking-tight">
            {payload.run.coverage}
            <span className="ml-1 text-base text-muted">%</span>
          </p>
          <CardDescription>Registry confidence {payload.run.coverageConfidence}.</CardDescription>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Findings</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Count label="Blockers" value={payload.run.blockerCount} className="text-blocker" />
            <Count label="Warnings" value={payload.run.warningCount} className="text-warning" />
            <Count label="Unknown" value={payload.run.unknownCount} className="text-unknown" />
            <Count label="Pass" value={payload.run.passCount} className="text-pass" />
          </div>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-medium">Category breakdown</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {applicable.length === 0 ? (
            <Card>
              <CardTitle>No evaluated requirements</CardTitle>
              <CardDescription>
                Nothing in this analysis required target comparison.
              </CardDescription>
            </Card>
          ) : (
            applicable.map((category) => (
              <Card key={category.category} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="capitalize">
                    {category.category.toLowerCase().replaceAll("_", " ")}
                  </CardTitle>
                  <span className="font-mono text-xs text-muted">{category.weight}%</span>
                </div>
                <p className="mt-2 font-mono text-2xl">
                  {category.score === null ? "—" : Math.round(category.score * 100)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {category.blockerCount} blk · {category.warningCount} warn ·{" "}
                  {category.unknownCount} unk
                </p>
              </Card>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line">
        {(
          [
            ["ALL", "All"],
            ["BLOCKER", "Blockers"],
            ["WARNING", "Warnings"],
            ["UNKNOWN", "Unknown"],
            ["PASS", "Pass"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`-mb-px border-b px-3 py-2 text-sm ${
              filter === id ? "border-foreground text-foreground" : "border-transparent text-muted"
            }`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardTitle>No findings in this filter</CardTitle>
          <CardDescription>Choose another severity to inspect the report.</CardDescription>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-2">
            {visible.map((finding) => (
              <button
                key={finding.id}
                type="button"
                onClick={() => setOpenId(finding.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  selected?.id === finding.id
                    ? "border-line-strong bg-surface-hover"
                    : "border-line bg-surface/60 hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{finding.title}</p>
                  <Badge tone={toneForStatus(finding.status)}>{finding.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {finding.category} · {finding.ruleId} v{finding.ruleVersion}
                </p>
              </button>
            ))}
          </div>
          {selected ? (
            <FindingDetail finding={selected} analysisId={payload.run.analysisId} />
          ) : null}
        </div>
      )}

      <p className="font-mono text-[11px] leading-5 text-muted">
        ruleset v{payload.run.rulesetVersion} · registry v{payload.run.registryVersion} · snapshot{" "}
        <span title={payload.run.registrySnapshotHash}>
          {truncateHash(payload.run.registrySnapshotHash, 16)}
        </span>
      </p>
    </div>
  );
}

function Count({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={`font-mono text-lg ${className}`}>{value}</p>
    </div>
  );
}

function FindingDetail({
  finding,
  analysisId,
}: {
  finding: CompatibilityReportPayload["findings"][number];
  analysisId: string;
}) {
  return (
    <Card className="h-fit">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={toneForStatus(finding.status)}>{finding.status}</Badge>
        <Badge>{finding.category}</Badge>
        <Badge>{finding.remediationType.replaceAll("_", " ")}</Badge>
      </div>
      <CardTitle className="mt-4">{finding.title}</CardTitle>
      <CardDescription>{finding.summary}</CardDescription>
      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Current" value={finding.sourceValue} />
        <Row label="Target" value={finding.targetValue} />
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">Why</dt>
          <dd className="mt-1 text-muted-strong">{finding.technicalReason}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">Rule</dt>
          <dd className="mt-1 font-mono text-xs text-muted-strong">
            {finding.ruleId}@{finding.ruleVersion} · confidence {finding.confidence}
          </dd>
        </div>
      </dl>
      {finding.requirement && finding.requirement.evidence.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Source evidence</p>
          <ul className="mt-2 space-y-2">
            {finding.requirement.evidence.slice(0, 4).map((entry) => (
              <li key={entry.id} className="rounded-lg border border-line bg-background/50 p-3">
                <p className="font-mono text-[11px] text-muted">
                  {entry.filePath}:{entry.startLine}
                </p>
                <p className="mt-1 overflow-x-auto font-mono text-xs text-muted-strong">
                  {entry.excerpt}
                </p>
              </li>
            ))}
          </ul>
          <Link
            href={`/app/analyses/${analysisId}`}
            className="mt-3 inline-block text-xs text-accent"
          >
            Open repository analysis →
          </Link>
        </div>
      ) : (
        <Link
          href={`/app/analyses/${analysisId}`}
          className="mt-4 inline-block text-xs text-accent"
        >
          Open repository analysis →
        </Link>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (value === null || value.length === 0) {
    return null;
  }
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-1 break-all font-mono text-xs text-muted-strong" title={value}>
        {formatAddress(value)}
      </dd>
    </div>
  );
}
