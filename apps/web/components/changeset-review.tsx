"use client";

import { useEffect, useMemo, useState } from "react";

import { ValidateRevisionButton } from "@/components/validate-revision";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/lib/api";

export interface ChangeSetPayload {
  changeSet: {
    id: string;
    projectId: string;
    migrationPlanId: string;
    baseCommitSha: string;
    engineVersion: string;
    status: string;
    completeness: string | null;
    totalChanges: number;
    proposedCount: number;
    acceptedCount: number;
    rejectedCount: number;
    skippedCount: number;
    failedCount: number;
    errorCode: string | null;
    errorMessage: string | null;
  };
  plan: {
    id: string;
    projectId: string;
    sourceChainKey: string;
    targetChainKey: string;
    commitSha: string;
    safeActionCount: number;
  };
  originalRevision: {
    id: string;
    type: string;
    baseCommitSha: string;
    contentHash: string;
  };
  generatedRevision: {
    id: string;
    type: string;
    contentHash: string;
    completeness: string | null;
  } | null;
  changes: ChangeView[];
}

export interface ChangeView {
  id: string;
  filePath: string;
  changeType: string | null;
  status: string;
  skipReason: string | null;
  unifiedDiff: string | null;
  beforeExcerpt: string | null;
  afterExcerpt: string | null;
  sourceValue: string | null;
  targetValue: string | null;
  reason: string;
  patcher: { id: string; version: string | null } | null;
  automationLevel: string | null;
  riskLevel: string | null;
  title: string | null;
  category: string | null;
  evidence: Array<{ id: string; filePath: string; startLine: number; excerpt: string }>;
}

type Filter = "ALL" | "PROPOSED" | "ACCEPTED" | "REJECTED" | "SKIPPED";

const ACTIVE = ["QUEUED", "MATERIALIZING", "GENERATING", "FINALIZING"];

function statusTone(
  status: string,
): "pass" | "warning" | "blocker" | "unknown" | "accent" | "default" {
  if (status === "ACCEPTED" || status === "FINALIZED" || status === "COMPLETE") return "pass";
  if (status === "PROPOSED" || status === "READY_FOR_REVIEW" || status === "PARTIAL")
    return "warning";
  if (status === "REJECTED" || status === "FAILED" || status === "BLOCKED") return "blocker";
  if (status === "SKIPPED" || status === "ROLLED_BACK") return "unknown";
  if (ACTIVE.includes(status)) return "accent";
  return "default";
}

function statusLabel(status: string): string {
  return status.toLowerCase().replaceAll("_", " ");
}

