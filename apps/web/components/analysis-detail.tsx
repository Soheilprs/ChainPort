"use client";

import { useEffect, useMemo, useState } from "react";

import { EvaluateCompatibilityButton } from "@/components/evaluate-compatibility";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { clientApiUrl } from "@/lib/api";

interface AnalysisPayload {
  analysis: {
    id: string;
    projectId: string;
    commitSha: string;
    scannerVersion: string;
    status: string;
    fileCount: number;
    analyzedFileCount: number;
    skippedFileCount: number;
    errorCode: string | null;
    errorMessage: string | null;
  };
  components: Array<{ id: string; kind: string; name: string; filePath: string | null }>;
  requirements: Array<{
    id: string;
    category: string;
    key: string;
    detectedValue: string;
    normalizedValue: string;
    confidence: string;
    evidence: Array<{
      id: string;
      filePath: string;
      startLine: number;
      excerpt: string;
    }>;
  }>;
  files: Array<{ path: string; category: string; analyzed: boolean; skipReason: string | null }>;
}

function statusLabel(status: string): string {
  switch (status) {
    case "QUEUED":
      return "Queued";
    case "MATERIALIZING":
      return "Preparing repository";
    case "INVENTORYING":
      return "Inventorying";
    case "ANALYZING":
      return "Analyzing";
    case "COMPLETED":
      return "Complete";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

const TABS = [
  "overview",
  "structure",
  "contracts",
  "dependencies",
  "network",
  "rpc",
  "evidence",
] as const;

export function AnalysisDetail({
  initial,
  tab = "overview",
  requirementId,
  evaluateError,
}: {
  initial: AnalysisPayload;
  tab?: string | undefined;
  requirementId?: string | undefined;
  evaluateError?: string | undefined;
}) {
  const [payload, setPayload] = useState(initial);
  const active = ["QUEUED", "MATERIALIZING", "INVENTORYING", "ANALYZING"].includes(
    payload.analysis.status,
  );
  const currentTab = (TABS as readonly string[]).includes(tab) ? tab : "overview";
  const analysisHref = `/app/analyses/${payload.analysis.id}`;

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => {
      void fetch(`${clientApiUrl()}/v1/analyses/${payload.analysis.id}`, {
        cache: "no-store",
        credentials: "include",
      })
        .then((response) => response.json())
        .then((body: { data: AnalysisPayload }) => setPayload(body.data));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [active, payload.analysis.id]);

  const selectedRequirement = payload.requirements.find((item) => item.id === requirementId);
  const frameworks = payload.components.filter((item) => item.kind === "FRAMEWORK");
  const contracts = payload.components.filter((item) => item.kind === "CONTRACT");

  const grouped = useMemo(() => {
    return {
      network: payload.requirements.filter((item) => item.category === "NETWORK"),
      rpc: payload.requirements.filter((item) => item.category === "RPC"),
      protocol: payload.requirements.filter((item) =>
        ["PROTOCOL", "ORACLE", "CROSS_CHAIN", "TOKEN"].includes(item.category),
      ),
      frontend: payload.requirements.filter((item) => item.category === "FRONTEND"),
    };
  }, [payload.requirements]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-medium tracking-tight">Repository intelligence</h1>
        <Badge>{statusLabel(payload.analysis.status)}</Badge>
      </div>
      <p className="font-mono text-xs text-muted" title={payload.analysis.commitSha}>
        SHA {payload.analysis.commitSha} · scanner v{payload.analysis.scannerVersion}
      </p>
      <p className="text-sm text-muted">
        Observations only. Compatibility scoring happens in a separate, versioned evaluation against
        the selected target chain.
      </p>
      {payload.analysis.status === "COMPLETED" ? (
        <EvaluateCompatibilityButton
          projectId={payload.analysis.projectId}
          analysisId={payload.analysis.id}
          analysisComplete
          returnTo={analysisHref}
          error={evaluateError}
        />
      ) : null}
      {payload.analysis.status === "FAILED" ? (
        <Card className="border-blocker/30">
          <CardTitle>Analysis failed</CardTitle>
          <CardDescription>
            {payload.analysis.errorCode} {payload.analysis.errorMessage}
          </CardDescription>
        </Card>
      ) : null}
      <div className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((item) => (
          <a
            key={item}
            href={`${analysisHref}?tab=${item}`}
            className={`-mb-px border-b px-3 py-2 text-sm capitalize ${
              currentTab === item
                ? "border-foreground text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {item}
          </a>
        ))}
      </div>
      {currentTab === "overview" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardTitle>Frameworks</CardTitle>
            <CardDescription>
              {frameworks.length === 0
                ? "None detected"
                : frameworks.map((item) => item.name).join(", ")}
            </CardDescription>
          </Card>
          <Card>
            <CardTitle>Contracts</CardTitle>
            <CardDescription>
              {contracts.length} contracts · {payload.analysis.analyzedFileCount} files analyzed
            </CardDescription>
          </Card>
          <Card>
            <CardTitle>Skipped</CardTitle>
            <CardDescription>{payload.analysis.skippedFileCount} files skipped</CardDescription>
          </Card>
        </div>
      ) : null}
      {currentTab === "structure" ? (
        <ul className="space-y-1 font-mono text-xs text-muted">
          {payload.files.slice(0, 200).map((file) => (
            <li key={file.path}>
              {file.path} · {file.category}
              {file.skipReason !== null ? ` · skipped (${file.skipReason})` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {currentTab === "contracts" ? (
        <ul className="space-y-2 text-sm">
          {contracts.map((item) => (
            <li key={item.id}>
              {item.name} <span className="text-muted">{item.filePath}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {currentTab === "dependencies" ? (
        <RequirementList items={grouped.protocol} analysisHref={analysisHref} />
      ) : null}
      {currentTab === "network" ? (
        <RequirementList items={grouped.network} analysisHref={analysisHref} />
      ) : null}
      {currentTab === "rpc" ? (
        <RequirementList items={grouped.rpc} analysisHref={analysisHref} />
      ) : null}
      {currentTab === "evidence" && selectedRequirement !== undefined ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium">
            {selectedRequirement.key} · {selectedRequirement.normalizedValue}
          </h2>
          {selectedRequirement.evidence.map((item) => (
            <Card key={item.id}>
              <CardTitle className="font-mono text-xs">
                {item.filePath}:{item.startLine}
              </CardTitle>
              <CardDescription className="font-mono">{item.excerpt}</CardDescription>
            </Card>
          ))}
        </div>
      ) : null}
      {currentTab === "evidence" && selectedRequirement === undefined ? (
        <p className="text-sm text-muted">Select a requirement to inspect evidence.</p>
      ) : null}
    </div>
  );
}

function RequirementList({
  items,
  analysisHref,
}: {
  items: AnalysisPayload["requirements"];
  analysisHref: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">None detected.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`${analysisHref}?tab=evidence&requirement=${item.id}`}
            className="text-left text-sm hover:text-accent"
          >
            {item.key}: {item.normalizedValue}{" "}
            <span className="text-muted">({item.confidence})</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
