"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PrepareDeploymentButton } from "@/components/prepare-deployment";
import { API_URL } from "@/lib/api";

export interface ValidationPayload {
  run: {
    id: string;
    projectId: string;
    repositoryRevisionId: string;
    revisionType: string;
    baseCommitSha: string;
    revisionContentHash: string;
    framework: string | null;
    status: string;
    outcome: string | null;
    sandboxImage: string | null;
    sandboxImageDigest: string | null;
    runtimeVersion: string | null;
    buildStatus: string | null;
    testStatus: string | null;
    countsAvailable: boolean;
    testTotal: number | null;
    testPassed: number | null;
    testFailed: number | null;
    testSkipped: number | null;
    durationMs: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    networkPolicy: string;
  };
  revision: { id: string; type: string; baseCommitSha: string; contentHash: string };
  steps: Array<{
    id: string;
    name: string;
    status: string;
    exitCode: number | null;
    durationMs: number | null;
    logTruncated: boolean;
    errorCode: string | null;
  }>;
  tests: Array<{ testName: string; status: string; failureSummary: string | null }>;
}

interface ComparisonPayload {
  original: ValidationPayload["run"] | null;
  generated: ValidationPayload["run"] | null;
  regressionStatus: string;
  summary: string;
}

const ACTIVE = ["QUEUED", "PREPARING", "INSTALLING", "BUILDING", "TESTING"];

function tone(
  value: string | null,
): "pass" | "warning" | "blocker" | "unknown" | "accent" | "default" {
  if (value === "PASSED" || value === "COMPLETED" || value === "NO_REGRESSION") return "pass";
  if (value === "PARTIAL" || value === "UNSUPPORTED" || value === "INCONCLUSIVE") return "warning";
  if (value === "FAILED" || value === "REGRESSION_DETECTED" || value === "TIMED_OUT")
    return "blocker";
  if (ACTIVE.includes(value ?? "")) return "accent";
  return "default";
}

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, "g");
const CONTROLS = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11)}${String.fromCharCode(12)}${String.fromCharCode(14)}-${String.fromCharCode(31)}]`,
  "g",
);

function stripLog(text: string): string {
  return text.replace(ANSI, "").replace(CONTROLS, "");
}

export function ValidationDetail({ initial }: { initial: ValidationPayload }) {
  const [payload, setPayload] = useState(initial);
  const [logs, setLogs] = useState<
    Array<{ name: string; truncated: boolean; text: string | null }>
  >([]);
  const [wrap, setWrap] = useState(false);
  const [open, setOpen] = useState<string | null>("TEST");
  const [comparison, setComparison] = useState<ComparisonPayload | null>(null);
  const active = ACTIVE.includes(payload.run.status);

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => {
      void fetch(`${API_URL}/v1/validations/${payload.run.id}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((body: { data: ValidationPayload }) => setPayload(body.data));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [active, payload.run.id]);

  useEffect(() => {
    void fetch(`${API_URL}/v1/validations/${payload.run.id}/logs`, { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { data: Array<{ name: string; truncated: boolean; text: string | null }> }) =>
        setLogs(body.data),
      );
  }, [payload.run.id, payload.run.status]);

  async function loadComparison() {
    const response = await fetch(
      `${API_URL}/v1/revisions/${payload.run.repositoryRevisionId}/validation-comparison`,
      { cache: "no-store" },
    );
    const body = (await response.json()) as { data: ComparisonPayload };
    setComparison(body.data);
  }

  const testsLabel = payload.run.countsAvailable
    ? `${payload.run.testPassed ?? 0} / ${payload.run.testTotal ?? 0} passed`
    : "counts unavailable";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Validation</h1>
          <p className="mt-2 text-sm text-muted">
            {payload.run.revisionType.toLowerCase()} revision
            <span className="mx-2 text-line-strong">·</span>
            SHA {payload.run.baseCommitSha.slice(0, 12)}…
            <span className="mx-2 text-line-strong">·</span>
            {payload.run.revisionContentHash.slice(0, 12)}…
          </p>
        </div>
        <Badge tone={tone(payload.run.outcome ?? payload.run.status)}>
          {(payload.run.outcome ?? payload.run.status).replaceAll("_", " ")}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Build</p>
          <p className="mt-3 text-lg">{payload.run.buildStatus ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Tests</p>
          <p className="mt-3 text-lg">{testsLabel}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Duration</p>
          <p className="mt-3 font-mono text-lg">
            {payload.run.durationMs === null
              ? "—"
              : `${(payload.run.durationMs / 1000).toFixed(1)}s`}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Runtime</p>
          <p className="mt-3 text-sm">
            {payload.run.runtimeVersion ?? payload.run.framework ?? "—"}
          </p>
          <CardDescription>{payload.run.networkPolicy}</CardDescription>
        </Card>
      </div>

      {payload.run.errorMessage ? (
        <Card className="border-blocker/30">
          <CardTitle>{payload.run.errorCode}</CardTitle>
          <CardDescription>{payload.run.errorMessage}</CardDescription>
        </Card>
      ) : null}

      {payload.run.outcome === "PASSED" ? (
        <Card>
          <CardTitle>Target testnet deployment</CardTitle>
          <CardDescription>
            This revision passed isolated validation. Prepare a two-stage deployment: simulate
            first, then explicitly confirm broadcast to a testnet. Mainnet is refused.
          </CardDescription>
          <div className="mt-4">
            <PrepareDeploymentButton revisionId={payload.run.repositoryRevisionId} />
          </div>
        </Card>
      ) : null}

      <ol className="space-y-2">
        {payload.steps.map((step) => (
          <li key={step.id} className="rounded-xl border border-line px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">{step.name.toLowerCase()}</p>
              <Badge tone={tone(step.status)}>{step.status.toLowerCase()}</Badge>
            </div>
          </li>
        ))}
      </ol>

      {payload.tests.filter((item) => item.status === "failed").length > 0 ? (
        <Card>
          <CardTitle>Failed tests</CardTitle>
          <ul className="mt-3 space-y-2 font-mono text-xs">
            {payload.tests
              .filter((item) => item.status === "failed")
              .map((item) => (
                <li key={item.testName}>{item.testName}</li>
              ))}
          </ul>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setWrap(!wrap)}>
          {wrap ? "Scroll logs" : "Wrap logs"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void loadComparison()}>
          Compare with original revision
        </Button>
      </div>

      {comparison ? (
        <Card>
          <CardTitle>Original vs generated</CardTitle>
          <CardDescription>{comparison.summary}</CardDescription>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted">Original</p>
              <p>{comparison.original?.outcome ?? "not run"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted">Generated</p>
              <p>{comparison.generated?.outcome ?? "not run"}</p>
            </div>
          </div>
          <Badge className="mt-3" tone={tone(comparison.regressionStatus)}>
            {comparison.regressionStatus.replaceAll("_", " ")}
          </Badge>
        </Card>
      ) : null}

      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.name} className="overflow-hidden rounded-xl border border-line">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm"
              onClick={() => setOpen(open === log.name ? null : log.name)}
            >
              <span>{log.name.toLowerCase()}</span>
              {log.truncated ? <span className="text-xs text-warning">truncated</span> : null}
            </button>
            {open === log.name && log.text ? (
              <pre
                className={`max-h-96 overflow-auto bg-[#0c0c0e] p-4 font-mono text-[12px] text-muted-strong ${wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"}`}
              >
                {stripLog(log.text)}
              </pre>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
