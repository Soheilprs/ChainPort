"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/lib/api";

export interface DeploymentPayload {
  run: {
    id: string;
    repositoryRevisionId: string;
    targetTestnetKey: string;
    targetChainId: number;
    targetName: string;
    status: string;
    deployerAddress: string | null;
    transactionCount: number | null;
    estimatedGas: string | null;
    estimatedCost: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    framework: string | null;
  };
  candidate: { filePath: string; entrypoint: string; framework: string } | null;
  preflight: {
    status: string;
    transactionCount: number | null;
    estimatedGas: string | null;
    estimatedCost: string | null;
  } | null;
  transactions: Array<{
    hash: string;
    nonce: number | null;
    status: string;
    blockNumber: number | null;
    contractAddress: string | null;
  }>;
  contracts: Array<{
    address: string;
    transactionHash: string;
    contractName: string | null;
    bytecodePresent: boolean;
    verificationStatus: string;
    receiptStatus: string | null;
  }>;
  checks: Array<{ name: string; status: string; detail: string }>;
  events: Array<{ fromStatus: string | null; toStatus: string; reason: string | null }>;
}

const ACTIVE = [
  "QUEUED",
  "CHECKING_ELIGIBILITY",
  "PREPARING",
  "SIMULATING",
  "FUNDING",
  "BROADCASTING",
  "CONFIRMING",
  "VERIFYING",
];

function tone(
  value: string | null,
): "pass" | "warning" | "blocker" | "unknown" | "accent" | "default" {
  if (value === "COMPLETED" || value === "PASSED" || value === "CONFIRMED" || value === "VERIFIED")
    return "pass";
  if (value === "PREPARED" || value === "NOT_CONFIGURED" || value === "SKIPPED") return "warning";
  if (
    value === "FAILED" ||
    value === "RECONCILIATION_REQUIRED" ||
    value === "REVERTED" ||
    value === "MAINNET_DEPLOYMENT_FORBIDDEN"
  )
    return "blocker";
  if (ACTIVE.includes(value ?? "")) return "accent";
  return "default";
}

export function DeploymentDetail({ initial }: { initial: DeploymentPayload }) {
  const [payload, setPayload] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const active = ACTIVE.includes(payload.run.status);

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => {
      void fetch(`${API_URL}/v1/deployments/${payload.run.id}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((body: { data: DeploymentPayload }) => setPayload(body.data));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [active, payload.run.id]);

  async function confirm() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`${API_URL}/v1/deployments/${payload.run.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmTargetKey: payload.run.targetTestnetKey }),
      });
      const body = (await response.json()) as { data?: DeploymentPayload["run"]; message?: string };
      if (!response.ok) {
        setError(body.message ?? "Unable to confirm deployment");
        return;
      }
      const details = await fetch(`${API_URL}/v1/deployments/${payload.run.id}`, {
        cache: "no-store",
      });
      const next = (await details.json()) as { data: DeploymentPayload };
      setPayload(next.data);
    } catch {
      setError("API unavailable");
    } finally {
      setPending(false);
    }
  }

  async function reconcile() {
    await fetch(`${API_URL}/v1/deployments/${payload.run.id}/reconcile`, { method: "POST" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Testnet deployment</h1>
          <p className="mt-2 text-sm text-muted">
            {payload.run.targetName} · chain id {payload.run.targetChainId}
          </p>
        </div>
        <Badge tone={tone(payload.run.status)}>{payload.run.status.replaceAll("_", " ")}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Target</p>
          <p className="mt-3 text-lg">{payload.run.targetName}</p>
          <CardDescription>{payload.run.targetTestnetKey}</CardDescription>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Candidate</p>
          <p className="mt-3 font-mono text-sm">{payload.candidate?.filePath ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Estimated txs</p>
          <p className="mt-3 text-lg">
            {payload.preflight?.transactionCount ?? payload.run.transactionCount ?? "—"}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Deployer</p>
          <p className="mt-3 break-all font-mono text-xs">
            {payload.run.deployerAddress ?? "provisioned at broadcast"}
          </p>
        </Card>
      </div>

      {payload.run.status === "PREPARED" ? (
        <Card className="border-accent/40">
          <CardTitle>Confirm broadcast</CardTitle>
          <CardDescription>
            Preflight passed. No deployment transactions have been broadcast yet. This will fund a
            disposable testnet deployer and send transactions to {payload.run.targetName}.
          </CardDescription>
          <div className="mt-4">
            <Button onClick={() => void confirm()} disabled={pending} variant="accent">
              {pending ? "Broadcasting…" : `Deploy to ${payload.run.targetName}`}
            </Button>
          </div>
        </Card>
      ) : null}

      {payload.run.errorMessage ? (
        <Card className="border-blocker/30">
          <CardTitle>{payload.run.errorCode}</CardTitle>
          <CardDescription>{payload.run.errorMessage}</CardDescription>
        </Card>
      ) : null}

      {payload.transactions.length > 0 ? (
        <Card>
          <CardTitle>Transaction journal</CardTitle>
          <ul className="mt-3 space-y-2 font-mono text-xs">
            {payload.transactions.map((tx) => (
              <li key={tx.hash} className="flex flex-wrap justify-between gap-2">
                <span>{tx.hash}</span>
                <Badge tone={tone(tx.status)}>{tx.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {payload.contracts.length > 0 ? (
        <Card>
          <CardTitle>Discovered contracts</CardTitle>
          <ul className="mt-3 space-y-3 text-sm">
            {payload.contracts.map((contract) => (
              <li key={contract.address}>
                <p className="font-mono text-xs">{contract.address}</p>
                <p className="mt-1 text-muted">
                  {contract.contractName ?? "unknown contract"} · bytecode{" "}
                  {contract.bytecodePresent ? "present" : "missing"} · source{" "}
                  {contract.verificationStatus.replaceAll("_", " ").toLowerCase()}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {payload.checks.length > 0 ? (
        <Card>
          <CardTitle>Post-deploy checks</CardTitle>
          <ul className="mt-3 space-y-2 text-sm">
            {payload.checks.map((check) => (
              <li key={check.name} className="flex items-start justify-between gap-3">
                <div>
                  <p>{check.name.replaceAll("_", " ")}</p>
                  <p className="text-xs text-muted">{check.detail}</p>
                </div>
                <Badge tone={tone(check.status)}>{check.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {payload.run.status === "RECONCILIATION_REQUIRED" ? (
        <Button variant="outline" onClick={() => void reconcile()}>
          Reconcile from journal
        </Button>
      ) : null}

      {error !== null ? <p className="text-sm text-blocker">{error}</p> : null}
    </div>
  );
}