export function ChangeSetReview({ initial }: { initial: ChangeSetPayload }) {
  const [payload, setPayload] = useState(initial);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [wrap, setWrap] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.changes.find((item) => item.status === "PROPOSED")?.id ??
      initial.changes[0]?.id ??
      null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const active = ACTIVE.includes(payload.changeSet.status);

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => {
      void fetch(`${API_URL}/v1/change-sets/${payload.changeSet.id}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((body: { data: ChangeSetPayload }) => setPayload(body.data));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [active, payload.changeSet.id]);

  const visible = useMemo(() => {
    if (filter === "ALL") {
      return payload.changes;
    }
    return payload.changes.filter((item) => item.status === filter);
  }, [filter, payload.changes]);

  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  const reviewable = payload.changeSet.status === "READY_FOR_REVIEW";
  const proposed = payload.changes.filter((item) => item.status === "PROPOSED").length;

  async function mutate(path: string) {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`${API_URL}${path}`, { method: "POST" });
      const body = (await response.json()) as {
        data?: ChangeSetPayload;
        message?: string;
        code?: string;
      };
      if (!response.ok || body.data === undefined) {
        setError(body.message ?? body.code ?? "Request failed");
        return;
      }
      setPayload(body.data);
    } catch {
      setError("API unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-5 border-b border-line bg-background/95 px-5 py-4 backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Safe ChangeSet</h1>
            <p className="mt-2 text-sm text-muted">
              {payload.plan.sourceChainKey} → {payload.plan.targetChainKey}
              <span className="mx-2 text-line-strong">·</span>
              SHA {payload.changeSet.baseCommitSha.slice(0, 12)}…
              <span className="mx-2 text-line-strong">·</span>
              engine v{payload.changeSet.engineVersion}
            </p>
          </div>
          <Badge tone={statusTone(payload.changeSet.status)}>
            {statusLabel(payload.changeSet.status)}
          </Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted">
          <span>
            {payload.changeSet.totalChanges} generated
            <span className="text-line-strong"> / {payload.plan.safeActionCount} safe actions</span>
          </span>
          <span className="text-pass">{payload.changeSet.acceptedCount} accepted</span>
          <span className="text-blocker">{payload.changeSet.rejectedCount} rejected</span>
          <span className="text-warning">{payload.changeSet.proposedCount} pending</span>
          <span>{payload.changeSet.skippedCount} skipped</span>
        </div>
      </div>

      {payload.changeSet.status === "FAILED" ? (
        <Card className="border-blocker/30">
          <CardTitle>Generation failed</CardTitle>
          <CardDescription>
            {payload.changeSet.errorCode} {payload.changeSet.errorMessage}
          </CardDescription>
        </Card>
      ) : null}

      {active ? (
        <p className="text-sm text-muted">
          Rematerializing the stored SHA and validating patch preconditions. The original GitHub
          repository is not modified.
        </p>
      ) : null}

      {payload.changeSet.status === "FINALIZED" ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Derived revision</CardTitle>
              <CardDescription>
                Completeness {payload.changeSet.completeness ?? "—"}. This is not overall migration
                readiness.
              </CardDescription>
              {payload.generatedRevision ? (
                <p className="mt-2 font-mono text-[11px] text-muted">
                  {payload.generatedRevision.contentHash.slice(0, 16)}… · original SHA unchanged
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {payload.generatedRevision ? (
                <ValidateRevisionButton
                  revisionId={payload.generatedRevision.id}
                  label="Validate generated revision"
                />
              ) : null}
              <ValidateRevisionButton
                revisionId={payload.originalRevision.id}
                label="Validate original baseline"
              />
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => void mutate(`/v1/change-sets/${payload.changeSet.id}/rollback`)}
              >
                Roll back to original
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {payload.changeSet.status === "ROLLED_BACK" ? (
        <p className="text-sm text-muted">
          Generated revision abandoned. The original SHA is selected again. Historical ChangeSet
          metadata is retained.
        </p>
      ) : null}

      {reviewable ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pending || proposed === 0}
            onClick={() => void mutate(`/v1/change-sets/${payload.changeSet.id}/accept-all`)}
          >
            Accept all safe patches
          </Button>
          <Button
            disabled={pending}
            onClick={() => void mutate(`/v1/change-sets/${payload.changeSet.id}/finalize`)}
          >
            Finalize accepted patches
          </Button>
          {proposed > 0 ? (
            <p className="self-center text-xs text-muted">{proposed} pending will be skipped</p>
          ) : null}
        </div>
      ) : null}

      {error !== null ? <p className="text-sm text-blocker">{error}</p> : null}

      <div className="flex flex-wrap gap-1">
        {(["ALL", "PROPOSED", "ACCEPTED", "REJECTED", "SKIPPED"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-md px-2.5 py-1 text-xs ${
              filter === item
                ? "bg-surface-hover text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {item === "PROPOSED" ? "Pending" : item.slice(0, 1) + item.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {payload.changes.length === 0 && !active ? (
        <Card>
          <CardTitle>No patches generated</CardTitle>
          <CardDescription>
            Either there were no SAFE AUTOMATIC actions or every candidate failed preconditions.
            That is a valid no-op ChangeSet.
          </CardDescription>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
          <div className="space-y-2">
            {visible.map((change) => (
              <button
                key={change.id}
                type="button"
                onClick={() => setSelectedId(change.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left ${
                  selected?.id === change.id
                    ? "border-line-strong bg-surface-hover"
                    : "border-line bg-surface/60 hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-mono text-[11px] text-muted-strong">
                    {change.filePath}
                  </p>
                  <Badge tone={statusTone(change.status)}>{statusLabel(change.status)}</Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted">{change.title ?? change.reason}</p>
              </button>
            ))}
          </div>
          {selected ? (
            <ChangeDetail
              change={selected}
              wrap={wrap}
              onWrap={setWrap}
              reviewable={reviewable}
              pending={pending}
              onAccept={() =>
                void mutate(`/v1/change-sets/${payload.changeSet.id}/changes/${selected.id}/accept`)
              }
              onReject={() =>
                void mutate(`/v1/change-sets/${payload.changeSet.id}/changes/${selected.id}/reject`)
              }
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ChangeDetail({
  change,
  wrap,
  onWrap,
  reviewable,
  pending,
  onAccept,
  onReject,
}: {
  change: ChangeView;
  wrap: boolean;
  onWrap: (value: boolean) => void;
  reviewable: boolean;
  pending: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">{change.filePath}</p>
          <p className="mt-1 text-xs text-muted">
            {change.category?.replaceAll("_", " ") ?? "change"}
            {change.patcher ? ` · ${change.patcher.id}@${change.patcher.version}` : ""}
            {change.riskLevel ? ` · risk ${change.riskLevel}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => onWrap(!wrap)}>
            {wrap ? "Scroll" : "Wrap"}
          </Button>
          {reviewable && change.status === "PROPOSED" ? (
            <>
              <Button variant="outline" size="sm" disabled={pending} onClick={onReject}>
                Reject
              </Button>
              <Button size="sm" disabled={pending} onClick={onAccept}>
                Accept
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Source</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-strong">
            {change.sourceValue ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Target</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-strong">
            {change.targetValue ?? "—"}
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-strong">{change.reason}</p>
      {change.skipReason ? (
        <p className="font-mono text-[11px] text-warning">{change.skipReason}</p>
      ) : null}

      {change.unifiedDiff ? (
        <DiffView diff={change.unifiedDiff} wrap={wrap} />
      ) : (
        <p className="text-sm text-muted">No diff. This action was not patched.</p>
      )}
    </div>
  );
}

interface DiffRow {
  kind: "hunk" | "meta" | "add" | "del" | "ctx";
  text: string;
  oldNo: number | null;
  newNo: number | null;
}

function parseDiff(diff: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("@@")) {
      const match = /@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
      oldNo = match?.[1] !== undefined ? Number(match[1]) : 0;
      newNo = match?.[2] !== undefined ? Number(match[2]) : 0;
      rows.push({ kind: "hunk", text: line, oldNo: null, newNo: null });
      continue;
    }
    if (line.startsWith("---") || line.startsWith("+++")) {
      rows.push({ kind: "meta", text: line, oldNo: null, newNo: null });
      continue;
    }
    if (line.startsWith("+")) {
      rows.push({ kind: "add", text: line.slice(1), oldNo: null, newNo });
      newNo += 1;
      continue;
    }
    if (line.startsWith("-")) {
      rows.push({ kind: "del", text: line.slice(1), oldNo, newNo: null });
      oldNo += 1;
      continue;
    }
    if (line.startsWith(" ")) {
      rows.push({ kind: "ctx", text: line.slice(1), oldNo, newNo });
      oldNo += 1;
      newNo += 1;
    }
  }
  return rows;
}

function DiffView({ diff, wrap }: { diff: string; wrap: boolean }) {
  const rows = parseDiff(diff);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#0c0c0e]">
      <pre
        className={`overflow-x-auto font-mono text-[12px] leading-6 ${wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"}`}
      >
        {rows.map((row, index) => (
          <div
            key={`${index}-${row.kind}`}
            className={`grid grid-cols-[3.25rem_3.25rem_minmax(0,1fr)] ${
              row.kind === "add"
                ? "bg-pass/10 text-pass"
                : row.kind === "del"
                  ? "bg-blocker/10 text-blocker"
                  : row.kind === "hunk"
                    ? "bg-surface text-muted"
                    : "text-muted-strong"
            }`}
          >
            <span className="select-none border-r border-line/60 px-2 text-right text-[10px] text-muted">
              {row.oldNo ?? ""}
            </span>
            <span className="select-none border-r border-line/60 px-2 text-right text-[10px] text-muted">
              {row.newNo ?? ""}
            </span>
            <span className="px-3">
              {row.kind === "add" ? "+" : row.kind === "del" ? "-" : row.kind === "hunk" ? "" : " "}
              {row.text}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}
