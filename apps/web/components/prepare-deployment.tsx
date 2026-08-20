"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";

export function PrepareDeploymentButton({
  revisionId,
  defaultTarget,
}: {
  revisionId: string;
  defaultTarget?: string;
}) {
  const router = useRouter();
  const [target, setTarget] = useState(defaultTarget ?? "anvil");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`${API_URL}/v1/revisions/${revisionId}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTestnetKey: target }),
      });
      const body = (await response.json()) as {
        data?: { id: string };
        message?: string;
        code?: string;
      };
      if (!response.ok || body.data?.id === undefined) {
        setError(body.message ?? body.code ?? "Unable to prepare deployment");
        return;
      }
      router.push(`/app/deployments/${body.data.id}`);
    } catch {
      setError("API unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs uppercase tracking-[0.16em] text-muted">
        Target testnet
        <select
          className="mt-2 block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-foreground"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        >
          <option value="optimism-sepolia">OP Sepolia</option>
          <option value="base-sepolia">Base Sepolia</option>
          <option value="sepolia">Ethereum Sepolia</option>
          <option value="arbitrum-sepolia">Arbitrum Sepolia</option>
          <option value="anvil">Anvil (local)</option>
        </select>
      </label>
      <Button onClick={() => void onClick()} disabled={pending}>
        {pending ? "Preparing…" : `Prepare deployment to ${labelFor(target)}`}
      </Button>
      {error !== null ? <p className="text-sm text-blocker">{error}</p> : null}
    </div>
  );
}

function labelFor(key: string): string {
  if (key === "optimism-sepolia") return "OP Sepolia";
  if (key === "base-sepolia") return "Base Sepolia";
  if (key === "sepolia") return "Ethereum Sepolia";
  if (key === "arbitrum-sepolia") return "Arbitrum Sepolia";
  if (key === "anvil") return "Anvil";
  return key;
}
