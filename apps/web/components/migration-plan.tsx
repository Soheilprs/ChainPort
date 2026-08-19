"use client";

import { useMemo, useState } from "react";

import { GenerateSafeFixesButton } from "@/components/generate-safe-fixes";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export interface MigrationPlanPayload {
  plan: {
    id: string;
    projectId: string;
    compatibilityRunId: string;
    commitSha: string;
    sourceChainKey: string;
    targetChainKey: string;
    registrySnapshotHash: string;
    migrationRulesetVersion: string;
    status: string;
    outcome: string;
    migrationReady: boolean;
    totalActions: number;
    safeActionCount: number;
    reviewActionCount: number;
    manualActionCount: number;
    blockedActionCount: number;
    unknownActionCount: number;
    autoFixablePercent: number;
    verificationRequired: boolean;
    errorCode: string | null;
    errorMessage: string | null;
  };
  stages: Array<{
    stage: string;
    actions: MigrationActionView[];
  }>;
  actions: MigrationActionView[];
}

interface MigrationActionView {
  id: string;
  ruleId: string;
  ruleVersion: string;
  title: string;
  description: string;
  technicalReason: string;
  category: string;
  stage: string;
  automationLevel: string;
  riskLevel: string;
  actionStatus: string;
  sourceValue: string | null;
  targetValue: string | null;
  evidence: Array<{
    id: string;
    filePath: string;
    startLine: number;
    excerpt: string;
  }>;
}

function toneForAutomation(level: string): "pass" | "warning" | "blocker" | "unknown" | "default" {
  if (level === "SAFE_AUTOMATIC") return "pass";
  if (level === "REVIEW_REQUIRED" || level === "MANUAL") return "warning";
  if (level === "BLOCKED") return "blocker";
  return "unknown";
}

function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case "READY_TO_APPLY":
      return "Ready to apply later";
    case "REVIEW_REQUIRED":
      return "Review required";
    case "BLOCKED":
      return "Blocked";
    case "NEEDS_VERIFICATION":
      return "Needs verification";
    default:
      return outcome;
  }
}

function stageLabel(stage: string): string {
  return stage.toLowerCase().replaceAll("_", " ");
}

function formatValue(value: string): string {
  if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
  }
  return value;
}

