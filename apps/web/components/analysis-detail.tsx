"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/lib/api";

interface AnalysisPayload {
  analysis: {
    id: string;
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

export function AnalysisDetail({ initial }: { initial: AnalysisPayload }) {
  const [payload, setPayload] = useState(initial);
  const active = ["QUEUED", "MATERIALIZING", "INVENTORYING", "ANALYZING"].includes(
    payload.analysis.status,
  );

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => {
      void fetch(`${API_URL}/v1/analyses/${payload.analysis.id}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((body: { data: AnalysisPayload }) => setPayload(body.data));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [active, payload.analysis.id]);

  const [tab, setTab] = useState("overview");
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRequirement = payload.requirements.find((item) => item.id === selected);
  const frameworks = payload.components.filter((item) => item.kind === "FRAMEWORK");
  const contracts = payload.components.filter((item) => item.kind === "CONTRACT");
  const tabs = [
    "overview",
    "structure",
    "contracts",
    "dependencies",
    "network",
    "rpc",
    "evidence",
  ] as const;

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
        Observations only. This is not a compatibility result and does not include PASS / WARNING /
        BLOCKER findings.
      </p>
      {payload.analysis.status === "FAILED" ? (
        <Card className="border-blocker/30">
          <CardTitle>Analysis failed</CardTitle>
          <CardDescription>
            {payload.analysis.errorCode} {payload.analysis.errorMessage}
          </CardDescription>
        </Card>
      ) : null}
      <div className="flex flex-wrap gap-1 border-b border-line">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            className={`-mb-px border-b px-3 py-2 text-sm capitalize ${
              tab === item ? "border-foreground text-foreground" : "border-transparent text-muted"
            }`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
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
      {tab === "structure" ? (
        <ul className="space-y-1 font-mono text-xs text-muted">
          {payload.files.slice(0, 200).map((file) => (
            <li key={file.path}>
              {file.path} · {file.category}
              {file.skipReason !== null ? ` · skipped (${file.skipReason})` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "contracts" ? (
        <ul className="space-y-2 text-sm">
          {contracts.map((item) => (
            <li key={item.id}>
              {item.name} <span className="text-muted">{item.filePath}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "dependencies" ? (
        <RequirementList
          items={grouped.protocol}
          onSelect={(id) => {
            setSelected(id);
            setTab("evidence");
          }}
        />
      ) : null}
      {tab === "network" ? (
        <RequirementList
          items={grouped.network}
          onSelect={(id) => {
            setSelected(id);
            setTab("evidence");
          }}
        />
      ) : null}
      {tab === "rpc" ? (
        <RequirementList
          items={grouped.rpc}
          onSelect={(id) => {
            setSelected(id);
            setTab("evidence");
          }}
        />
      ) : null}
      {tab === "evidence" && selectedRequirement !== undefined ? (
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
      {tab === "evidence" && selectedRequirement === undefined ? (
        <p className="text-sm text-muted">Select a requirement to inspect evidence.</p>
      ) : null}
    </div>
  );
}

function RequirementList({
  items,
  onSelect,
}: {
  items: AnalysisPayload["requirements"];
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">None detected.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="text-left text-sm hover:text-accent"
            onClick={() => onSelect(item.id)}
          >
            {item.key}: {item.normalizedValue}{" "}
            <span className="text-muted">({item.confidence})</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