export function MigrationPlanView({ payload }: { payload: MigrationPlanPayload }) {
  const [openId, setOpenId] = useState<string | null>(payload.actions[0]?.id ?? null);
  const selected = payload.actions.find((item) => item.id === openId) ?? payload.actions[0];
  const blocked = payload.plan.blockedActionCount > 0;

  const summary = useMemo(
    () => [
      ["Safe automatic", payload.plan.safeActionCount, "text-pass"],
      ["Review required", payload.plan.reviewActionCount, "text-warning"],
      ["Manual", payload.plan.manualActionCount, "text-warning"],
      ["Blocked", payload.plan.blockedActionCount, "text-blocker"],
      ["Needs verification", payload.plan.unknownActionCount, "text-unknown"],
    ],
    [payload.plan],
  );

  if (payload.plan.status === "FAILED") {
    return (
      <Card className="border-blocker/30">
        <CardTitle>Migration planning failed</CardTitle>
        <CardDescription>
          {payload.plan.errorCode} {payload.plan.errorMessage}
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Migration plan</h1>
          <p className="mt-2 text-sm text-muted">
            {payload.plan.sourceChainKey} → {payload.plan.targetChainKey}
            <span className="mx-2 text-line-strong">·</span>
            SHA {payload.plan.commitSha.slice(0, 12)}…
          </p>
        </div>
        <Badge
          tone={
            payload.plan.outcome === "READY_TO_APPLY"
              ? "pass"
              : payload.plan.outcome === "BLOCKED"
                ? "blocker"
                : payload.plan.outcome === "REVIEW_REQUIRED"
                  ? "warning"
                  : "unknown"
          }
        >
          {outcomeLabel(payload.plan.outcome)}
        </Badge>
      </div>

      {blocked ? (
        <div className="rounded-xl border border-blocker/30 bg-blocker/5 px-4 py-3 text-sm text-blocker">
          Migration cannot proceed unchanged — {payload.plan.blockedActionCount} blocked action
          {payload.plan.blockedActionCount === 1 ? "" : "s"}. Safe-action counts do not override
          this.
        </div>
      ) : null}

      {payload.plan.verificationRequired && !blocked ? (
        <div className="rounded-xl border border-unknown/30 bg-unknown/5 px-4 py-3 text-sm text-unknown">
          Not fully plannable — {payload.plan.unknownActionCount} unresolved target capability
          {payload.plan.unknownActionCount === 1 ? "" : "ies"}.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Actions</p>
          <p className="mt-3 font-mono text-4xl tracking-tight">{payload.plan.totalActions}</p>
          <CardDescription>PASS findings are omitted. Nothing has been applied.</CardDescription>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Auto-fixable later</p>
          <p className="mt-3 font-mono text-4xl tracking-tight">
            {payload.plan.autoFixablePercent}
            <span className="ml-1 text-base text-muted">%</span>
          </p>
          <CardDescription>
            {payload.plan.safeActionCount} safe automatic of non-blocked, non-unknown actions.
          </CardDescription>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Breakdown</p>
          <div className="mt-3 space-y-1 text-sm">
            {summary.map(([label, value, className]) => (
              <div key={String(label)} className="flex justify-between">
                <span className="text-muted">{label}</span>
                <span className={`font-mono ${className}`}>{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {payload.plan.totalActions === 0 ? (
        <Card>
          <CardTitle>No migration actions</CardTitle>
          <CardDescription>
            Compatibility findings were PASS or non-actionable. Safe auto-fix will generate a no-op
            ChangeSet.
          </CardDescription>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="space-y-6">
            {payload.stages.map((group) => (
              <section key={group.stage}>
                <h2 className="text-sm font-medium capitalize">{stageLabel(group.stage)}</h2>
                <div className="mt-2 space-y-2">
                  {group.actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => setOpenId(action.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left ${
                        selected?.id === action.id
                          ? "border-line-strong bg-surface-hover"
                          : "border-line bg-surface/60 hover:bg-surface-hover"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">{action.title}</p>
                        <Badge tone={toneForAutomation(action.automationLevel)}>
                          {action.automationLevel.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {action.category.replaceAll("_", " ")} · risk {action.riskLevel}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {selected ? <ActionDetail action={selected} /> : null}
        </div>
      )}

      {payload.plan.status === "COMPLETED" ? (
        <GenerateSafeFixesButton planId={payload.plan.id} planComplete />
      ) : null}

      <p className="font-mono text-[11px] leading-5 text-muted">
        migration ruleset v{payload.plan.migrationRulesetVersion} · snapshot{" "}
        {payload.plan.registrySnapshotHash.slice(0, 16)}… · only SAFE AUTOMATIC actions are patched.
      </p>
    </div>
  );
}

function ActionDetail({ action }: { action: MigrationActionView }) {
  return (
    <Card className="h-fit">
      <div className="flex flex-wrap gap-2">
        <Badge tone={toneForAutomation(action.automationLevel)}>
          {action.automationLevel.replaceAll("_", " ")}
        </Badge>
        <Badge>{action.riskLevel}</Badge>
        <Badge>{action.actionStatus}</Badge>
      </div>
      <CardTitle className="mt-4">{action.title}</CardTitle>
      <CardDescription>{action.description}</CardDescription>
      <div className="mt-4 grid gap-3 text-sm">
        {action.sourceValue ? (
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Current</p>
            <p className="mt-1 break-all font-mono text-xs" title={action.sourceValue}>
              {formatValue(action.sourceValue)}
            </p>
          </div>
        ) : null}
        {action.targetValue ? (
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Target</p>
            <p className="mt-1 break-all font-mono text-xs" title={action.targetValue}>
              {formatValue(action.targetValue)}
            </p>
          </div>
        ) : null}
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Why</p>
          <p className="mt-1 text-muted-strong">{action.technicalReason}</p>
        </div>
        <p className="font-mono text-[11px] text-muted">
          {action.ruleId}@{action.ruleVersion}
        </p>
      </div>
      {action.evidence.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {action.evidence.slice(0, 6).map((entry) => (
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
      ) : null}
      {action.automationLevel === "SAFE_AUTOMATIC" ? (
        <p className="mt-4 text-xs text-muted">
          Eligible for a safe patch after Generate safe fixes. Review is still required.
        </p>
      ) : (
        <p className="mt-4 text-xs text-muted">Not eligible for automatic patching.</p>
      )}
    </Card>
  );
}
